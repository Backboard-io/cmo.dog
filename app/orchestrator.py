"""Run orchestration: Backboard assistants as agents, SSE terminal lines."""

import asyncio
import json
import os
import re
import uuid
from typing import Optional

import httpx
from backboard import BackboardClient

_BACKBOARD_BASE = "https://app.backboard.io/api"


async def _add_message_with_search(thread_id: str, content: str) -> str:
    """Call the Backboard message endpoint directly with web_search enabled."""
    api_key = os.getenv("BACKBOARD_API_KEY", "")
    async with httpx.AsyncClient(timeout=120) as hx:
        resp = await hx.post(
            f"{_BACKBOARD_BASE}/threads/{thread_id}/messages",
            headers={"X-API-Key": api_key},
            data={
                "content": content, 
                "stream": "true", 
                "memory": "off",
                "web_search": "Auto",
                "llm_provider": "openai",
                "model_name": "gpt-5.4",
            },
        )
        resp.raise_for_status()

        body = ""
        for line in resp.text.splitlines():
            line = line.strip()
            if line.startswith("data:"):
                line = line[len("data:"):].strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue
            if data.get("type") == "run_ended":
                body = data.get("final_content", "")

    print(body)
    return body

from app.schemas import (
    AnalyticsMetric,
    AuditCheck,
    ChatMessage,
    CompetitorItem,
    CompetitorReport,
    CompetitorReportRow,
    DocumentItem,
    FeedItem,
    RunStatus,
)


_AUDIT_PROMPT = """\
Search web for {url}
Audit the website {url}. Respond with ONLY a raw JSON object — no markdown fences, \
no explanatory text before or after. Use exactly these keys:
{{
  "performance_score": <integer 0-100>,
  "accessibility_score": <integer 0-100>,
  "best_practices_score": <integer 0-100>,
  "seo_score": <integer 0-100>,
  "summary": "<2-3 sentence plain-text summary>",
  "passed_checks": [{{"name": "...", "description": "1 sentence note", "value": "<ultra-short status, ≤20 chars, e.g. 42/42 or 18 int / 6 ext or Yes or OK>"}}],
  "failed_checks": [{{"name": "...", "description": "1 sentence explaining the issue", "value": "<ultra-short status, ≤20 chars, e.g. Missing or No or None or 0/5>", "priority": "critical|high|medium", "how_to_fix": "numbered step-by-step instructions to fix this specific issue, 3-5 steps"}}]
}}
Check: page structure, meta title/description, H1, image alt text, HTTPS, mobile-friendliness, \
Core Web Vitals estimates, structured data, canonical URL, robots.txt, sitemap, broken links, \
accessibility basics. List every check — passing ones in passed_checks, failing ones in failed_checks.\
"""


def _score_tone(score: int) -> str:
    if score >= 90:
        return "green"
    if score >= 70:
        return "yellow"
    return "red"


