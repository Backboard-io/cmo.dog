"""FastAPI app: runs API and SSE stream. All logic in API."""

import asyncio
import csv
import json
import os
import uuid
from contextlib import asynccontextmanager
from functools import lru_cache
from pathlib import Path
from typing import Any

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from app import orchestrator
from app.config import settings
from app.routes.auth import router as auth_router
from app.routes.billing import router as billing_router
from app.routes.admin import router as admin_router
from app.routes.monitors import router as monitors_router
from app.services.monitor_scheduler import start_scheduler, stop_scheduler
from app.services.user_service import find_user_by_token, increment_prompts
from app.services.run_history_service import list_runs, get_run_detail
from pydantic import BaseModel as PydanticBaseModel

from app.schemas import AnalyticsMetric, ChatMessage, FeedItem, RunCreate, RunResponse, RunStatus


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="AI CMO Terminal API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:9000",
        "http://127.0.0.1:9000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://cmo.dog",
        "https://www.cmo.dog",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(billing_router)
app.include_router(admin_router)
app.include_router(monitors_router)


@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/api/runs", response_model=RunResponse)
async def create_run(body: RunCreate, x_user_token: str = Header(None)):
    if not x_user_token:
        raise HTTPException(status_code=401, detail="Sign up to use Onni")

    user = await find_user_by_token(x_user_token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token — sign up again")

    plan = user.get("plan", "free")
    prompts_used = int(user.get("prompts_used", 0))

    if plan == "free" and prompts_used >= settings.free_prompts_limit:
        raise HTTPException(
            status_code=402,
            detail={
                "error": "limit_reached",
                "prompts_used": prompts_used,
                "prompts_limit": settings.free_prompts_limit,
            },
        )

    # Deduct token before the run starts — no matter what happens next
    try:
        await increment_prompts(user["user_id"])
    except Exception as e:
        print(f"[billing] WARN: increment_prompts failed for {user['user_id']}: {e}")

    run_id = uuid.uuid4().hex[:12]
    orchestrator._runs[run_id] = RunStatus(
        run_id=run_id,
        status="pending",
        website_url=body.website_url,
        llm_provider=body.llm_provider,
        model_name=body.model_name,
        credits=2000,
        analytics_overview=[
            AnalyticsMetric(key="performance", label="Performance", score=44, tone="red"),
            AnalyticsMetric(key="accessibility", label="Accessibility", score=78, tone="yellow"),
            AnalyticsMetric(key="best_practices", label="Best Practices", score=73, tone="yellow"),
            AnalyticsMetric(key="seo", label="SEO", score=92, tone="green"),
        ],
        feed_items=[],
        chat_status="loading",
    )
    orchestrator._terminal_lines[run_id] = []
    orchestrator._terminal_events[run_id] = asyncio.Event()

    asyncio.create_task(
        orchestrator.run_orchestrator(
            run_id, body.website_url, plan=plan, user_id=user["user_id"],
            llm_provider=body.llm_provider, model_name=body.model_name,
        )
    )

    return RunResponse(run_id=run_id)


@app.get("/api/runs/{run_id}", response_model=RunStatus)
async def get_run(run_id: str, x_user_token: str = Header(None)):
    run = orchestrator.get_run(run_id)
    if run:
        return run
    # Fall back to persisted history if not in memory (e.g. after restart)
    if x_user_token:
        user = await find_user_by_token(x_user_token)
        if user:
            detail = await get_run_detail(run_id, user["user_id"])
            if detail:
                return RunStatus(**{k: v for k, v in detail.items() if k in RunStatus.model_fields})
    raise HTTPException(status_code=404, detail="Run not found")


@app.get("/api/history")
async def get_history(x_user_token: str = Header(None)):
    if not x_user_token:
        raise HTTPException(status_code=401, detail="Authentication required")
    user = await find_user_by_token(x_user_token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    summaries = await list_runs(user["user_id"])
    return {"runs": summaries}


async def stream_generator(run_id: str):
    run = orchestrator.get_run(run_id)
    if not run:
        yield {"data": '{"line": "> Run not found."}'}
        return

    evt = orchestrator.get_terminal_event(run_id)
    pos = 0

    try:
        while True:
            # Replay buffered lines (catches up any client that connected late)
            lines = orchestrator.get_terminal_lines(run_id)
            while pos < len(lines):
                yield {"data": json.dumps({"line": lines[pos]})}
                pos += 1

            # Done if run has finished
            r = orchestrator.get_run(run_id)
            if r and r.status in ("completed", "failed"):
                break

            # Wait for next line (or timeout to re-check status)
            evt.clear()
            try:
                await asyncio.wait_for(asyncio.shield(evt.wait()), timeout=30.0)
            except asyncio.TimeoutError:
                pass
    except asyncio.CancelledError:
        pass


@app.get("/api/runs/{run_id}/stream")
async def stream_run(run_id: str):
    if not orchestrator.get_run(run_id):
        raise HTTPException(status_code=404, detail="Run not found")
    return EventSourceResponse(stream_generator(run_id))


class ChatRequest(PydanticBaseModel):
    message: str


@app.post("/api/runs/{run_id}/chat")
async def chat(run_id: str, body: ChatRequest):
    run = orchestrator.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    run.chat_messages.append(ChatMessage(role="user", content=body.message))
    reply = await orchestrator.chat_reply(run_id, body.message)
    run.chat_messages.append(ChatMessage(role="assistant", content=reply))
    return {"messages": run.chat_messages}


_EXCLUDED_PROVIDERS: set[str] = set()

@lru_cache(maxsize=1)
def _load_model_list() -> dict[str, Any]:
    """Parse model_list.csv once and return provider-grouped data."""
    csv_path = Path(__file__).parent.parent / "model_list.csv"
    providers: dict[str, list[dict]] = {}

    if not csv_path.exists():
        return {"providers": [], "models": {}}

    with open(csv_path, newline="") as f:
        for row in csv.DictReader(f):
            if row.get("model_type") != "llm":
                continue
            if row.get("supports_tools") != "True":
                continue
            provider = row.get("provider", "")
            if provider in _EXCLUDED_PROVIDERS:
                continue
            try:
                input_cost = float(row.get("input_cost_per_1m_tokens") or 0)
                output_cost = float(row.get("output_cost_per_1m_tokens") or 0)
                context = int(row.get("context_limit") or 0)
            except (ValueError, TypeError):
                continue
            providers.setdefault(provider, []).append({
                "id": row["name"],
                "context": context,
                "input_cost": input_cost,
                "output_cost": output_cost,
            })

    return {
        "providers": sorted(providers.keys()),
        "models": providers,
    }


@app.get("/api/models")
async def get_models():
    return _load_model_list()


def run():
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=9000, reload=True)
