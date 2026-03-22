"""User storage backed by Backboard memories."""

import json
import uuid
from typing import Optional

import bcrypt
from backboard import BackboardClient

from app.config import settings

USER_TYPE = "cmodog_user"

_storage_assistant_id: Optional[str] = None


def _get_client() -> BackboardClient:
    return BackboardClient(api_key=settings.backboard_api_key)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(user: dict, password: str) -> bool:
    stored = user.get("password_hash", "")
    if not stored:
        return False
    return bcrypt.checkpw(password.encode(), stored.encode())


async def get_storage_assistant_id() -> str:
    global _storage_assistant_id
    if _storage_assistant_id:
        return _storage_assistant_id

    if settings.backboard_assistant_storage:
        _storage_assistant_id = settings.backboard_assistant_storage
        return _storage_assistant_id

    client = _get_client()
    assistants = await client.list_assistants()
    for a in assistants:
        if a.name == "cmodog-storage":
            _storage_assistant_id = str(a.assistant_id)
            return _storage_assistant_id

    assistant = await client.create_assistant(
        name="cmodog-storage",
        system_prompt="Data storage for cmo.dog users.",
    )
    _storage_assistant_id = str(assistant.assistant_id)
    print(f"[user] Created storage assistant: {_storage_assistant_id}")
    print(f"[user] Add to .env: BACKBOARD_ASSISTANT_STORAGE={_storage_assistant_id}")
    return _storage_assistant_id


async def _all_user_memories() -> list[dict]:
    client = _get_client()
    aid = await get_storage_assistant_id()
    response = await client.get_memories(aid)
    results = []
    for m in response.memories:
        meta = m.metadata or {}
        if meta.get("type") == USER_TYPE:
            try:
                user = json.loads(m.content)
                user["_memory_id"] = str(m.id)
                results.append(user)
            except Exception:
                continue
    return results


async def find_user_by_token(token: str) -> Optional[dict]:
    if not token:
        return None
    client = _get_client()
    aid = await get_storage_assistant_id()
    response = await client.get_memories(aid)
    for m in response.memories:
        meta = m.metadata or {}
        if meta.get("type") == USER_TYPE and meta.get("token") == token:
            try:
                user = json.loads(m.content)
                user["_memory_id"] = str(m.id)
                return user
            except Exception:
                continue
    return None


async def find_user_by_email(email: str) -> Optional[dict]:
    client = _get_client()
    aid = await get_storage_assistant_id()
    response = await client.get_memories(aid)
    for m in response.memories:
        meta = m.metadata or {}
        if meta.get("type") == USER_TYPE and meta.get("email") == email.lower():
            try:
                user = json.loads(m.content)
                user["_memory_id"] = str(m.id)
                return user
            except Exception:
                continue
    return None


async def find_user_by_id(user_id: str) -> Optional[dict]:
    client = _get_client()
    aid = await get_storage_assistant_id()
    response = await client.get_memories(aid)
    for m in response.memories:
        meta = m.metadata or {}
        if meta.get("type") == USER_TYPE and meta.get("user_id") == user_id:
            try:
                user = json.loads(m.content)
                user["_memory_id"] = str(m.id)
                return user
            except Exception:
                continue
    return None


async def find_user_by_stripe_customer_id(customer_id: str) -> Optional[dict]:
    users = await _all_user_memories()
    for u in users:
        if u.get("stripe_customer_id") == customer_id:
            return u
    return None


async def create_user(
    email: str,
    *,
    password: Optional[str] = None,
    provider: str = "email",
    name: str = "",
    avatar: str = "",
) -> dict:
    user_id = uuid.uuid4().hex
    token = uuid.uuid4().hex + uuid.uuid4().hex

    user: dict = {
        "user_id": user_id,
        "email": email.lower(),
        "token": token,
        "provider": provider,
        "name": name,
        "avatar": avatar,
        "plan": "free",
        "prompts_used": 0,
        "stripe_customer_id": "",
        "stripe_subscription_id": "",
    }

    if password:
        user["password_hash"] = hash_password(password)

    client = _get_client()
    aid = await get_storage_assistant_id()
    await client.add_memory(
        assistant_id=aid,
        content=json.dumps(user),
        metadata={
            "type": USER_TYPE,
            "user_id": user_id,
            "token": token,
            "email": email.lower(),
        },
    )
    print(f"[user] Created user {email} ({user_id}) via {provider}")
    return user


async def update_user(user_id: str, **fields) -> Optional[dict]:
    client = _get_client()
    aid = await get_storage_assistant_id()

    # Use _all_user_memories so lookup matches by content JSON (same as list),
    # not just metadata — avoids 404 when metadata.user_id is missing/stale.
    all_users = await _all_user_memories()
    user = next((u for u in all_users if u.get("user_id") == user_id), None)
    if not user:
        return None

    memory_id = user.pop("_memory_id", None)
    user.update(fields)

    await client.update_memory(
        assistant_id=aid,
        memory_id=memory_id,
        content=json.dumps(user),
        metadata={
            "type": USER_TYPE,
            "user_id": user_id,
            "token": user.get("token", ""),
            "email": user.get("email", ""),
        },
    )
    return user


async def delete_user(user_id: str) -> bool:
    client = _get_client()
    aid = await get_storage_assistant_id()
    all_users = await _all_user_memories()
    user = next((u for u in all_users if u.get("user_id") == user_id), None)
    if not user:
        return False
    memory_id = user.get("_memory_id")
    await client.delete_memory(assistant_id=aid, memory_id=memory_id)
    print(f"[user] Deleted user {user.get('email')} ({user_id})")
    return True


async def increment_prompts(user_id: str) -> int:
    user = await find_user_by_id(user_id)
    if not user:
        return 0
    new_count = int(user.get("prompts_used", 0)) + 1
    await update_user(user_id, prompts_used=new_count)
    return new_count


async def get_or_create_user_assistant(user_id: str) -> str:
    """Return the personal Backboard assistant ID for this user, creating it if needed."""
    all_users = await _all_user_memories()
    user = next((u for u in all_users if u.get("user_id") == user_id), None)
    if not user:
        raise ValueError(f"User {user_id} not found")

    existing = user.get("backboard_assistant_id", "")
    if existing:
        return existing

    client = _get_client()
    assistant = await client.create_assistant(
        name=f"cmodog-user-{user_id}",
        system_prompt=(
            "You are a personal CMO assistant. You have memories from the user's website audits, "
            "brand analysis, competitor research, and content strategy. Use this context to give "
            "specific, actionable marketing advice tailored to their site."
        ),
    )
    aid = str(assistant.assistant_id)
    await update_user(user_id, backboard_assistant_id=aid)
    print(f"[user] Created personal assistant for {user_id}: {aid}")
    return aid
