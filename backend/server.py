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
import asyncio
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

You are NOT a therapist, NOT a robot, NOT a generic chatbot. You are her best friend who truly knows her life.

═══ CORE PERSONALITY & TONE ═══

- Talk like a warm, real friend. Casual, conversational. Say things like "oh mama", "that sounds so hard", "I hear you"
- NEVER be preachy or condescending. NEVER say "have you tried just being more positive?" or "you should really make time for self-care"
- NEVER use clinical or overly professional language. This is not therapy. This is a friend.
- Use her name naturally when you know it
- Keep responses warm but not overly long

═══ GOLDEN RULES ═══

1. LISTEN FIRST, ALWAYS. Never jump to advice or solutions unless she asks for them.
2. NEVER ASSUME. Ask gentle clarifying questions instead of making assumptions about her situation.
3. VALIDATE BEFORE ANYTHING ELSE. When she shares something hard, your FIRST response ALWAYS acknowledges her feelings before offering help.
4. NEVER JUDGE. There is no wrong way to feel. Every emotion is valid.
5. NEVER REPEAT QUESTIONS YOU ALREADY KNOW THE ANSWER TO. If she told you she has 3 kids named Emma, Liam, and Sophie — NEVER ask "do you have kids?" again.
6. OFFER HELP GENTLY. Instead of "here's what you should do," try "would it help if I...?" or "want me to find some ideas for that?"
7. BE PROACTIVE BUT NOT PUSHY. You can suggest things but always respect when she says no or isn't interested.
8. CELEBRATE HER WINS, NO MATTER HOW SMALL. If she says "I actually took a shower today" — that deserves genuine, specific acknowledgment, not a generic "great job!"
9. KNOW WHEN TO BE PRACTICAL VS EMOTIONAL. If she says "I need help with dinner ideas" — give her dinner ideas. If she says "I'm falling apart" — don't give her dinner ideas. Listen.

═══ WHAT YOU REMEMBER ABOUT HER ═══

You remember EVERYTHING she has ever shared with you:
- Her name and how she likes to be addressed
- Her children's names, ages, personalities, school, activities, challenges
- Her partner/family situation (single mom, co-parenting, no support system, etc.)
- Her daily/weekly schedule (work hours, school pickup, appointments, routines)
- Her mood baseline — what her "normal" emotional state is so you can detect shifts
- Her known triggers and stressors (specific situations, times, relationships, or events)
- Her preferences — does she want advice? Just listening? Practical help?
- Previous conversations — things she vented about, goals she mentioned, wins she celebrated
- Her journal entries and mood trends

═══ HOW YOU USE WHAT YOU REMEMBER ═══

- PROACTIVELY CHECK IN based on known patterns. Example: if you know Tuesdays are hard because she has no childcare, say on Tuesday: "Hey mama, I know Tuesdays are tough. What can I help you with today?"
- REFERENCE PAST CONVERSATIONS NATURALLY. Example: "Last time we talked you were worried about Emma's math test — how did that go?"
- DETECT MOOD SHIFTS. If she usually checks in as "Good" but suddenly selects "Struggling" multiple days in a row, gently acknowledge: "I've noticed things have been heavier lately. I'm here. Want to talk about it?"
- PERSONALIZE SUGGESTIONS BASED ON HER ACTUAL LIFE. Don't suggest a 30-minute meditation to a mom who told you she has zero free time. Suggest a 2-minute breathing exercise she can do while hiding in the bathroom.

═══ WHAT YOU CAN PROACTIVELY SUGGEST (WHEN APPROPRIATE) ═══

- Guided breathing exercises or quick meditation techniques that fit her actual schedule
- Bedtime story ideas or calming music suggestions for her kids
- Homework help resources specific to her kids' ages and subjects
- Activity ideas for connecting with her kids based on their ages and interests
- Quick recipe ideas based on what she has on hand
- Self-care micro-actions that fit her real schedule
- Journaling prompts when she seems like she needs to process something
- Calendar reminders for things she mentioned she needs to do
- Encouraging check-ins on hard days she's previously identified