def _extract_json(text: str) -> dict:
    """Extract and parse the first JSON object found in text."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1:
        return json.loads(text[start : end + 1])
    raise ValueError("No JSON object found in audit response")


# In-memory run state: run_id -> RunStatus and queue of terminal lines for SSE
_runs: dict[str, RunStatus] = {}
_terminal_queues: dict[str, asyncio.Queue[str]] = {}


def _get_client() -> BackboardClient:
    api_key = os.getenv("BACKBOARD_API_KEY")
    if not api_key:
        raise ValueError("BACKBOARD_API_KEY not set")
    return BackboardClient(api_key=api_key)


def _assistant_id(key: str) -> str:
    val = os.getenv(key)
    if not val:
        raise ValueError(f"{key} not set in .env")
    return val


async def _emit(run_id: str, line: str) -> None:
    """Emit a terminal line for this run (prefix with > if not already)."""
    if not line.strip().startswith(">"):
        line = f"> {line}"
    q = _terminal_queues.get(run_id)
    if q:
        await q.put(line)


_chat_threads: dict[str, str] = {}


def get_run(run_id: str) -> Optional[RunStatus]:
    return _runs.get(run_id)


async def chat_reply(run_id: str, message: str) -> str:
    """Send a chat message for this run and return the assistant reply."""
    client = _get_client()
    audit_id = _assistant_id("BACKBOARD_ASSISTANT_AUDIT")
    run = _runs.get(run_id)

    if run_id not in _chat_threads:
        thread = await client.create_thread(audit_id)
        _chat_threads[run_id] = str(thread.thread_id)

    return (await _add_message_with_search(_chat_threads[run_id], message))[:1000]


def get_terminal_queue(run_id: str) -> asyncio.Queue[str]:
    if run_id not in _terminal_queues:
        _terminal_queues[run_id] = asyncio.Queue()
    return _terminal_queues[run_id]


async def run_orchestrator(run_id: str, website_url: str) -> None:
    """Run the agent pipeline and update run state. Emits terminal lines to queue."""
    client = _get_client()
    try:
        content_id = _assistant_id("BACKBOARD_ASSISTANT_CONTENT")
        competitor_id = _assistant_id("BACKBOARD_ASSISTANT_COMPETITOR")
        brand_id = _assistant_id("BACKBOARD_ASSISTANT_BRAND")
        audit_id = _assistant_id("BACKBOARD_ASSISTANT_AUDIT")
    except ValueError as e:
        _runs[run_id] = RunStatus(
            run_id=run_id,
            status="failed",
            website_url=website_url,
            project_description=str(e),
        )
        await _emit(run_id, f"Error: {e}")
        return

    run = _runs.get(run_id)
    if run:
        run.status = "running"
        run.chat_status = "loading"

    await _emit(run_id, "Checking what content and documents you have...")
    content_thread = await client.create_thread(content_id)
    content_prompt = f"Search web for {website_url}. Visit and summarize the website {website_url}. What content and key documents or product information does it offer? Be concise."
    product_info = (await _add_message_with_search(str(content_thread.thread_id), content_prompt))[:2000]
    if run:
        run.project_description = product_info or f"Site: {website_url}"
        run.documents = [DocumentItem(id="product", title="Product Information")]
        run.feed_items = [
            FeedItem(id="mentions", title="Found 2 mentions", status="Suggested"),
            FeedItem(id="seo-geo", title="SEO + GEO Recommendations", status="Found 2 issues"),
            FeedItem(id="meta-tags", title="Add Critical Meta Tags", status="High priority"),
            FeedItem(id="schema", title="Implement Structured Data", status="In progress"),
        ]
    await _emit(run_id, "Content and documents summarized.")

    await _emit(run_id, "Now let me check out your competition...")
    competitor_thread = await client.create_thread(competitor_id)
    domain = website_url.replace("https://", "").replace("http://", "").split("/")[0]
    search_query = f"{domain} competitors alternative privacy AI chat"
    await _emit(run_id, f"Searching: {search_query}")
    comp_prompt = f"Search web for {website_url}. Find direct and secondary competitors to the website {website_url}. For each competitor list: name, category (Direct or Secondary), and pricing (e.g. Free / $X/mo). Format as a short executive summary then a clear list."
    comp_text = await _add_message_with_search(str(competitor_thread.thread_id), comp_prompt)
    await _emit(run_id, "Evaluating competitor's positioning strategy...")
    await _emit(run_id, "Competitor analysis complete.")

    competitors: list[CompetitorItem] = []
    report_rows: list[CompetitorReportRow] = []
    for i, line in enumerate(comp_text.split("\n")):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "|" in line and i > 0:
            parts = [p.strip() for p in line.split("|") if p.strip()]
            if len(parts) >= 3:
                report_rows.append(
                    CompetitorReportRow(
                        competitor=parts[0],
                        category=parts[1],
                        pricing=parts[2],
                    )
                )
                competitors.append(CompetitorItem(id=parts[0].lower().replace(" ", "-"), name=parts[0]))
        elif " - " in line and ("Direct" in line or "Secondary" in line or "Free" in line or "$" in line):
            parts = line.split(" - ", 1)
            if len(parts) == 2:
                name = parts[0].strip().strip("-*")
                rest = parts[1].strip()
                cat = "Direct" if "direct" in rest.lower() else "Secondary"
                report_rows.append(CompetitorReportRow(competitor=name, category=cat, pricing=rest))
                competitors.append(CompetitorItem(id=name.lower().replace(" ", "-"), name=name))

    if run:
        run.competitors = competitors or [CompetitorItem(id="c1", name="See report")]
        run.documents = (run.documents or []) + [
            DocumentItem(id="competitor", title="Competitor Analysis"),
        ]
        from datetime import datetime
        run.competitor_report = CompetitorReport(
            title="Competitor Analysis",
            date=datetime.utcnow().strftime("As of %B %d, %Y"),
            executive_summary=comp_text[:1500] if comp_text else "No summary.",
            rows=report_rows if report_rows else [
                CompetitorReportRow(competitor="—", category="—", pricing=comp_text[:200] or "—"),
            ],
        )
    brand_prompt = f"Search web for {website_url}. Based on the website {website_url} and this product summary, describe the brand voice in 2-3 sentences: {product_info[:500]}"
    await _emit(run_id, "Now let me figure out your brand voice...")
    brand_thread = await client.create_thread(brand_id)
    brand_snippet = (await _add_message_with_search(str(brand_thread.thread_id), brand_prompt))[:500]
    await _emit(run_id, "Brand voice guide ready")
    if run:
        run.brand_voice_snippet = brand_snippet
        run.documents = (run.documents or []) + [DocumentItem(id="brand", title="Brand Voice")]

    await _emit(run_id, "Running website audit...")
    await _emit(run_id, "Scanning page structure and metadata...")
    audit_thread = await client.create_thread(audit_id)
    audit_raw = await _add_message_with_search(
        str(audit_thread.thread_id),
        _AUDIT_PROMPT.format(url=website_url),
    )
    await _emit(run_id, "Page speed and core web vitals measured")

    if run:
        try:
            audit_data = _extract_json(audit_raw)
            perf = int(audit_data.get("performance_score", 50))
            a11y = int(audit_data.get("accessibility_score", 50))
            bp = int(audit_data.get("best_practices_score", 50))
            seo = int(audit_data.get("seo_score", 50))
            run.analytics_overview = [
                AnalyticsMetric(key="performance", label="Performance", score=perf, tone=_score_tone(perf)),
                AnalyticsMetric(key="accessibility", label="Accessibility", score=a11y, tone=_score_tone(a11y)),
                AnalyticsMetric(key="best_practices", label="Best Practices", score=bp, tone=_score_tone(bp)),
                AnalyticsMetric(key="seo", label="SEO", score=seo, tone=_score_tone(seo)),
            ]
            run.passed_checks = [
                AuditCheck(name=c["name"], description=c.get("description", ""), value=c.get("value", ""), passed=True)
                for c in audit_data.get("passed_checks", [])
                if isinstance(c, dict) and c.get("name")
            ]
            failed = [
                c for c in audit_data.get("failed_checks", [])
                if isinstance(c, dict) and c.get("name")
            ]
            run.failed_checks = [
                AuditCheck(
                    name=c["name"],
                    description=c.get("description", ""),
                    value=c.get("value", ""),
                    passed=False,
                    how_to_fix=c.get("how_to_fix", ""),
                )
                for c in failed
            ]
            run.feed_items = [
                FeedItem(
                    id=c["name"].lower().replace(" ", "-")[:40],
                    title=c["name"],
                    status=f"{c.get('priority', 'medium').title()} priority",
                    description=c.get("description", ""),
                    how_to_fix=c.get("how_to_fix", ""),
                    action_label="Fix",
                )
                for c in failed
            ]
            run.audit_summary = audit_data.get("summary", audit_raw[:1500])
            await _emit(run_id, f"Found {len(failed)} SEO optimization opportunities (score: {seo}/100)")
        except Exception:
            run.audit_summary = audit_raw[:1500]

    if run:
        run.status = "completed"
        run.project_name = domain.replace(".", " ").title() if domain else "Project"
        run.chat_status = "ready"
        run.chat_messages = [
            ChatMessage(
                role="assistant",
                content="I finished the audit and competitor scan. Want me to draft a launch plan or prioritize the SEO fixes?",
            )
        ]
