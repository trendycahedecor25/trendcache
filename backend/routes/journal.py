from fastapi import APIRouter, HTTPException, Request, Depends
from datetime import datetime, timezone
from database import db
from helpers.auth import get_current_user
from models import JournalEntryCreate, JournalEntryUpdate
from helpers.subscription import get_subscription_info
from emergentintegrations.llm.chat import LlmChat, UserMessage
import os
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/journal")
async def list_journal_entries(user: dict = Depends(get_current_user)):
    entries = await db.journal_entries.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return entries


@router.post("/journal")
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


@router.put("/journal/{entry_id}")
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


@router.delete("/journal/{entry_id}")
async def delete_journal_entry(entry_id: str, user: dict = Depends(get_current_user)):
    result = await db.journal_entries.delete_one({"entry_id": entry_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Deleted"}


@router.get("/journal/prompts")
async def get_journal_prompts(user: dict = Depends(get_current_user)):
    sub_info = await get_subscription_info(user["user_id"])
    if not sub_info["is_premium"]:
        raise HTTPException(status_code=403, detail="AI journaling prompts are a premium feature. Upgrade to unlock Willow's personalized prompts!")

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