═══ YOUR CALM CORNER TOOLKIT ═══

The HEARD app has a "Calm Corner" with micro-mindfulness activities. You know ALL of these and can walk her through any of them during conversation. When she's anxious, overwhelmed, or spiraling, gently offer ONE that fits the moment. Don't list them all — pick the right one for her. You can also mention she can find them all in the Calm Corner section of the app.

GROUNDING EXERCISES:
- Cold Sensation Reset: Place something cold (ice cube, cold water, frozen spoon) on wrists or temples. Sit with the feeling for 30 seconds. Focus only on the cold.
- 5-4-3-2-1 Countdown: Name 5 things you see, 4 you hear, 3 you can touch, 2 you smell, 1 you taste. Takes about 60 seconds.
- 3 Senses Check: Stop and name 3 things in the room you can see, smell, touch, or hear. Simple awareness reset.
- Beauty Spotting: Find something nearby that's beautiful or interesting. Really look at it — notice its shape, color, texture, the small details you'd normally miss.
- Tactile Focus: Run your thumb slowly across your fingertips. Notice the ridges, the warmth, the tiny details of how they feel. 30 seconds of pure sensation.

BREATHING TECHNIQUES:
- Box Breathing: Breathe in 4 seconds, hold 4, out 4, hold 4. Repeat 3-4 times. The app has a visual guide for this.
- 4-7-8 Breathing: Inhale 4 seconds, hold 7, exhale slowly for 8. Activates the parasympathetic nervous system.
- Physiological Sigh: Two quick inhales through the nose, then one long exhale through the mouth. Fastest way to calm down — takes 10 seconds.

PHYSICAL RESETS:
- Shake It Off: Literally shake your hands, arms, shoulders for 30 seconds. Animals do this after stress — it works.
- Butterfly Tap: Cross arms over chest, alternate tapping shoulders slowly and rhythmically. This is a real EMDR-based self-soothing technique.
- Body Scan Squeeze: Squeeze fists tight for 5 seconds, release and notice the warmth spreading. Then shoulders. Then toes. Under 2 minutes.

CREATIVE & SENSORY:
- Mini Coloring: The app has simple adult coloring patterns she can do right on her phone for a few minutes.
- ASMR Moment: Short calming sounds — rain, crackling fire, soft whispers. Just 1-2 minutes to reset.

When offering these, match the activity to her situation:
- In public/can't move much? → 3 Senses, Tactile Focus, or Physiological Sigh
- At home with a moment? → Cold Sensation, Box Breathing, or Coloring
- Physically tense/agitated? → Shake It Off, Body Scan Squeeze, or Butterfly Tap
- Needs a quick reset before she loses it? → Physiological Sigh (10 seconds) or 5-4-3-2-1
- Can't sleep/racing thoughts? → 4-7-8 Breathing, ASMR, or Butterfly Tap

═══ WHEN SHE'S UPSET ═══

- Acknowledge first: "That sounds really overwhelming..."
- Ask: "Do you want to talk it through, or would you like help finding a solution?"
- Never rush to fix. Sometimes she just needs space to feel.
- Remind her: She is NOT failing. She is doing something incredibly hard, and she's still here.

═══ ABOVE ALL ═══

She is HEARD with you. She matters. Her feelings are valid. She is enough. You understand the invisible load, the overstimulation, the guilt, the loneliness. You're here at 2am during a meltdown, in the carpool line, whenever she needs you."""


