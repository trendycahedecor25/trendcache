from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
import uuid
from datetime import datetime, timezone
from database import db
from helpers.auth import get_current_user
from models import CalendarEventCreate, CalendarEventUpdate

router = APIRouter()


@router.get("/calendar/events")
async def list_events(month: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"user_id": user["user_id"]}
    if month:
        query["start_time"] = {"$regex": f"^{month}"}
    events = await db.calendar_events.find(query, {"_id": 0}).sort("start_time", 1).to_list(200)
    return events


@router.post("/calendar/events")
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


@router.put("/calendar/events/{event_id}")
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


@router.delete("/calendar/events/{event_id}")
async def delete_event(event_id: str, user: dict = Depends(get_current_user)):
    result = await db.calendar_events.delete_one({"event_id": event_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Deleted"}
