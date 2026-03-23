"""Auth routes: email/password signup + login + Google OAuth."""

import json
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel

from app.config import settings
from app.schemas import UserPreferences
from app.services.user_service import (
    create_user,
    find_user_by_email,
    find_user_by_token,
    update_user,
    verify_password,
)

router = APIRouter()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


class SignupRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    user_id: str
    token: str
    email: str
    plan: str
    prompts_used: int
    prompts_limit: int
    is_admin: bool
    preferences: UserPreferences


def _to_response(user: dict) -> UserResponse:
    plan = user.get("plan", "free")
    limit = settings.free_prompts_limit if plan == "free" else -1
    prefs = user.get("preferences") or {}
    return UserResponse(
        user_id=user["user_id"],
        token=user["token"],
        email=user["email"],
        plan=plan,
        prompts_used=int(user.get("prompts_used", 0)),
        prompts_limit=limit,
        is_admin=user.get("email", "").lower() in settings.admin_email_set,
        preferences=UserPreferences(theme=prefs.get("theme") or "light"),
    )


@router.post("/api/auth/signup", response_model=UserResponse)
async def signup(body: SignupRequest):
    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=422, detail="Valid email required")
    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    existing = await find_user_by_email(email)
    if existing:
        # Legacy email-only users: let them set a password on first signup attempt
        if not existing.get("password_hash"):
            from app.services.user_service import hash_password
            updated = await update_user(existing["user_id"], password_hash=hash_password(body.password))
            return _to_response(updated or existing)
        raise HTTPException(status_code=409, detail="An account with this email already exists. Please log in.")

    user = await create_user(email, password=body.password)
    return _to_response(user)


@router.post("/api/auth/login", response_model=UserResponse)
async def login(body: LoginRequest):
    email = body.email.strip().lower()
    if not email or not body.password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    user = await find_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    if not verify_password(user, body.password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    return _to_response(user)


@router.get("/api/auth/me", response_model=UserResponse)
async def get_me(x_user_token: str = Header(None)):
    if not x_user_token:
        raise HTTPException(status_code=401, detail="Missing token")
    user = await find_user_by_token(x_user_token)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _to_response(user)


@router.get("/api/auth/google")
async def oauth_google():
    if not settings.google_client_id:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")
    callback_url = f"{settings.domain_server}/api/auth/google/callback"
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": callback_url,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    return RedirectResponse(url=f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/api/auth/google/callback")
async def oauth_google_callback(code: str = None, error: str = None):
    client_error_url = f"{settings.domain_client}/?auth_error="

    if error or not code:
        return RedirectResponse(url=f"{client_error_url}oauth_cancelled")

    callback_url = f"{settings.domain_server}/api/auth/google/callback"

    async with httpx.AsyncClient() as http:
        token_resp = await http.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": callback_url,
            "grant_type": "authorization_code",
        })
        if token_resp.status_code != 200:
            return RedirectResponse(url=f"{client_error_url}token_exchange_failed")

        google_access_token = token_resp.json().get("access_token")

        userinfo_resp = await http.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {google_access_token}"},
        )
        if userinfo_resp.status_code != 200:
            return RedirectResponse(url=f"{client_error_url}userinfo_failed")

    userinfo = userinfo_resp.json()
    email = userinfo.get("email", "").lower()
    name = userinfo.get("name", email)
    picture = userinfo.get("picture", "")

    if not email:
        return RedirectResponse(url=f"{client_error_url}no_email")

    user = await find_user_by_email(email)
    if user is None:
        user = await create_user(email, provider="google", name=name, avatar=picture)

    token = user["token"]
    redirect_url = f"{settings.domain_client}/?sso_token={token}"
    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>Signing in…</title></head>
<body>
<script>
  try {{ localStorage.setItem('cmodog_token', {json.dumps(token)}); }} catch(e) {{}}
  window.location.replace({json.dumps(redirect_url)});
</script>
<noscript><a href="{redirect_url}">Continue</a></noscript>
</body></html>"""
    return HTMLResponse(content=html)
