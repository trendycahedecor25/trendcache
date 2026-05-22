from fastapi import APIRouter, HTTPException, Request, Response, Depends
import uuid
import httpx
from datetime import datetime, timezone, timedelta
from database import db
from helpers.auth import get_current_user
from helpers.subscription import get_subscription_info, generate_referral_code, TRIAL_DAYS, REFERRAL_REWARD_DAYS
from models import SessionExchange

router = APIRouter()


def _parse_datetime(val) -> datetime:
    """Parse a datetime value that may be string or datetime object."""
    if isinstance(val, str):
        val = datetime.fromisoformat(val)
    if val.tzinfo is None:
        val = val.replace(tzinfo=timezone.utc)
    return val


async def _create_new_user(email: str, name: str, picture: str) -> str:
    """Create a new user account with unique referral code. Returns user_id."""
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    referral_code = generate_referral_code()
    while await db.users.find_one({"referral_code": referral_code}):
        referral_code = generate_referral_code()

    await db.users.insert_one({
        "user_id": user_id, "email": email, "name": name, "picture": picture,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "trial_end": (datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS)).isoformat(),
        "subscription_status": "trial", "referral_code": referral_code,
        "referred_by": None, "referral_count": 0, "is_admin": False,
    })
    return user_id


async def _process_referral(user_id: str, referral_code: str):
    """Process a referral code: extend both referee's trial and referrer's subscription."""
    referrer = await db.users.find_one({"referral_code": referral_code}, {"_id": 0})
    if not referrer or referrer["user_id"] == user_id:
        return

    now = datetime.now(timezone.utc)

    # Extend referee's trial
    new_trial = (now + timedelta(days=TRIAL_DAYS + REFERRAL_REWARD_DAYS)).isoformat()
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"trial_end": new_trial, "referred_by": referrer["user_id"]}}
    )

    # Extend referrer's subscription
    referrer_end = referrer.get("subscription_end") or referrer.get("trial_end")
    if referrer_end:
        referrer_end = _parse_datetime(referrer_end)
        if referrer_end < now:
            referrer_end = now
    else:
        referrer_end = now

    new_referrer_end = (referrer_end + timedelta(days=REFERRAL_REWARD_DAYS)).isoformat()
    await db.users.update_one(
        {"user_id": referrer["user_id"]},
        {"$set": {"subscription_end": new_referrer_end, "subscription_status": "active"},
         "$inc": {"referral_count": 1}}
    )

    # Record the referral
    await db.referrals.insert_one({
        "referral_id": f"ref_{uuid.uuid4().hex[:12]}",
        "referrer_user_id": referrer["user_id"],
        "referee_user_id": user_id,
        "referral_code": referral_code,
        "created_at": now.isoformat(),
    })


async def _create_session(user_id: str, session_token: str):
    """Store session in DB and return cookie max-age."""
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


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
    email, name, picture = data["email"], data.get("name", ""), data.get("picture", "")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"email": email}, {"$set": {"name": name, "picture": picture}})
    else:
        user_id = await _create_new_user(email, name, picture)
        if body.referral_code:
            await _process_referral(user_id, body.referral_code)

    await _create_session(user_id, session_token)

    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none",
        path="/", max_age=7 * 24 * 3600,
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
        "is_admin": user.get("is_admin", False),
    }


@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/", secure=True, samesite="none")
    return {"message": "Logged out"}
