"""User preferences routes."""

from fastapi import APIRouter, Header, HTTPException

from app.schemas import UserPreferences
from app.services.user_service import find_user_by_token, update_user

router = APIRouter()


@router.get("/api/users/preferences", response_model=UserPreferences)
async def get_preferences(x_user_token: str = Header(None)):
    if not x_user_token:
        raise HTTPException(status_code=401, detail="Authentication required")
    user = await find_user_by_token(x_user_token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    prefs = user.get("preferences") or {}
    return UserPreferences(theme=prefs.get("theme") or "light")


@router.put("/api/users/preferences", response_model=UserPreferences)
async def update_preferences(body: UserPreferences, x_user_token: str = Header(None)):
    if not x_user_token:
        raise HTTPException(status_code=401, detail="Authentication required")
    user = await find_user_by_token(x_user_token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    prefs = user.get("preferences") or {}
    prefs.update(body.model_dump())
    updated = await update_user(user["user_id"], preferences=prefs)
    stored = (updated or user).get("preferences") or prefs
    return UserPreferences(theme=stored.get("theme") or "light")

