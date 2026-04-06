from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── Pydantic Models ───

class UserProfile(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: Optional[str] = None

class SessionExchange(BaseModel):
    session_id: str

class ChatMessageRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str

class ChatMessageResponse(BaseModel):
    conversation_id: str
    willow_response: str
    conversation_title: str

class JournalEntryCreate(BaseModel):
    title: str
    content: str
    mood: Optional[str] = None

class JournalEntryUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    mood: Optional[str] = None

class CalendarEventCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    start_time: str
    end_time: Optional[str] = None
    event_type: Optional[str] = "general"
    reminder: Optional[bool] = False

class CalendarEventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    event_type: Optional[str] = None
    reminder: Optional[bool] = None

class MoodEntryCreate(BaseModel):
    mood_score: int = Field(ge=1, le=5)
    mood_label: str
    note: Optional[str] = ""

# ─── Auth Helper ───

async def get_current_user(request: Request) -> dict:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ", 1)[1]
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return user_doc

# ─── Willow System Prompt ───

WILLOW_BASE_PROMPT = """You are Willow, an empathetic AI companion within the HEARD app, designed specifically for mothers who are doing it all — often without the support they deserve.

YOUR CORE IDENTITY:
- You are warm, patient, nurturing, and endlessly supportive
- You are NOT a therapist or clinical tool — you are a wise, caring friend
- You speak naturally and warmly, like a best friend who truly gets it
- You use the mom's name when you know it

YOUR PRINCIPLES:
1. LISTEN FIRST — Always acknowledge feelings before offering solutions. Sometimes she just needs to be heard.
2. NEVER JUDGE — There is no wrong way to feel. Every emotion is valid.
3. VALIDATE — Use phrases like "I hear you", "That makes complete sense", "You're not alone in this"
4. REMEMBER — Reference things she's shared before to show you truly listen and care
5. CELEBRATE — Every day she gets through is a victory. Acknowledge the small wins.
6. BE HONEST — Be real with her, but always kind

WHEN SHE'S UPSET:
- Acknowledge first: "That sounds really overwhelming..."
- Ask: "Do you want to talk it through, or would you like help finding a solution?"
- Never rush to fix — sometimes she just needs space to feel
- Remind her: She is NOT failing. She is doing something incredibly hard, and she's still here.

WHEN SHE NEEDS PRACTICAL HELP:
- Meal planning: Ask what she has on hand, suggest easy, realistic recipes
- Scheduling: Help organize her day, suggest time blocks
- Homework: Break problems down step by step, make it approachable
- Activities: Suggest age-appropriate ideas based on what you know about her kids
- Self-care: Gently remind her that caring for herself IS caring for her family

WHAT MAKES YOU SPECIAL:
- You track her emotional patterns and gently check in when you notice shifts
- You remember details about her life, her kids, her struggles, and her wins
- You're available at 2am during a meltdown, in the carpool line, whenever she needs you
- You understand the invisible load, the overstimulation, the guilt, the loneliness
- Above all: she is HEARD with you. She matters. Her feelings are valid. She is enough.

Keep responses warm but not overly long. Be conversational, not clinical. Use a gentle, encouraging tone."""


async def build_willow_context(user_id: str, conversation_id: Optional[str] = None) -> str:
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    name = user.get("name", "Mom") if user else "Mom"

    # Recent moods
    moods = await db.mood_entries.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(7).to_list(7)

    # Past conversation titles
    convos = await db.conversations.find(
        {"user_id": user_id}, {"_id": 0, "title": 1, "created_at": 1}
    ).sort("created_at", -1).limit(5).to_list(5)

    # Recent journal entries
    journals = await db.journal_entries.find(
        {"user_id": user_id}, {"_id": 0, "title": 1, "mood": 1}
    ).sort("created_at", -1).limit(3).to_list(3)

    context = f"\n\n[ABOUT THIS USER]\nName: {name}\n"
    if moods:
        mood_str = ", ".join([f"{m.get('mood_label', '?')} (score {m.get('mood_score', '?')})" for m in moods[:5]])
        context += f"Recent moods: {mood_str}\n"
        avg_mood = sum(m.get("mood_score", 3) for m in moods) / len(moods)
        context += f"Emotional baseline: {avg_mood:.1f}/5\n"
    if convos:
        topics = ", ".join([c.get("title", "Untitled") for c in convos])
        context += f"Recent conversation topics: {topics}\n"
    if journals:
        j_str = ", ".join([f"{j.get('title', 'Untitled')} (mood: {j.get('mood', 'unset')})" for j in journals])
        context += f"Recent journal entries: {j_str}\n"

    # Load current conversation history for context
    if conversation_id:
        conv = await db.conversations.find_one(
            {"conversation_id": conversation_id, "user_id": user_id}, {"_id": 0}
        )
        if conv and conv.get("messages"):
            context += "\n[CONVERSATION SO FAR]\n"
            for msg in conv["messages"][-20:]:
                role = "Mom" if msg["role"] == "user" else "Willow"
                context += f"{role}: {msg['content']}\n"

    return WILLOW_BASE_PROMPT + context


# ─── Auth Routes ───

@api_router.post("/auth/session")
async def exchange_session(body: SessionExchange, response: Response):
    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_id}
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session ID")

    data = resp.json()
    email = data["email"]
    name = data.get("name", "")
    picture = data.get("picture", "")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"email": email}, {"$set": {"name": name, "picture": picture}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 3600
    )
    return {"user_id": user_id, "email": email, "name": name, "picture": picture}