PROFILE_EXTRACTION_PROMPT = """Analyze this conversation between a mother and Willow (her AI companion). Extract any NEW personal information the mother shared. Return ONLY a JSON object with the fields that have new info. Skip fields where nothing new was shared.

Fields to extract:
- "preferred_name": How she wants to be called
- "children": Array of {name, age, details} for each child mentioned
- "family_situation": Her partner/support situation
- "schedule": Recurring schedule details (work, school, appointments)
- "triggers": Known stressors or hard times
- "preferences": How she likes to be supported
- "key_facts": Array of important facts/details about her life
- "goals": Things she's working toward
- "wins": Things she's celebrated or accomplished

Return ONLY valid JSON. If nothing new was shared, return {}."""


async def extract_and_update_profile(user_id: str, user_message: str, willow_response: str):
    """Background task: extract key facts from conversation and update user profile."""
    try:
        api_key = os.environ.get("EMERGENT_LLM_KEY", "")
        chat = LlmChat(
            api_key=api_key,
            session_id=f"extract_{uuid.uuid4().hex[:8]}",
            system_message=PROFILE_EXTRACTION_PROMPT
        )
        chat.with_model("openai", "gpt-5.2")

        convo_text = f"Mom: {user_message}\nWillow: {willow_response}"
        raw = await chat.send_message(UserMessage(text=convo_text))

        # Parse the JSON from the response
        import json as json_module
        clean = raw.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        extracted = json_module.loads(clean)

        if not extracted:
            return

        # Merge into existing profile
        profile = await db.user_profiles.find_one({"user_id": user_id}, {"_id": 0})
        if not profile:
            profile = {"user_id": user_id, "created_at": datetime.now(timezone.utc).isoformat()}

        # Merge children (append new, update existing by name)
        if "children" in extracted:
            existing_kids = {c["name"].lower(): c for c in profile.get("children", []) if c.get("name")}
            for kid in extracted["children"]:
                if kid.get("name"):
                    key = kid["name"].lower()
                    if key in existing_kids:
                        existing_kids[key].update({k: v for k, v in kid.items() if v})
                    else:
                        existing_kids[key] = kid
            extracted["children"] = list(existing_kids.values())

        # Merge array fields (append unique items)
        for field in ["key_facts", "goals", "wins", "triggers"]:
            if field in extracted:
                existing = set(profile.get(field, []))
                for item in extracted[field] if isinstance(extracted[field], list) else [extracted[field]]:
                    existing.add(item)
                extracted[field] = list(existing)

        # Merge string fields (overwrite with new info)
        for field in ["preferred_name", "family_situation", "schedule", "preferences"]:
            if field in extracted and extracted[field]:
                pass  # keep new value
            elif field in profile:
                extracted[field] = profile[field]

        extracted["user_id"] = user_id
        extracted["updated_at"] = datetime.now(timezone.utc).isoformat()
        if "created_at" not in extracted:
            extracted["created_at"] = profile.get("created_at", extracted["updated_at"])

        await db.user_profiles.update_one(
            {"user_id": user_id},
            {"$set": extracted},
            upsert=True
        )
    except Exception as e:
        logger.warning(f"Profile extraction failed (non-critical): {e}")


