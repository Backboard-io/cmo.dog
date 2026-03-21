"""Admin routes — list and manage users. Restricted to ADMIN_EMAILS."""

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.config import settings
from app.services.user_service import _all_user_memories, find_user_by_token, update_user

router = APIRouter()

SAFE_FIELDS = {
    "user_id", "email", "name", "avatar", "plan", "prompts_used",
    "provider", "stripe_customer_id", "stripe_subscription_id",
}


async def _require_admin(token: Optional[str]) -> None:
    if not settings.admin_email_set:
        raise HTTPException(status_code=503, detail="Admin not configured — set ADMIN_EMAILS")
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    user = await find_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    if user.get("email", "").lower() not in settings.admin_email_set:
        raise HTTPException(status_code=403, detail="Forbidden")


def _safe_user(u: dict) -> dict:
    return {k: v for k, v in u.items() if k in SAFE_FIELDS}


class PatchUserRequest(BaseModel):
    plan: Optional[str] = None
    prompts_used: Optional[int] = None


@router.get("/api/admin/users")
async def list_users(x_user_token: str = Header(None)):
    await _require_admin(x_user_token)
    users = await _all_user_memories()
    return {"users": [_safe_user(u) for u in users]}


@router.patch("/api/admin/users/{user_id}")
async def patch_user(user_id: str, body: PatchUserRequest, x_user_token: str = Header(None)):
    await _require_admin(x_user_token)
    fields = body.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Nothing to update")
    updated = await update_user(user_id, **fields)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return _safe_user(updated)
