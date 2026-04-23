from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from database import db
from helpers.auth import get_current_user
from models import MoodEntryCreate
import uuid

router = APIRouter()


@router.post("/mood")
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


@router.get("/mood")
async def get_mood_history(days: int = 30, user: dict = Depends(get_current_user)):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    entries = await db.mood_entries.find(
        {"user_id": user["user_id"], "created_at": {"$gte": cutoff}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return entries


@router.get("/mood/insights")
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
