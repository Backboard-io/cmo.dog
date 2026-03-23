"""Admin routes — list and manage users. Restricted to ADMIN_EMAILS."""

import asyncio
import json
import uuid

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from typing import Optional

from app.config import settings
from app.guardrail_state import get_mode as get_guardrail_mode, set_mode as set_guardrail_mode, GuardrailMode
from app.services.user_service import _all_user_memories, find_user_by_token, update_user, delete_user

router = APIRouter()

# ─── Shell session store ──────────────────────────────────────────────────────
_shell_sessions: dict[str, dict] = {}

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


class BulkDeleteRequest(BaseModel):
    user_ids: list[str]


class ShellRequest(BaseModel):
    command: str


class GuardrailRequest(BaseModel):
    mode: GuardrailMode


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


@router.delete("/api/admin/users/{user_id}", status_code=204)
async def delete_user_route(user_id: str, x_user_token: str = Header(None)):
    await _require_admin(x_user_token)
    deleted = await delete_user(user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="User not found")


@router.post("/api/admin/users/bulk-delete")
async def bulk_delete_users(body: BulkDeleteRequest, x_user_token: str = Header(None)):
    await _require_admin(x_user_token)
    results = await asyncio.gather(
        *[delete_user(uid) for uid in body.user_ids],
        return_exceptions=True,
    )
    deleted = sum(1 for r in results if r is True)
    return {"deleted": deleted, "requested": len(body.user_ids)}


# ─── Guardrail mode ───────────────────────────────────────────────────────────

@router.get("/api/admin/guardrails")
async def get_guardrails(x_user_token: str = Header(None)):
    await _require_admin(x_user_token)
    return {"mode": await get_guardrail_mode()}


@router.patch("/api/admin/guardrails")
async def patch_guardrails(body: GuardrailRequest, x_user_token: str = Header(None)):
    await _require_admin(x_user_token)
    await set_guardrail_mode(body.mode)
    return {"mode": body.mode}


# ─── Shell diagnostics ────────────────────────────────────────────────────────

@router.post("/api/admin/shell")
async def run_shell_command(body: ShellRequest, x_user_token: str = Header(None)):
    await _require_admin(x_user_token)
    session_id = uuid.uuid4().hex[:16]
    _shell_sessions[session_id] = {"lines": [], "event": asyncio.Event(), "done": False}
    asyncio.create_task(_execute_shell(session_id, body.command))
    return {"session_id": session_id}


async def _execute_shell(session_id: str, command: str) -> None:
    sess = _shell_sessions[session_id]
    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        assert proc.stdout is not None
        async for raw in proc.stdout:
            line = raw.decode(errors="replace").rstrip()
            sess["lines"].append(line)
            sess["event"].set()
        await proc.wait()
        sess["lines"].append(f"\n[exit {proc.returncode}]")
    except Exception as exc:
        sess["lines"].append(f"[error] {exc}")
    finally:
        sess["done"] = True
        sess["event"].set()


async def _shell_stream_generator(session_id: str):
    sess = _shell_sessions[session_id]
    pos = 0
    try:
        while True:
            while pos < len(sess["lines"]):
                yield {"data": json.dumps({"line": sess["lines"][pos]})}
                pos += 1
            if sess["done"]:
                break
            sess["event"].clear()
            try:
                await asyncio.wait_for(asyncio.shield(sess["event"].wait()), timeout=30.0)
            except asyncio.TimeoutError:
                pass
    except asyncio.CancelledError:
        pass


@router.get("/api/admin/shell/{session_id}/stream")
async def stream_shell(session_id: str):
    if session_id not in _shell_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return EventSourceResponse(_shell_stream_generator(session_id))


@router.get("/api/admin/ps")
async def get_processes(x_user_token: str = Header(None)):
    await _require_admin(x_user_token)
    proc = await asyncio.create_subprocess_shell(
        "ps aux",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    stdout, _ = await proc.communicate()
    lines = stdout.decode(errors="replace").splitlines()
    processes = []
    for line in lines[1:]:
        parts = line.split(None, 10)
        if len(parts) < 11:
            continue
        try:
            processes.append({
                "user": parts[0],
                "pid": parts[1],
                "cpu": float(parts[2]),
                "mem": float(parts[3]),
                "command": parts[10][:100],
            })
        except (ValueError, IndexError):
            continue
    processes.sort(key=lambda x: x["cpu"], reverse=True)
    return {"processes": processes[:40]}
