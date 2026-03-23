"""Shared guardrail mode state backed by Backboard storage."""

import json
from typing import Literal, Optional, Tuple

from backboard import BackboardClient
from pydantic import BaseModel

from app.config import settings
from app.services.user_service import get_storage_assistant_id

GuardrailMode = Literal["off", "on", "suggest"]

_DEFAULT_MODE: GuardrailMode = "on"
_STATE_TYPE = "guardrail_state"


class GuardrailState(BaseModel):
    mode: GuardrailMode


def _get_client() -> BackboardClient:
    return BackboardClient(api_key=settings.backboard_api_key)


async def _find_state_memory() -> Tuple[Optional[GuardrailState], Optional[str]]:
    client = _get_client()
    aid = await get_storage_assistant_id()
    response = await client.get_memories(aid)
    for mem in response.memories:
        meta = mem.metadata or {}
        if meta.get("type") != _STATE_TYPE:
            continue
        try:
            state = GuardrailState.model_validate_json(mem.content)
            return state, str(mem.id)
        except Exception:
            continue
    return None, None


async def get_mode() -> GuardrailMode:
    state, _ = await _find_state_memory()
    if state:
        return state.mode
    await set_mode(_DEFAULT_MODE)
    return _DEFAULT_MODE


async def set_mode(mode: GuardrailMode) -> None:
    client = _get_client()
    aid = await get_storage_assistant_id()
    state = GuardrailState(mode=mode)
    _, memory_id = await _find_state_memory()
    if memory_id:
        await client.update_memory(
            assistant_id=aid,
            memory_id=memory_id,
            content=state.model_dump_json(),
            metadata={"type": _STATE_TYPE},
        )
        return
    await client.add_memory(
        assistant_id=aid,
        content=state.model_dump_json(),
        metadata={"type": _STATE_TYPE},
    )