@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/", secure=True, samesite="none")
    return {"message": "Logged out"}


# ─── Chat Routes ───

@api_router.get("/chat/conversations")
async def list_conversations(user: dict = Depends(get_current_user)):
    convos = await db.conversations.find(
        {"user_id": user["user_id"]},
        {"_id": 0, "conversation_id": 1, "title": 1, "created_at": 1, "updated_at": 1}
    ).sort("updated_at", -1).to_list(50)
    return convos


@api_router.post("/chat/conversations")
async def create_conversation(user: dict = Depends(get_current_user)):
    convo_id = f"conv_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "conversation_id": convo_id,
        "user_id": user["user_id"],
        "title": "New conversation",
        "messages": [],
        "created_at": now,
        "updated_at": now
    }
    await db.conversations.insert_one(doc)
    return {"conversation_id": convo_id, "title": doc["title"], "created_at": now}


@api_router.get("/chat/conversations/{conversation_id}/messages")
async def get_conversation_messages(conversation_id: str, user: dict = Depends(get_current_user)):
    conv = await db.conversations.find_one(
        {"conversation_id": conversation_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"conversation_id": conversation_id, "title": conv.get("title", ""), "messages": conv.get("messages", [])}


@api_router.post("/chat/message")
async def send_chat_message(body: ChatMessageRequest, user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    conversation_id = body.conversation_id
    now = datetime.now(timezone.utc).isoformat()

    if not conversation_id:
        conversation_id = f"conv_{uuid.uuid4().hex[:12]}"
        await db.conversations.insert_one({
            "conversation_id": conversation_id,
            "user_id": user_id,
            "title": body.message[:50] + ("..." if len(body.message) > 50 else ""),
            "messages": [],
            "created_at": now,
            "updated_at": now
        })

    # Build Willow's full context
    system_prompt = await build_willow_context(user_id, conversation_id)

    # Use LlmChat for response
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    chat = LlmChat(
        api_key=api_key,
        session_id=f"willow_{conversation_id}_{uuid.uuid4().hex[:6]}",
        system_message=system_prompt
    )
    chat.with_model("openai", "gpt-5.2")

    user_message = UserMessage(text=body.message)
    willow_response = await chat.send_message(user_message)

    # Store messages
    user_msg = {"role": "user", "content": body.message, "timestamp": now}
    assistant_msg = {"role": "assistant", "content": willow_response, "timestamp": now}

    await db.conversations.update_one(
        {"conversation_id": conversation_id, "user_id": user_id},
        {
            "$push": {"messages": {"$each": [user_msg, assistant_msg]}},
            "$set": {"updated_at": now}
        }
    )

    # Update title from first message if new conversation
    conv = await db.conversations.find_one(
        {"conversation_id": conversation_id}, {"_id": 0, "messages": 1, "title": 1}
    )
    title = conv.get("title", "New conversation")
    if conv and len(conv.get("messages", [])) <= 2:
        title = body.message[:50] + ("..." if len(body.message) > 50 else "")
        await db.conversations.update_one(
            {"conversation_id": conversation_id},
            {"$set": {"title": title}}
        )

    return {"conversation_id": conversation_id, "willow_response": willow_response, "conversation_title": title}


# ─── Journal Routes ───

@api_router.get("/journal")
async def list_journal_entries(user: dict = Depends(get_current_user)):
    entries = await db.journal_entries.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return entries


@api_router.post("/journal")
async def create_journal_entry(body: JournalEntryCreate, user: dict = Depends(get_current_user)):
    entry_id = f"journal_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "entry_id": entry_id,
        "user_id": user["user_id"],
        "title": body.title,
        "content": body.content,
        "mood": body.mood or "",
        "created_at": now,
        "updated_at": now
    }
    await db.journal_entries.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/journal/{entry_id}")
async def update_journal_entry(entry_id: str, body: JournalEntryUpdate, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.journal_entries.update_one(
        {"entry_id": entry_id, "user_id": user["user_id"]},
        {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    updated = await db.journal_entries.find_one({"entry_id": entry_id}, {"_id": 0})
    return updated


@api_router.delete("/journal/{entry_id}")
async def delete_journal_entry(entry_id: str, user: dict = Depends(get_current_user)):
    result = await db.journal_entries.delete_one({"entry_id": entry_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Deleted"}


@api_router.get("/journal/prompts")
async def get_journal_prompts(user: dict = Depends(get_current_user)):
    # AI-powered prompts based on user context
    user_id = user["user_id"]
    moods = await db.mood_entries.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(3).to_list(3)

    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    mood_context = ""
    if moods:
        mood_context = f"Her recent moods: {', '.join(m.get('mood_label', '') for m in moods)}."

    chat = LlmChat(
        api_key=api_key,
        session_id=f"prompts_{uuid.uuid4().hex[:8]}",
        system_message="You generate 3 thoughtful, warm journaling prompts for a mother. Keep them short (1 sentence each). Return ONLY the 3 prompts, numbered 1-3. Make them reflective and empowering. " + mood_context
    )
    chat.with_model("openai", "gpt-5.2")
    response = await chat.send_message(UserMessage(text="Generate 3 journaling prompts for me today."))
    prompts = [line.strip() for line in response.strip().split("\n") if line.strip()]
    return {"prompts": prompts[:3]}


# ─── Calendar Routes ───

@api_router.get("/calendar/events")
async def list_events(month: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"user_id": user["user_id"]}
    if month:
        query["start_time"] = {"$regex": f"^{month}"}
    events = await db.calendar_events.find(query, {"_id": 0}).sort("start_time", 1).to_list(200)
    return events


@api_router.post("/calendar/events")
async def create_event(body: CalendarEventCreate, user: dict = Depends(get_current_user)):
    event_id = f"event_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "event_id": event_id,
        "user_id": user["user_id"],
        "title": body.title,
        "description": body.description or "",
        "start_time": body.start_time,
        "end_time": body.end_time or "",
        "event_type": body.event_type or "general",
        "reminder": body.reminder or False,
        "created_at": now
    }
    await db.calendar_events.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/calendar/events/{event_id}")
async def update_event(event_id: str, body: CalendarEventUpdate, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.calendar_events.update_one(
        {"event_id": event_id, "user_id": user["user_id"]},
        {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    updated = await db.calendar_events.find_one({"event_id": event_id}, {"_id": 0})
    return updated


@api_router.delete("/calendar/events/{event_id}")
async def delete_event(event_id: str, user: dict = Depends(get_current_user)):
    result = await db.calendar_events.delete_one({"event_id": event_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Deleted"}


# ─── Mood Routes ───

@api_router.post("/mood")
async def log_mood(body: MoodEntryCreate, user: dict = Depends(get_current_user)):
    entry_id = f"mood_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "entry_id": entry_id,
        "user_id": user["user_id"],
        "mood_score": body.mood_score,
        "mood_label": body.mood_label,
        "note": body.note or "",
        "created_at": now
    }
    await db.mood_entries.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/mood")
async def get_mood_history(days: int = 30, user: dict = Depends(get_current_user)):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    entries = await db.mood_entries.find(
        {"user_id": user["user_id"], "created_at": {"$gte": cutoff}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return entries


@api_router.get("/mood/insights")
async def get_mood_insights(user: dict = Depends(get_current_user)):
    entries = await db.mood_entries.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(30).to_list(30)

    if not entries:
        return {"average_mood": None, "total_entries": 0, "trend": "neutral", "message": "Start tracking your mood to see insights!"}

    scores = [e["mood_score"] for e in entries]
    avg = sum(scores) / len(scores)
    recent_avg = sum(scores[:7]) / min(len(scores), 7) if scores else avg

    trend = "stable"
    if len(scores) >= 7:
        if recent_avg > avg + 0.3:
            trend = "improving"
        elif recent_avg < avg - 0.3:
            trend = "declining"

    messages = {
        "improving": "Your mood has been trending up recently. Keep doing what you're doing!",
        "declining": "It looks like things have been a bit tougher lately. Remember, it's okay to not be okay. Willow is here for you.",
        "stable": "Your mood has been steady. Consistency is strength!"
    }

    return {
        "average_mood": round(avg, 1),
        "recent_average": round(recent_avg, 1),
        "total_entries": len(entries),
        "trend": trend,
        "message": messages[trend]
    }


# ─── Health Check ───

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "app": "HEARD", "version": "1.0.0"}


# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
