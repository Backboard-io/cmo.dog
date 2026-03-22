"""Run history backed by Backboard memories.

Memories per completed run:
  - cmodog_run_summary       → small card data (url, scores, date) used for list views
  - cmodog_run_detail_chunk  → chunked slices of the full RunStatus JSON (≤3800 bytes
                               each) to stay under Backboard's 4096-byte filter limit
"""

import json
from datetime import datetime, timezone
from typing import Optional

from backboard import BackboardClient

from app.config import settings
from app.schemas import RunStatus

RUN_SUMMARY_TYPE = "cmodog_run_summary"
RUN_DETAIL_CHUNK_TYPE = "cmodog_run_detail_chunk"

# Stay well under the 4096-byte Backboard filter limit
_CHUNK_SIZE = 3800


def _get_client() -> BackboardClient:
    return BackboardClient(api_key=settings.backboard_api_key)


async def _aid() -> str:
    from app.services.user_service import get_storage_assistant_id
    return await get_storage_assistant_id()


async def save_run(run: RunStatus, user_id: str) -> None:
    """Persist a completed run as a summary + detail memory pair."""
    client = _get_client()
    aid = await _aid()
    created_at = datetime.now(timezone.utc).isoformat()

    scores = {m.key: m.score for m in run.analytics_overview}

    summary = {
        "run_id": run.run_id,
        "user_id": user_id,
        "website_url": run.website_url,
        "project_name": run.project_name,
        "status": run.status,
        "created_at": created_at,
        "scores": scores,
        "issues_count": len(run.failed_checks),
        "passed_count": len(run.passed_checks),
        "model_name": run.model_name,
        "llm_provider": run.llm_provider,
    }
    await client.add_memory(
        assistant_id=aid,
        content=json.dumps(summary),
        metadata={
            "type": RUN_SUMMARY_TYPE,
            "user_id": user_id,
            "run_id": run.run_id,
        },
    )

    detail = run.model_dump()
    detail["user_id"] = user_id
    detail["created_at"] = created_at
    payload = json.dumps(detail)
    chunks = [payload[i : i + _CHUNK_SIZE] for i in range(0, len(payload), _CHUNK_SIZE)]
    for idx, chunk in enumerate(chunks):
        await client.add_memory(
            assistant_id=aid,
            content=chunk,
            metadata={
                "type": RUN_DETAIL_CHUNK_TYPE,
                "user_id": user_id,
                "run_id": run.run_id,
                "chunk_index": idx,
                "total_chunks": len(chunks),
            },
        )


async def list_runs(user_id: str) -> list[dict]:
    """Return run summaries for a user, newest first."""
    client = _get_client()
    aid = await _aid()
    response = await client.get_memories(aid)
    results = []
    for m in response.memories:
        meta = m.metadata or {}
        if meta.get("type") == RUN_SUMMARY_TYPE and meta.get("user_id") == user_id:
            try:
                results.append(json.loads(m.content))
            except Exception:
                continue
    results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return results


async def get_run_detail(run_id: str, user_id: str) -> Optional[dict]:
    """Return the full RunStatus dict for a historical run, reassembled from chunks."""
    client = _get_client()
    aid = await _aid()
    response = await client.get_memories(aid)
    chunks: dict[int, str] = {}
    total: int = 0
    for m in response.memories:
        meta = m.metadata or {}
        if (
            meta.get("type") == RUN_DETAIL_CHUNK_TYPE
            and meta.get("run_id") == run_id
            and meta.get("user_id") == user_id
        ):
            idx = int(meta.get("chunk_index", 0))
            total = int(meta.get("total_chunks", 1))
            chunks[idx] = m.content
    if not chunks:
        return None
    try:
        payload = "".join(chunks[i] for i in range(total))
        return json.loads(payload)
    except Exception:
        return None
