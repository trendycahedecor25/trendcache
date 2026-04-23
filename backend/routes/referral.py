from fastapi import APIRouter, Depends
from database import db
from helpers.auth import get_current_user
from helpers.subscription import REFERRAL_REWARD_DAYS

router = APIRouter()


@router.get("/referral/info")
async def get_referral_info(user: dict = Depends(get_current_user)):
    referral_code = user.get("referral_code", "")
    referral_count = user.get("referral_count", 0)
    referrals = await db.referrals.find(
        {"referrer_user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)

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