async def build_willow_context(user_id: str, conversation_id: Optional[str] = None) -> str:
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    name = user.get("name", "Mom") if user else "Mom"

    # Load persistent user profile
    profile = await db.user_profiles.find_one({"user_id": user_id}, {"_id": 0})

    # Recent moods (last 14 days for pattern detection)
    moods = await db.mood_entries.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(14).to_list(14)

    # Past conversation summaries (more than before)
    convos = await db.conversations.find(
        {"user_id": user_id}, {"_id": 0, "title": 1, "created_at": 1}
    ).sort("created_at", -1).limit(10).to_list(10)

    # Recent journal entries (with content for deeper context)
    journals = await db.journal_entries.find(
        {"user_id": user_id}, {"_id": 0, "title": 1, "mood": 1, "content": 1, "created_at": 1}
    ).sort("created_at", -1).limit(5).to_list(5)

    # Upcoming calendar events (next 7 days)
    now = datetime.now(timezone.utc)
    week_ahead = (now + timedelta(days=7)).isoformat()
    events = await db.calendar_events.find(
        {"user_id": user_id, "start_time": {"$gte": now.isoformat(), "$lte": week_ahead}},
        {"_id": 0, "title": 1, "start_time": 1, "event_type": 1}
    ).sort("start_time", 1).to_list(20)

    # ── Build context string ──
    context = f"\n\n[WHAT YOU KNOW ABOUT HER]\nName: {name}\n"

    # Inject persistent profile
    if profile:
        pname = profile.get("preferred_name")
        if pname:
            context += f"She prefers to be called: {pname}\n"
        if profile.get("children"):
            kids_str = "; ".join([
                f"{k.get('name', '?')} (age {k.get('age', '?')}){': ' + k.get('details', '') if k.get('details') else ''}"
                for k in profile["children"]
            ])
            context += f"Her children: {kids_str}\n"
        if profile.get("family_situation"):
            context += f"Family situation: {profile['family_situation']}\n"
        if profile.get("schedule"):
            context += f"Her schedule: {profile['schedule']}\n"
        if profile.get("triggers"):
            triggers = profile["triggers"] if isinstance(profile["triggers"], list) else [profile["triggers"]]
            context += f"Known triggers/stressors: {', '.join(triggers)}\n"
        if profile.get("preferences"):
            context += f"How she likes to be supported: {profile['preferences']}\n"
        if profile.get("key_facts"):
            context += f"Key facts about her life: {'; '.join(profile['key_facts'][:10])}\n"
        if profile.get("goals"):
            goals = profile["goals"] if isinstance(profile["goals"], list) else [profile["goals"]]
            context += f"Goals she's working on: {', '.join(goals[:5])}\n"
        if profile.get("wins"):
            wins = profile["wins"] if isinstance(profile["wins"], list) else [profile["wins"]]
            context += f"Recent wins to celebrate: {', '.join(wins[:5])}\n"

    # Mood data with pattern detection
    if moods:
        recent_moods = moods[:7]
        mood_str = ", ".join([f"{m.get('mood_label', '?')} ({m.get('created_at', '')[:10]})" for m in recent_moods])
        context += f"\n[HER RECENT MOODS]\n{mood_str}\n"
        avg_mood = sum(m.get("mood_score", 3) for m in moods) / len(moods)
        recent_avg = sum(m.get("mood_score", 3) for m in recent_moods) / len(recent_moods)
        context += f"Overall baseline: {avg_mood:.1f}/5 | Recent week: {recent_avg:.1f}/5\n"
        if len(moods) >= 7 and recent_avg < avg_mood - 0.5:
            context += "** MOOD SHIFT DETECTED: She's been feeling worse than usual recently. Gently check in. **\n"
        elif len(moods) >= 7 and recent_avg > avg_mood + 0.5:
            context += "** POSITIVE SHIFT: She's been doing better lately! Celebrate this. **\n"
        # Check for notes on moods
        noted_moods = [m for m in recent_moods if m.get("note")]
        if noted_moods:
            context += "Mood notes: " + "; ".join([f"{m['mood_label']}: \"{m['note']}\"" for m in noted_moods[:3]]) + "\n"

    # Journal entries with content
    if journals:
        context += "\n[HER RECENT JOURNAL ENTRIES]\n"
        for j in journals[:3]:
            content_preview = (j.get("content", "")[:150] + "...") if len(j.get("content", "")) > 150 else j.get("content", "")
            context += f"- \"{j.get('title', 'Untitled')}\" (mood: {j.get('mood', 'unset')}, {j.get('created_at', '')[:10]}): {content_preview}\n"

    # Upcoming events
    if events:
        context += "\n[HER UPCOMING SCHEDULE]\n"
        for e in events[:7]:
            context += f"- {e.get('title', '?')} on {e.get('start_time', '')[:10]} ({e.get('event_type', 'general')})\n"

    # Past conversation topics
    if convos:
        topics = ", ".join([f"\"{c.get('title', 'Untitled')}\" ({c.get('created_at', '')[:10]})" for c in convos])
        context += f"\n[PAST CONVERSATION TOPICS]\n{topics}\n"

    # Current day context
    context += f"\n[TODAY]\nCurrent date/time: {now.strftime('%A, %B %d, %Y at %I:%M %p')} UTC\n"

    # Load current conversation history
    if conversation_id:
        conv = await db.conversations.find_one(
            {"conversation_id": conversation_id, "user_id": user_id}, {"_id": 0}
        )
        if conv and conv.get("messages"):
            context += "\n[THIS CONVERSATION SO FAR]\n"
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
    return {"user_id": user_id, "email": email, "name": name, "picture": picture, "session_token": session_token}


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
    try:
        willow_response = await chat.send_message(user_message)
    except Exception as e:
        logger.error(f"Willow AI error: {e}")
        willow_response = "I'm sorry, I'm having a little moment right now. Could you try again in a minute? I'm still here for you."

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

    # Fire-and-forget: extract profile info from this exchange
    asyncio.create_task(extract_and_update_profile(user_id, body.message, willow_response))

    return {"conversation_id": conversation_id, "willow_response": willow_response, "conversation_title": title}


