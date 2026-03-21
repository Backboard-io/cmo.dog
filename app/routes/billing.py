"""Billing routes: Stripe checkout, portal, webhook."""

import stripe
from fastapi import APIRouter, Header, HTTPException, Request

from app.config import settings
from app.services.user_service import (
    find_user_by_id,
    find_user_by_stripe_customer_id,
    find_user_by_token,
    update_user,
)

router = APIRouter()

stripe.api_key = settings.stripe_secret_key


class SubscriptionResponse:
    pass


@router.post("/api/billing/checkout")
async def create_checkout(x_user_token: str = Header(None)):
    if not x_user_token:
        raise HTTPException(status_code=401, detail="Missing token")

    user = await find_user_by_token(x_user_token)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": settings.stripe_price_id, "quantity": 1}],
            success_url=f"{settings.domain_client}?checkout=success",
            cancel_url=f"{settings.domain_client}?checkout=cancel",
            customer_email=user["email"],
            client_reference_id=user["user_id"],
            metadata={"userId": user["user_id"]},
        )
        return {"url": session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/billing/portal")
async def create_portal(x_user_token: str = Header(None)):
    if not x_user_token:
        raise HTTPException(status_code=401, detail="Missing token")

    user = await find_user_by_token(x_user_token)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    customer_id = user.get("stripe_customer_id", "")
    if not customer_id:
        try:
            customer = stripe.Customer.create(
                email=user["email"],
                metadata={"userId": user["user_id"]},
            )
            customer_id = customer.id
            await update_user(user["user_id"], stripe_customer_id=customer_id)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=settings.domain_client,
        )
        return {"url": session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/billing/subscription")
async def get_subscription(x_user_token: str = Header(None)):
    if not x_user_token:
        raise HTTPException(status_code=401, detail="Missing token")

    user = await find_user_by_token(x_user_token)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    plan = user.get("plan", "free")
    prompts_used = int(user.get("prompts_used", 0))
    limit = settings.free_prompts_limit if plan == "free" else -1

    return {
        "plan": plan,
        "prompts_used": prompts_used,
        "prompts_limit": limit,
        "prompts_remaining": max(0, limit - prompts_used) if plan == "free" else -1,
    }


@router.post("/api/billing/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event.get("type", "")
    data_obj = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        user_id = data_obj.get("client_reference_id")
        subscription_id = data_obj.get("subscription")
        customer_id = data_obj.get("customer")
        if user_id:
            user = await find_user_by_id(user_id)
            if user:
                await update_user(
                    user_id,
                    plan="paid",
                    stripe_customer_id=customer_id or "",
                    stripe_subscription_id=subscription_id or "",
                )
                print(f"[billing] User {user_id} upgraded to paid plan")

    elif event_type in ("customer.subscription.updated", "customer.subscription.deleted"):
        status = data_obj.get("status", "")
        customer_id = data_obj.get("customer")
        if status in ("canceled", "unpaid", "past_due"):
            user = await find_user_by_stripe_customer_id(customer_id)
            if user:
                await update_user(user["user_id"], plan="free")
                print(f"[billing] Reverted {customer_id} to free plan ({status})")

    return {"received": True}
