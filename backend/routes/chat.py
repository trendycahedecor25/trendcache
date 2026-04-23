from fastapi import APIRouter, HTTPException, Depends
import os
import uuid
import asyncio
import logging
from datetime import datetime, timezone
from database import db
from helpers.auth import get_current_user
from helpers.subscription import get_subscription_info, get_daily_chat_count, FREE_DAILY_CHAT_LIMIT
from helpers.willow import build_willow_context, extract_and_update_profile
from models import ChatMessageRequest
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/chat/conversations")
async def list_conversations(user: dict = Depends(get_current_user)):
    convos = await db.conversations.find(
        {"user_id": user["user_id"]},
        {"_id": 0, "conversation_id": 1, "title": 1, "created_at": 1, "updated_at": 1}
    ).sort("updated_at", -1).to_list(50)
    return convos


@router.post("/chat/conversations")
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


@router.get("/chat/conversations/{conversation_id}/messages")
async def get_conversation_messages(conversation_id: str, user: dict = Depends(get_current_user)):
    conv = await db.conversations.find_one(
        {"conversation_id": conversation_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"conversation_id": conversation_id, "title": conv.get("title", ""), "messages": conv.get("messages", [])}


@router.post("/chat/message")
async def send_chat_message(body: ChatMessageRequest, user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    conversation_id = body.conversation_id
    now = datetime.now(timezone.utc).isoformat()

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

    system_prompt = await build_willow_context(user_id, conversation_id)

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

    user_msg = {"role": "user", "content": body.message, "timestamp": now}
    assistant_msg = {"role": "assistant", "content": willow_response, "timestamp": now}

    await db.conversations.update_one(
        {"conversation_id": conversation_id, "user_id": user_id},
        {
            "$push": {"messages": {"$each": [user_msg, assistant_msg]}},
            "$set": {"updated_at": now}
        }
    )

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

    asyncio.create_task(extract_and_update_profile(user_id, body.message, willow_response))

    return {"conversation_id": conversation_id, "willow_response": willow_response, "conversation_title": title}