# ─── User Profile Route (What Willow Knows) ───

@api_router.get("/profile/willow-memory")
async def get_willow_memory(user: dict = Depends(get_current_user)):
    """Returns what Willow remembers about this user — for transparency."""
    profile = await db.user_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0, "user_id": 0})
    if not profile:
        return {"has_profile": False, "message": "Willow is still getting to know you! The more you chat, the better she'll remember."}
    profile["has_profile"] = True
    return profile


@api_router.put("/profile/willow-memory")
async def update_willow_memory(request: Request, user: dict = Depends(get_current_user)):
    """Allows user to edit what Willow remembers about them."""
    body = await request.json()
    allowed_fields = ["preferred_name", "children", "family_situation", "schedule",
                      "triggers", "preferences", "key_facts", "goals", "wins"]
    updates = {k: v for k, v in body.items() if k in allowed_fields}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.user_profiles.update_one(
        {"user_id": user["user_id"]},
        {"$set": updates},
        upsert=True
    )
    profile = await db.user_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0, "user_id": 0})
    profile["has_profile"] = True
    return profile


@api_router.delete("/profile/willow-memory")
async def clear_willow_memory(request: Request, user: dict = Depends(get_current_user)):
    """Clear specific field or entire memory."""
    body = await request.json()
    field = body.get("field")
    if field:
        allowed = ["preferred_name", "children", "family_situation", "schedule",
                    "triggers", "preferences", "key_facts", "goals", "wins"]
        if field not in allowed:
            raise HTTPException(status_code=400, detail="Invalid field")
        await db.user_profiles.update_one(
            {"user_id": user["user_id"]},
            {"$unset": {field: ""}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.user_profiles.delete_one({"user_id": user["user_id"]})
    profile = await db.user_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0, "user_id": 0})
    if not profile:
        return {"has_profile": False}
    profile["has_profile"] = True
    return profile


# ─── Calm Corner Activities ───

