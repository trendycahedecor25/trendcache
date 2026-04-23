from fastapi import APIRouter, HTTPException, Request, Response, Depends
import uuid
import httpx
from datetime import datetime, timezone, timedelta
from database import db
from helpers.auth import get_current_user
from helpers.subscription import get_subscription_info, generate_referral_code, TRIAL_DAYS, REFERRAL_REWARD_DAYS
from models import SessionExchange

router = APIRouter()


@router.post("/auth/session")
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

        if body.referral_code:
            referrer = await db.users.find_one({"referral_code": body.referral_code}, {"_id": 0})
            if referrer and referrer["user_id"] != user_id:
                now = datetime.now(timezone.utc)
                new_end = (now + timedelta(days=TRIAL_DAYS + REFERRAL_REWARD_DAYS)).isoformat()
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$set": {"trial_end": new_end, "referred_by": referrer["user_id"]}}
                )
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


@router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    sub_info = await get_subscription_info(user["user_id"])
    return {
        **user,
        "subscription": sub_info,
        "referral_code": user.get("referral_code", ""),
        "referral_count": user.get("referral_count", 0),
        "is_admin": user.get("is_admin", False)
    }


@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/", secure=True, samesite="none")
    return {"message": "Logged out"}
