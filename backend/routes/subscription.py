from fastapi import APIRouter, HTTPException, Request, Depends
import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from database import db
from helpers.auth import get_current_user
from helpers.subscription import get_subscription_info, MONTHLY_PRICE
from models import CheckoutRequest
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/subscribe/info")
async def get_subscription(user: dict = Depends(get_current_user)):
    sub_info = await get_subscription_info(user["user_id"])
    return sub_info


@router.post("/subscribe/checkout")
async def create_checkout(body: CheckoutRequest, request: Request, user: dict = Depends(get_current_user)):
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/dashboard?session_id={{CHECKOUT_SESSION_ID}}&payment=success"
    cancel_url = f"{origin}/pricing"

    checkout_request = CheckoutSessionRequest(
        amount=MONTHLY_PRICE,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user["user_id"],
            "plan": "monthly",
            "email": user.get("email", "")
        }
    )

    session = await stripe_checkout.create_checkout_session(checkout_request)

    await db.payment_transactions.insert_one({
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "session_id": session.session_id,
        "amount": MONTHLY_PRICE,
        "currency": "usd",
        "status": "initiated",
        "payment_status": "pending",
        "metadata": {"plan": "monthly"},
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    return {"url": session.url, "session_id": session.session_id}


@router.get("/subscribe/status/{session_id}")
async def check_payment_status(session_id: str, request: Request, user: dict = Depends(get_current_user)):
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    status = await stripe_checkout.get_checkout_status(session_id)

    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if txn and txn.get("payment_status") != "paid" and status.payment_status == "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "completed", "payment_status": "paid"}}
        )
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {
                "subscription_end": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
                "subscription_status": "active"
            }}
        )
    elif txn and status.payment_status != "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": status.status, "payment_status": status.payment_status}}
        )

    return {"status": status.status, "payment_status": status.payment_status}


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    body = await request.body()
    signature = request.headers.get("Stripe-Signature")

    try:
        event = await stripe_checkout.handle_webhook(body, signature)
        if event.session_id:
            txn = await db.payment_transactions.find_one({"session_id": event.session_id}, {"_id": 0})
            if txn and txn.get("payment_status") != "paid" and event.payment_status == "paid":
                await db.payment_transactions.update_one(
                    {"session_id": event.session_id},
                    {"$set": {"status": "completed", "payment_status": "paid"}}
                )
                await db.users.update_one(
                    {"user_id": txn["user_id"]},
                    {"$set": {
                        "subscription_end": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
                        "subscription_status": "active"
                    }}
                )
            elif txn:
                await db.payment_transactions.update_one(
                    {"session_id": event.session_id},
                    {"$set": {"status": event.event_type, "payment_status": event.payment_status}}
                )
    except Exception as e:
        logger.error(f"Webhook error: {e}")

    return {"status": "ok"}
