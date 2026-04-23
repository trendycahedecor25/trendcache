from fastapi import APIRouter, HTTPException, Request, Depends
from datetime import datetime, timezone
from database import db
from helpers.auth import get_current_user

router = APIRouter()


@router.get("/profile/willow-memory")
async def get_willow_memory(user: dict = Depends(get_current_user)):
    profile = await db.user_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0, "user_id": 0})
    if not profile:
        return {"has_profile": False, "message": "Willow is still getting to know you! The more you chat, the better she'll remember."}
    profile["has_profile"] = True
    return profile


@router.put("/profile/willow-memory")
async def update_willow_memory(request: Request, user: dict = Depends(get_current_user)):
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


@router.delete("/profile/willow-memory")
async def clear_willow_memory(request: Request, user: dict = Depends(get_current_user)):
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
