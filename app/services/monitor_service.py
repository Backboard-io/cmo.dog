"""Monitor storage backed by Backboard memories (same storage assistant as users)."""

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from backboard import BackboardClient

from app.config import settings
from app.services.user_service import get_storage_assistant_id

MONITOR_TYPE = "cmodog_monitor"


def _get_client() -> BackboardClient:
    return BackboardClient(api_key=settings.backboard_api_key)


def _next_run_at() -> str:
    return (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()


async def create_monitor(
    user_id: str,
    domain: str,
    notify_email: str,
    track_new_competitors: bool,
) -> dict:
    monitor_id = uuid.uuid4().hex[:16]
    now = datetime.now(timezone.utc).isoformat()

    monitor = {
        "monitor_id": monitor_id,
        "user_id": user_id,
        "domain": domain,
        "notify_email": notify_email,
        "track_new_competitors": track_new_competitors,
        "active": True,
        "created_at": now,
        "next_run_at": _next_run_at(),
    }

    client = _get_client()
    aid = await get_storage_assistant_id()
    await client.add_memory(
        assistant_id=aid,
        content=json.dumps(monitor),
        metadata={
            "type": MONITOR_TYPE,
            "monitor_id": monitor_id,
            "user_id": user_id,
        },
    )
    print(f"[monitor] Created monitor {monitor_id} for user {user_id} → {domain}")
    return monitor


async def list_monitors(user_id: str) -> list[dict]:
    client = _get_client()
    aid = await get_storage_assistant_id()
    response = await client.get_memories(aid)
    results = []
    for m in response.memories:
        meta = m.metadata or {}
        if meta.get("type") == MONITOR_TYPE and meta.get("user_id") == user_id:
            try:
                monitor = json.loads(m.content)
                monitor["_memory_id"] = str(m.id)
                results.append(monitor)
            except Exception:
                continue
    return results


async def get_monitor(monitor_id: str, user_id: str) -> Optional[dict]:
    monitors = await list_monitors(user_id)
    return next((m for m in monitors if m.get("monitor_id") == monitor_id), None)


async def delete_monitor(monitor_id: str, user_id: str) -> bool:
    monitor = await get_monitor(monitor_id, user_id)
    if not monitor:
        return False
    memory_id = monitor.get("_memory_id")
    if not memory_id:
        return False
    client = _get_client()
    aid = await get_storage_assistant_id()
    await client.delete_memory(assistant_id=aid, memory_id=memory_id)
    print(f"[monitor] Deleted monitor {monitor_id} for user {user_id}")
    return True


async def list_all_monitors() -> list[dict]:
    """Return every active monitor across all users (for the scheduler)."""
    client = _get_client()
    aid = await get_storage_assistant_id()
    response = await client.get_memories(aid)
    results = []
    for m in response.memories:
        meta = m.metadata or {}
        if meta.get("type") == MONITOR_TYPE:
            try:
                monitor = json.loads(m.content)
                monitor["_memory_id"] = str(m.id)
                if monitor.get("active", True):
                    results.append(monitor)
            except Exception:
                continue
    return results


async def update_monitor_next_run(monitor_id: str, user_id: str) -> None:
    """Bump next_run_at forward 30 days after a successful send."""
    monitor = await get_monitor(monitor_id, user_id)
    if not monitor:
        return
    memory_id = monitor.pop("_memory_id", None)
    if not memory_id:
        return
    monitor["next_run_at"] = _next_run_at()
    client = _get_client()
    aid = await get_storage_assistant_id()
    await client.update_memory(
        assistant_id=aid,
        memory_id=memory_id,
        content=json.dumps(monitor),
        metadata={
            "type": MONITOR_TYPE,
            "monitor_id": monitor_id,
            "user_id": user_id,
        },
    )
    print(f"[monitor] Updated next_run_at for {monitor_id}")