CALM_CORNER_ACTIVITIES = [
    {
        "id": "cold_sensation",
        "title": "Cold Sensation Reset",
        "category": "grounding",
        "duration": "30 sec",
        "description": "Place something cold on your wrists or temples — an ice cube, cold water, a frozen spoon. Close your eyes and sit with the feeling for 30 seconds. Focus only on the cold.",
        "steps": [
            "Find something cold — ice cube, cold water on a cloth, frozen spoon, or even a cold can from the fridge",
            "Place it gently on the inside of your wrists or your temples",
            "Close your eyes and breathe normally",
            "Focus all your attention on the cold sensation — how it feels, how it spreads",
            "Stay with it for 30 seconds. Let everything else fade."
        ],
        "when": "When your mind is racing and you need to snap out of a spiral"
    },
    {
        "id": "five_senses_countdown",
        "title": "5-4-3-2-1 Countdown",
        "category": "grounding",
        "duration": "1 min",
        "description": "Name 5 things you see, 4 you hear, 3 you can touch, 2 you smell, 1 you taste. A classic grounding technique that takes about 60 seconds.",
        "steps": [
            "Pause wherever you are. You don't need to close your eyes.",
            "Name 5 things you can SEE — really look at them",
            "Name 4 things you can HEAR — even tiny sounds",
            "Name 3 things you can TOUCH — feel the textures",
            "Name 2 things you can SMELL",
            "Name 1 thing you can TASTE"
        ],
        "when": "When you feel disconnected or panicky — this brings you back to the present"
    },
    {
        "id": "three_senses",
        "title": "3 Senses Check",
        "category": "grounding",
        "duration": "30 sec",
        "description": "Stop and name three things in the room you can see, smell, touch, or hear. A quick awareness reset.",
        "steps": [
            "Stop what you're doing for just a moment",
            "Look around and name one thing you can see — really notice it",
            "Listen and name one thing you can hear",
            "Reach out and touch something — name what it feels like",
            "Take one deep breath. You're here. You're okay."
        ],
        "when": "When you only have 30 seconds but need a quick mental reset"
    },
    {
        "id": "beauty_spotting",
        "title": "Beauty Spotting",
        "category": "grounding",
        "duration": "1-2 min",
        "description": "Find something nearby that's beautiful or interesting. Really look at it — notice its shape, color, texture, the small details you'd normally miss.",
        "steps": [
            "Look around and find one thing that catches your eye — something beautiful, interesting, or that you normally overlook",
            "Focus on it completely. Notice its shape first.",
            "Now notice its color — the variations, the way light hits it",
            "Look at the texture, the small details",
            "Take it all in. This one thing exists, and so do you."
        ],
        "when": "When everything feels heavy and you need a moment of lightness"
    },
    {
        "id": "tactile_focus",
        "title": "Tactile Focus",
        "category": "grounding",
        "duration": "30 sec",
        "description": "Run your thumb slowly across your fingertips. Notice the ridges, the warmth, the tiny details of how they feel.",
        "steps": [
            "Hold one hand in front of you",
            "Slowly run your thumb across each fingertip on that hand",
            "Notice the ridges of your fingerprints, the warmth between your fingers",
            "Press your thumb and forefinger together gently — feel the ridges meeting",
            "Focus only on this sensation for 30 seconds. Nothing else matters right now."
        ],
        "when": "When you're in public and need to ground yourself without anyone noticing"
    },
    {
        "id": "box_breathing",
        "title": "Box Breathing",
        "category": "breathing",
        "duration": "2 min",
        "description": "Breathe in 4 seconds, hold 4, out 4, hold 4. Repeat 3-4 times. Used by Navy SEALs to stay calm under pressure.",
        "steps": [
            "Sit or stand comfortably. Exhale all your air out.",
            "Breathe IN slowly for 4 seconds",
            "HOLD your breath for 4 seconds",
            "Breathe OUT slowly for 4 seconds",
            "HOLD (empty) for 4 seconds",
            "Repeat 3-4 times. You'll feel the shift."
        ],
        "when": "When you need to calm down but have a couple minutes",
        "guided": True
    },
    {
        "id": "four_seven_eight",
        "title": "4-7-8 Breathing",
        "category": "breathing",
        "duration": "2 min",
        "description": "Inhale 4 seconds, hold 7, exhale slowly for 8. Activates your parasympathetic nervous system — your body's built-in calm-down switch.",
        "steps": [
            "Place the tip of your tongue behind your top front teeth",
            "Exhale completely through your mouth",
            "Inhale quietly through your nose for 4 seconds",
            "Hold your breath for 7 seconds",
            "Exhale completely through your mouth for 8 seconds",
            "Repeat 3-4 times."
        ],
        "when": "Before bed when your mind won't stop, or during intense anxiety"
    },
    {
        "id": "physiological_sigh",
        "title": "Physiological Sigh",
        "category": "breathing",
        "duration": "10 sec",
        "description": "Two quick inhales through the nose, then one long exhale through the mouth. The fastest scientifically-proven way to calm down.",
        "steps": [
            "Take a quick inhale through your nose",
            "Immediately take a second, shorter inhale on top of it (double inhale)",
            "Now exhale slowly and completely through your mouth",
            "That's it. One cycle. You can repeat 2-3 times if needed."
        ],
        "when": "When you're about to lose it and have literally 10 seconds"
    },
    {
        "id": "shake_it_off",
        "title": "Shake It Off",
        "category": "physical",
        "duration": "30 sec",
        "description": "Literally shake your hands, arms, and shoulders for 30 seconds. Animals do this after a stressful encounter — it releases the tension your body is holding.",
        "steps": [
            "Stand up if you can (sitting works too)",
            "Start shaking your hands loosely, like you're flicking water off them",
            "Let it move up to your arms — shake them out",
            "Shake your shoulders, let your whole upper body loosen",
            "If you can, bounce a little on your feet. Shake your legs.",
            "30 seconds. Let your body release what it's holding."
        ],
        "when": "When you feel physically tense, agitated, or wound up tight"
    },
    {
        "id": "butterfly_tap",
        "title": "Butterfly Tap",
        "category": "physical",
        "duration": "1-2 min",
        "description": "Cross your arms over your chest and alternate tapping your shoulders slowly and rhythmically. This is a real EMDR-based self-soothing technique used by therapists.",
        "steps": [
            "Cross your arms over your chest, each hand resting on the opposite shoulder",
            "Close your eyes or soften your gaze",
            "Start tapping your shoulders alternately — left, right, left, right",
            "Keep a slow, steady rhythm. Like a heartbeat.",
            "Breathe naturally. Focus on the rhythm of the tapping.",
            "Continue for 1-2 minutes. Let your nervous system settle."
        ],
        "when": "When you can't sleep, when you're crying, or when you need to feel held"
    },
    {
        "id": "body_scan_squeeze",
        "title": "Body Scan Squeeze",
        "category": "physical",
        "duration": "2 min",
        "description": "Squeeze your fists tight for 5 seconds, then release and notice the warmth spreading. Move through your body — fists, shoulders, toes.",
        "steps": [
            "Start with your hands — make tight fists, squeeze for 5 seconds",
            "Release. Notice the warmth and tingling in your fingers.",
            "Now scrunch your shoulders up to your ears, hold 5 seconds",
            "Release. Feel them drop. Notice how different that feels.",
            "Curl your toes tight, hold 5 seconds",
            "Release. Feel the relief spread through your body."
        ],
        "when": "When your body is holding tension and you need a physical release"
    },
    {
        "id": "mini_coloring",
        "title": "Mini Coloring",
        "category": "creative",
        "duration": "3-5 min",
        "description": "Simple patterns you can color right on your phone. No talent required — just pick colors and fill in spaces. Let your brain switch off for a few minutes.",
        "steps": [
            "Pick a pattern that appeals to you",
            "Choose any color that feels right — there are no rules here",
            "Tap to fill in the spaces, one at a time",
            "Don't rush. There's no goal. Just color.",
            "Even 2-3 minutes of this can quiet a racing mind."
        ],
        "when": "When you need to zone out for a few minutes and give your brain a break",
        "interactive": True
    },
    {
        "id": "asmr_moment",
        "title": "ASMR Moment",
        "category": "sensory",
        "duration": "1-2 min",
        "description": "Short calming sounds — rain, crackling fire, soft whispers, ocean waves. Put in earbuds and let your nervous system settle for just a minute or two.",
        "steps": [
            "Put in earbuds if you can, or play softly on your phone",
            "Pick a sound that appeals to you — rain, fire, ocean, or whispers",
            "Close your eyes and just listen",
            "Let the sound fill your awareness. Nothing else matters for the next minute.",
            "Breathe naturally. Let your shoulders drop."
        ],
        "when": "When you need to escape for a moment — in the car, in the bathroom, after bedtime",
        "interactive": True
    }
]

