from fastapi import APIRouter, HTTPException, Request, Depends
import os
from datetime import datetime, timezone, timedelta
from database import db
from helpers.auth import require_admin

router = APIRouter()


async def _get_user_stats(now: datetime) -> dict:
    today_str = now.strftime("%Y-%m-%d")
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()
    return {
        "total": await db.users.count_documents({}),
        "new_today": await db.users.count_documents({"created_at": {"$regex": f"^{today_str}"}}),
        "new_this_week": await db.users.count_documents({"created_at": {"$gte": week_ago}}),
        "new_this_month": await db.users.count_documents({"created_at": {"$gte": month_ago}}),
    }


async def _get_subscription_breakdown(now_iso: str) -> dict:
    pipeline = [
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
    results = await db.users.aggregate(pipeline).to_list(10)
    counts = {r["_id"]: r["count"] for r in results}
    return {"trial": counts.get("trial", 0), "active_premium": counts.get("active", 0), "free": counts.get("free", 0)}


async def _get_revenue_stats() -> dict:
    pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    results = await db.payment_transactions.aggregate(pipeline).to_list(1)
    if results:
        return {"total": round(results[0]["total"], 2), "total_transactions": results[0]["count"]}
    return {"total": 0, "total_transactions": 0}


async def _get_engagement_stats() -> dict:
    return {
        "conversations": await db.conversations.count_documents({}),
        "journal_entries": await db.journal_entries.count_documents({}),
        "mood_entries": await db.mood_entries.count_documents({}),
        "calendar_events": await db.calendar_events.count_documents({}),
    }


@router.get("/admin/analytics")
async def get_analytics(user: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc)
    month_ago = (now - timedelta(days=30)).isoformat()

    user_stats = await _get_user_stats(now)
    sub_breakdown = await _get_subscription_breakdown(now.isoformat())
    revenue = await _get_revenue_stats()
    engagement = await _get_engagement_stats()

    total_referrals = await db.referrals.count_documents({})
    referrals_this_month = await db.referrals.count_documents({"created_at": {"$gte": month_ago}})

    recent_users = await db.users.find(
        {}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "created_at": 1, "subscription_status": 1, "referral_count": 1}
    ).sort("created_at", -1).limit(20).to_list(20)

    top_referrers = await db.users.find(
        {"referral_count": {"$gt": 0}},
        {"_id": 0, "name": 1, "email": 1, "referral_count": 1}
    ).sort("referral_count", -1).limit(10).to_list(10)

    return {
        "users": {**user_stats, **sub_breakdown},
        "revenue": revenue,
        "referrals": {"total": total_referrals, "this_month": referrals_this_month, "top_referrers": top_referrers},
        "engagement": engagement,
        "recent_signups": recent_users,
    }


@router.post("/admin/set-admin")
async def set_admin_by_email(request: Request):
    body = await request.json()
    email = body.get("email")
    secret = body.get("secret")
    if secret != os.environ.get("ADMIN_SECRET", ""):
        raise HTTPException(status_code=403, detail="Invalid secret")
    result = await db.users.update_one({"email": email}, {"$set": {"is_admin": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": f"Admin access granted to {email}"}
