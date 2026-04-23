import random
import string
from datetime import datetime, timezone, timedelta
from database import db


MONTHLY_PRICE = 4.99
FREE_DAILY_CHAT_LIMIT = 3
TRIAL_DAYS = 7
REFERRAL_REWARD_DAYS = 30


async def get_subscription_info(user_id: str) -> dict:
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        return {"status": "free", "is_premium": False}

    now = datetime.now(timezone.utc)

    trial_end = user.get("trial_end")
    if trial_end:
        if isinstance(trial_end, str):
            trial_end = datetime.fromisoformat(trial_end)
        if trial_end.tzinfo is None:
            trial_end = trial_end.replace(tzinfo=timezone.utc)
        if trial_end > now:
            days_left = (trial_end - now).days
            return {"status": "trial", "is_premium": True, "days_left": days_left, "trial_end": trial_end.isoformat()}

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