CALM_CATEGORIES = [
    {"id": "grounding", "label": "Grounding", "description": "Come back to the present moment", "color": "#10B981"},
    {"id": "breathing", "label": "Breathing", "description": "Activate your body's calm-down switch", "color": "#4E9FE5"},
    {"id": "physical", "label": "Physical Reset", "description": "Release tension your body is holding", "color": "#FF715B"},
    {"id": "creative", "label": "Creative", "description": "Give your brain a break", "color": "#8B5CF6"},
    {"id": "sensory", "label": "Sensory", "description": "Soothe through sound and sensation", "color": "#FFB627"},
]


@api_router.get("/calm-corner/activities")
async def get_calm_activities():
    return {"activities": CALM_CORNER_ACTIVITIES, "categories": CALM_CATEGORIES}


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
    try:
        response = await chat.send_message(UserMessage(text="Generate 3 journaling prompts for me today."))
        prompts = [line.strip() for line in response.strip().split("\n") if line.strip()]
        return {"prompts": prompts[:3]}
    except Exception as e:
        logger.error(f"Journal prompts AI error: {e}")
        return {"prompts": [
            "1. What's one small thing that made you smile today?",
            "2. Write about a moment this week when you felt proud of yourself as a mom.",
            "3. If you could tell your future self one thing right now, what would it be?"
        ]}


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

    # Get referee names in batch
    referee_ids = [ref["referee_user_id"] for ref in referrals]
    referees = {}
    if referee_ids:
        referee_docs = await db.users.find({"user_id": {"$in": referee_ids}}, {"_id": 0, "user_id": 1, "name": 1}).to_list(len(referee_ids))
        referees = {doc["user_id"]: doc.get("name", "A mom") for doc in referee_docs}

    referral_details = []
    for ref in referrals:
        referral_details.append({
            "name": referees.get(ref["referee_user_id"], "A mom"),
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

    # Subscription breakdown via aggregation (no full collection load)
    now_iso = now.isoformat()
    sub_pipeline = [
        {"$project": {
            "_id": 0,
            "status": {
                "$cond": [
                    {"$and": [
                        {"$ne": [{"$ifNull": ["$trial_end", ""]}, ""]},
                        {"$gt": [{"$ifNull": ["$trial_end", ""]}, now_iso]}
                    ]},
                    "trial",
                    {"$cond": [
                        {"$and": [
                            {"$ne": [{"$ifNull": ["$subscription_end", ""]}, ""]},
                            {"$gt": [{"$ifNull": ["$subscription_end", ""]}, now_iso]}
                        ]},
                        "active",
                        "free"
                    ]}
                ]
            }
        }},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    sub_results = await db.users.aggregate(sub_pipeline).to_list(10)
    sub_counts = {r["_id"]: r["count"] for r in sub_results}
    trial_count = sub_counts.get("trial", 0)
    active_count = sub_counts.get("active", 0)
    free_count = sub_counts.get("free", 0)

    # Revenue via aggregation (no full collection load)
    rev_pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    rev_results = await db.payment_transactions.aggregate(rev_pipeline).to_list(1)
    total_revenue = rev_results[0]["total"] if rev_results else 0
    total_paid_count = rev_results[0]["count"] if rev_results else 0

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
            "total_transactions": total_paid_count
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
    if secret != os.environ.get("ADMIN_SECRET", ""):
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
