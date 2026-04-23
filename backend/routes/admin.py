from fastapi import APIRouter, HTTPException, Request, Depends
import os
from datetime import datetime, timezone, timedelta
from database import db
from helpers.auth import require_admin

router = APIRouter()


@router.get("/admin/analytics")
async def get_analytics(user: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()

    total_users = await db.users.count_documents({})
    new_today = await db.users.count_documents({"created_at": {"$regex": f"^{today_str}"}})
    new_this_week = await db.users.count_documents({"created_at": {"$gte": week_ago}})
    new_this_month = await db.users.count_documents({"created_at": {"$gte": month_ago}})

    now_iso = now.isoformat()
    sub_pipeline = [
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
    sub_results = await db.users.aggregate(sub_pipeline).to_list(10)
    sub_counts = {r["_id"]: r["count"] for r in sub_results}
    trial_count = sub_counts.get("trial", 0)
    active_count = sub_counts.get("active", 0)
    free_count = sub_counts.get("free", 0)

    rev_pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    rev_results = await db.payment_transactions.aggregate(rev_pipeline).to_list(1)
    total_revenue = rev_results[0]["total"] if rev_results else 0
    total_paid_count = rev_results[0]["count"] if rev_results else 0

    total_referrals = await db.referrals.count_documents({})
    referrals_this_month = await db.referrals.count_documents({"created_at": {"$gte": month_ago}})

    total_conversations = await db.conversations.count_documents({})
    total_journal_entries = await db.journal_entries.count_documents({})
    total_mood_entries = await db.mood_entries.count_documents({})
    total_events = await db.calendar_events.count_documents({})

    recent_users = await db.users.find(
        {}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "created_at": 1, "subscription_status": 1, "referral_count": 1}
    ).sort("created_at", -1).limit(20).to_list(20)

    top_referrers = await db.users.find(
        {"referral_count": {"$gt": 0}},
        {"_id": 0, "name": 1, "email": 1, "referral_count": 1}
    ).sort("referral_count", -1).limit(10).to_list(10)

    return {
        "users": {
            "total": total_users,
            "new_today": new_today,
            "new_this_week": new_this_week,
            "new_this_month": new_this_month,
            "trial": trial_count,
            "active_premium": active_count,
            "free": free_count
        },
        "revenue": {
            "total": round(total_revenue, 2),
            "total_transactions": total_paid_count
        },
        "referrals": {
            "total": total_referrals,
            "this_month": referrals_this_month,
            "top_referrers": top_referrers
        },
        "engagement": {
            "conversations": total_conversations,
            "journal_entries": total_journal_entries,
            "mood_entries": total_mood_entries,
            "calendar_events": total_events
        },
        "recent_signups": recent_users
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
