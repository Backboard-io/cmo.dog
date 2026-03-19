"""FastAPI app: runs API and SSE stream. All logic in API."""

import asyncio
import json
import uuid
from contextlib import asynccontextmanager

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from app import orchestrator
from pydantic import BaseModel as PydanticBaseModel

from app.schemas import AnalyticsMetric, ChatMessage, FeedItem, RunCreate, RunResponse, RunStatus


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="AI CMO Terminal API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/runs", response_model=RunResponse)
async def create_run(body: RunCreate):
    run_id = uuid.uuid4().hex[:12]
    orchestrator._runs[run_id] = RunStatus(
        run_id=run_id,
        status="pending",
        website_url=body.website_url,
        credits=2000,
        analytics_overview=[
            AnalyticsMetric(key="performance", label="Performance", score=44, tone="red"),
            AnalyticsMetric(key="accessibility", label="Accessibility", score=78, tone="yellow"),
            AnalyticsMetric(key="best_practices", label="Best Practices", score=73, tone="yellow"),
            AnalyticsMetric(key="seo", label="SEO", score=92, tone="green"),
        ],
        feed_items=[
            FeedItem(id="mentions", title="Found 2 mentions", status="Suggested"),
            FeedItem(id="seo-geo", title="SEO + GEO Recommendations", status="Found 2 issues"),
            FeedItem(id="meta-tags", title="Add Critical Meta Tags", status="High priority"),
            FeedItem(id="schema", title="Implement Structured Data", status="In progress"),
        ],
        chat_status="loading",
    )
    orchestrator._terminal_queues[run_id] = asyncio.Queue()
    asyncio.create_task(orchestrator.run_orchestrator(run_id, body.website_url))
    return RunResponse(run_id=run_id)


@app.get("/api/runs/{run_id}", response_model=RunStatus)
async def get_run(run_id: str):
    run = orchestrator.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


async def stream_generator(run_id: str):
    run = orchestrator.get_run(run_id)
    if not run:
        yield {"data": '{"line": "> Run not found."}'}
        return
    q = orchestrator.get_terminal_queue(run_id)
    try:
        while True:
            try:
                line = await asyncio.wait_for(q.get(), timeout=30.0)
                yield {"data": json.dumps({"line": line})}
            except asyncio.TimeoutError:
                yield {"data": ""}
                r = orchestrator.get_run(run_id)
                if r and r.status in ("completed", "failed"):
                    break
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


def run():
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
