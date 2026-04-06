from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import httpx
import random
import string
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

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
    referral_code: Optional[str] = None

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

# ─── Subscription Helpers ───

MONTHLY_PRICE = 4.99
FREE_DAILY_CHAT_LIMIT = 3
TRIAL_DAYS = 7

async def get_subscription_info(user_id: str) -> dict:
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        return {"status": "free", "is_premium": False}

    now = datetime.now(timezone.utc)

    # Check trial
    trial_end = user.get("trial_end")
    if trial_end:
        if isinstance(trial_end, str):
            trial_end = datetime.fromisoformat(trial_end)
        if trial_end.tzinfo is None:
            trial_end = trial_end.replace(tzinfo=timezone.utc)
        if trial_end > now:
            days_left = (trial_end - now).days
            return {"status": "trial", "is_premium": True, "days_left": days_left, "trial_end": trial_end.isoformat()}

    # Check active subscription
    sub_end = user.get("subscription_end")
    if sub_end:
        if isinstance(sub_end, str):
            sub_end = datetime.fromisoformat(sub_end)
        if sub_end.tzinfo is None:
            sub_end = sub_end.replace(tzinfo=timezone.utc)
        if sub_end > now:
            days_left = (sub_end - now).days
            return {"status": "active", "is_premium": True, "days_left": days_left, "subscription_end": sub_end.isoformat()}

    return {"status": "free", "is_premium": False}


async def get_daily_chat_count(user_id: str) -> int:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$unwind": "$messages"},
        {"$match": {"messages.role": "user", "messages.timestamp": {"$regex": f"^{today}"}}},
        {"$count": "total"}
    ]
    result = await db.conversations.aggregate(pipeline).to_list(1)
    return result[0]["total"] if result else 0


def generate_referral_code():
    return "HEARD" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


REFERRAL_REWARD_DAYS = 30  # Both referrer and referee get 30 days premium

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
        referral_code = generate_referral_code()
        # Ensure unique referral code
        while await db.users.find_one({"referral_code": referral_code}):
            referral_code = generate_referral_code()

        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "trial_end": (datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS)).isoformat(),
            "subscription_status": "trial",
            "referral_code": referral_code,
            "referred_by": None,
            "referral_count": 0,
            "is_admin": False
        })

        # Process incoming referral code
        if body.referral_code:
            referrer = await db.users.find_one({"referral_code": body.referral_code}, {"_id": 0})
            if referrer and referrer["user_id"] != user_id:
                now = datetime.now(timezone.utc)
                # Reward the new user: extend trial by 30 days
                new_end = (now + timedelta(days=TRIAL_DAYS + REFERRAL_REWARD_DAYS)).isoformat()
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$set": {"trial_end": new_end, "referred_by": referrer["user_id"]}}
                )
                # Reward the referrer: extend subscription by 30 days
                referrer_sub_end = referrer.get("subscription_end") or referrer.get("trial_end")
                if referrer_sub_end:
                    if isinstance(referrer_sub_end, str):
                        referrer_sub_end = datetime.fromisoformat(referrer_sub_end)
                    if referrer_sub_end.tzinfo is None:
                        referrer_sub_end = referrer_sub_end.replace(tzinfo=timezone.utc)
                    if referrer_sub_end < now:
                        referrer_sub_end = now
                else:
                    referrer_sub_end = now
                new_referrer_end = (referrer_sub_end + timedelta(days=REFERRAL_REWARD_DAYS)).isoformat()
                await db.users.update_one(
                    {"user_id": referrer["user_id"]},
                    {"$set": {"subscription_end": new_referrer_end, "subscription_status": "active"},
                     "$inc": {"referral_count": 1}}
                )
                # Track referral
                await db.referrals.insert_one({
                    "referral_id": f"ref_{uuid.uuid4().hex[:12]}",
                    "referrer_user_id": referrer["user_id"],
                    "referee_user_id": user_id,
                    "referral_code": body.referral_code,
                    "created_at": now.isoformat()
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
    sub_info = await get_subscription_info(user["user_id"])
    return {
        **user,
        "subscription": sub_info,
        "referral_code": user.get("referral_code", ""),
        "referral_count": user.get("referral_count", 0),
        "is_admin": user.get("is_admin", False)
    }


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

    # Check subscription / daily limit
    sub_info = await get_subscription_info(user_id)
    if not sub_info["is_premium"]:
        daily_count = await get_daily_chat_count(user_id)
        if daily_count >= FREE_DAILY_CHAT_LIMIT:
            raise HTTPException(
                status_code=403,
                detail=f"You've used your {FREE_DAILY_CHAT_LIMIT} free messages for today. Upgrade to HEARD Premium for unlimited chats with Willow!"
            )

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
    # AI prompts are a premium feature
    sub_info = await get_subscription_info(user["user_id"])
    if not sub_info["is_premium"]:
        raise HTTPException(status_code=403, detail="AI journaling prompts are a premium feature. Upgrade to unlock Willow's personalized prompts!")

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


# ─── Subscription / Payment Routes ───

class CheckoutRequest(BaseModel):
    origin_url: str

@api_router.get("/subscribe/info")
async def get_subscription(user: dict = Depends(get_current_user)):
    sub_info = await get_subscription_info(user["user_id"])
    return sub_info


@api_router.post("/subscribe/checkout")
async def create_checkout(body: CheckoutRequest, request: Request, user: dict = Depends(get_current_user)):
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/dashboard?session_id={{CHECKOUT_SESSION_ID}}&payment=success"
    cancel_url = f"{origin}/pricing"

    checkout_request = CheckoutSessionRequest(
        amount=MONTHLY_PRICE,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user["user_id"],
            "plan": "monthly",
            "email": user.get("email", "")
        }
    )

    session = await stripe_checkout.create_checkout_session(checkout_request)

    # Create payment transaction record
    await db.payment_transactions.insert_one({
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "session_id": session.session_id,
        "amount": MONTHLY_PRICE,
        "currency": "usd",
        "status": "initiated",
        "payment_status": "pending",
        "metadata": {"plan": "monthly"},
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    return {"url": session.url, "session_id": session.session_id}


@api_router.get("/subscribe/status/{session_id}")
async def check_payment_status(session_id: str, request: Request, user: dict = Depends(get_current_user)):
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    status = await stripe_checkout.get_checkout_status(session_id)

    # Check if this payment was already processed
    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if txn and txn.get("payment_status") != "paid" and status.payment_status == "paid":
        # First time paid - activate subscription
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "completed", "payment_status": "paid"}}
        )
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {
                "subscription_end": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
                "subscription_status": "active"
            }}
        )
    elif txn and status.payment_status != "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": status.status, "payment_status": status.payment_status}}
        )

    return {"status": status.status, "payment_status": status.payment_status}


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    body = await request.body()
    signature = request.headers.get("Stripe-Signature")

    try:
        event = await stripe_checkout.handle_webhook(body, signature)
        if event.session_id:
            txn = await db.payment_transactions.find_one({"session_id": event.session_id}, {"_id": 0})
            if txn and txn.get("payment_status") != "paid" and event.payment_status == "paid":
                await db.payment_transactions.update_one(
                    {"session_id": event.session_id},
                    {"$set": {"status": "completed", "payment_status": "paid"}}
                )
                await db.users.update_one(
                    {"user_id": txn["user_id"]},
                    {"$set": {
                        "subscription_end": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
                        "subscription_status": "active"
                    }}
                )
            elif txn:
                await db.payment_transactions.update_one(
                    {"session_id": event.session_id},
                    {"$set": {"status": event.event_type, "payment_status": event.payment_status}}
                )
    except Exception as e:
        logger.error(f"Webhook error: {e}")

    return {"status": "ok"}


# ─── Referral Routes ───

@api_router.get("/referral/info")
async def get_referral_info(user: dict = Depends(get_current_user)):
    referral_code = user.get("referral_code", "")
    referral_count = user.get("referral_count", 0)
    referrals = await db.referrals.find(
        {"referrer_user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)

    # Get referee names
    referral_details = []
    for ref in referrals:
        referee = await db.users.find_one({"user_id": ref["referee_user_id"]}, {"_id": 0, "name": 1})
        referral_details.append({
            "name": referee.get("name", "A mom") if referee else "A mom",
            "date": ref.get("created_at", "")
        })

    return {
        "referral_code": referral_code,
        "referral_count": referral_count,
        "referrals": referral_details,
        "reward_days": REFERRAL_REWARD_DAYS
    }


# ─── Admin Routes ───

async def require_admin(user: dict = Depends(get_current_user)):
    if not user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@api_router.get("/admin/analytics")
async def get_analytics(user: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()

    # User counts
    total_users = await db.users.count_documents({})
    new_today = await db.users.count_documents({"created_at": {"$regex": f"^{today_str}"}})
    new_this_week = await db.users.count_documents({"created_at": {"$gte": week_ago}})
    new_this_month = await db.users.count_documents({"created_at": {"$gte": month_ago}})

    # Subscription breakdown
    all_users = await db.users.find({}, {"_id": 0, "user_id": 1, "trial_end": 1, "subscription_end": 1, "subscription_status": 1}).to_list(10000)
    trial_count = 0
    active_count = 0
    free_count = 0
    for u in all_users:
        info = await get_subscription_info(u["user_id"])
        if info["status"] == "trial":
            trial_count += 1
        elif info["status"] == "active":
            active_count += 1
        else:
            free_count += 1

    # Revenue
    paid_txns = await db.payment_transactions.find(
        {"payment_status": "paid"}, {"_id": 0, "amount": 1}
    ).to_list(10000)
    total_revenue = sum(t.get("amount", 0) for t in paid_txns)

    # Referral stats
    total_referrals = await db.referrals.count_documents({})
    referrals_this_month = await db.referrals.count_documents({"created_at": {"$gte": month_ago}})

    # Engagement stats
    total_conversations = await db.conversations.count_documents({})
    total_journal_entries = await db.journal_entries.count_documents({})
    total_mood_entries = await db.mood_entries.count_documents({})
    total_events = await db.calendar_events.count_documents({})

    # Recent signups
    recent_users = await db.users.find(
        {}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "created_at": 1, "subscription_status": 1, "referral_count": 1}
    ).sort("created_at", -1).limit(20).to_list(20)

    # Top referrers
    top_referrers = await db.users.find(
        {"referral_count": {"$gt": 0}},
        {"_id": 0, "name": 1, "email": 1, "referral_count": 1}
    ).sort("referral_count", -1).limit(10).to_list(10)

    return {
        "users": {
            "total": total_users,
            "new_today": new_today,
            "new_this_week": new_this_week,
            "new_this_month": new_this_month,
            "trial": trial_count,
            "active_premium": active_count,
            "free": free_count
        },
        "revenue": {
            "total": round(total_revenue, 2),
            "total_transactions": len(paid_txns)
        },
        "referrals": {
            "total": total_referrals,
            "this_month": referrals_this_month,
            "top_referrers": top_referrers
        },
        "engagement": {
            "conversations": total_conversations,
            "journal_entries": total_journal_entries,
            "mood_entries": total_mood_entries,
            "calendar_events": total_events
        },
        "recent_signups": recent_users
    }


@api_router.post("/admin/set-admin")
async def set_admin_by_email(request: Request):
    """One-time setup: set admin by providing the admin secret from env"""
    body = await request.json()
    email = body.get("email")
    secret = body.get("secret")
    # Simple secret-based admin setup (use env var or hardcoded for now)
    if secret != "HEARD_ADMIN_2026":
        raise HTTPException(status_code=403, detail="Invalid secret")
    result = await db.users.update_one({"email": email}, {"$set": {"is_admin": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": f"Admin access granted to {email}"}


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
