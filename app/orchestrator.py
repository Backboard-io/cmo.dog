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


_DEFAULT_PROVIDER = "openrouter"
_DEFAULT_MODEL = "openrouter/free"


def _model_params(
    plan: str = "free",
    llm_provider: Optional[str] = None,
    model_name: Optional[str] = None,
) -> dict[str, str]:
    """Return LLM provider/model, using explicit overrides when provided."""
    return {
        "llm_provider": llm_provider or _DEFAULT_PROVIDER,
        "model_name": model_name or _DEFAULT_MODEL,
    }


_MD_STRIP = re.compile(r"^[#\-*|>\s]+|[*_`]+")


def _clean_snippet(text: str) -> str:
    """Strip markdown decoration and return clean prose, capped at 90 chars."""
    text = _MD_STRIP.sub("", text).strip()
    text = re.sub(r"\s+", " ", text)
    return text[:90]


async def _add_message_with_search(
    thread_id: str,
    content: str,
    plan: str = "free",
    stream_to_run: Optional[str] = None,
    agent_label: Optional[str] = None,
    memory: str = "off",
    llm_provider: Optional[str] = None,
    model_name: Optional[str] = None,
) -> str:
    """Call the Backboard message endpoint with web_search enabled.

    When agent_label is set, emits one clean thought line per sentence to the
    terminal (as '{label}: {snippet}') rather than raw token stream.
    """
    api_key = os.getenv("BACKBOARD_API_KEY", "")
    params = _model_params(plan, llm_provider=llm_provider, model_name=model_name)
    final_body = ""
    buf = ""
    streamed_full = ""

    async with httpx.AsyncClient(timeout=300) as hx:
        async with hx.stream(
            "POST",
            f"{_BACKBOARD_BASE}/threads/{thread_id}/messages",
            headers={"X-API-Key": api_key},
            data={
                "content": content,
                "stream": "true",
                "memory": memory,
                "web_search": "Auto",
                **params,
            },
        ) as resp:
            resp.raise_for_status()
            try:
                async for raw in resp.aiter_lines():
                    raw = raw.strip()
                    if raw.startswith("data:"):
                        raw = raw[len("data:"):].strip()
                    if not raw:
                        continue
                    try:
                        evt = json.loads(raw)
                    except json.JSONDecodeError:
                        continue

                    event_type = evt.get("type")

                    if event_type == "content_streaming":
                        chunk = evt.get("content", "") or ""
                        streamed_full += chunk
                        if not (stream_to_run and agent_label):
                            continue
                        if chunk:
                            buf += chunk
                            # Emit at sentence boundaries or when buffer is long enough
                            while True:
                                hit = -1
                                for i, ch in enumerate(buf[:160]):
                                    if ch in ".!?" and i + 1 < len(buf) and buf[i + 1] in " \n":
                                        hit = i + 2
                                        break
                                    if ch == "\n" and i > 20:
                                        hit = i + 1
                                        break
                                if hit == -1:
                                    if len(buf) > 150:
                                        hit = 150
                                    else:
                                        break
                                snippet = _clean_snippet(buf[:hit])
                                buf = buf[hit:].lstrip()
                                if len(snippet) > 15:
                                    await _emit(stream_to_run, f"{agent_label}: {snippet}")

                    elif event_type == "run_ended":
                        final_body = (evt.get("final_content") or "").strip()
                        if not final_body:
                            final_body = streamed_full.strip()
                        if stream_to_run and agent_label and buf.strip():
                            snippet = _clean_snippet(buf)
                            if len(snippet) > 15:
                                await _emit(stream_to_run, f"{agent_label}: {snippet}")
                        buf = ""

                    elif event_type in ("error", "run_failed"):
                        err_msg = evt.get("error") or evt.get("message") or json.dumps(evt)
                        print(f"[backboard] {event_type} from stream ({agent_label or 'chat'}): {err_msg}")
                        final_body = f"__backboard_error__: {err_msg}"

            except httpx.RemoteProtocolError as exc:
                print(f"[{agent_label or 'agent'}] stream error: {exc}")
                if stream_to_run and agent_label:
                    await _emit(stream_to_run, f"⚠ {agent_label}: connection dropped — using partial result")

    return (final_body or streamed_full).strip()

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


_FETCH_HEADERS = {"User-Agent": "cmo.dog-audit/1.0"}


async def _prefetch_site_data(website_url: str) -> tuple[str, str]:
    """Fetch homepage HTML, robots.txt, and sitemap.xml in parallel.

    Returns (verified_facts_block, raw_content_block) to inject into the audit prompt.
    """
    import time
    from urllib.parse import urlparse, urljoin

    parsed = urlparse(website_url)
    base = f"{parsed.scheme}://{parsed.netloc}"

    async def _fetch(path: str) -> tuple[int, str, float]:
        url = urljoin(base, path)
        t0 = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as hx:
                r = await hx.get(url, headers=_FETCH_HEADERS)
                return r.status_code, r.text[:10_000], (time.monotonic() - t0) * 1000
        except Exception as exc:
            return 0, f"(fetch error: {exc})", (time.monotonic() - t0) * 1000

    (robots_status, robots_text, _), (sitemap_status, sitemap_text, _), (home_status, home_html, home_ms) = (
        await asyncio.gather(_fetch("/robots.txt"), _fetch("/sitemap.xml"), _fetch("/"))
    )

    verified = _deterministic_checks(
        website_url, home_html if home_status == 200 else "", home_ms,
        robots_status, robots_text, sitemap_status, sitemap_text,
    )

    raw_parts: list[str] = []
    if robots_status == 200:
        raw_parts.append(f"=== /robots.txt ===\n{robots_text[:3000]}")
    else:
        raw_parts.append(f"=== /robots.txt ===\n(HTTP {robots_status} — not found)")

    if sitemap_status == 200:
        raw_parts.append(f"=== /sitemap.xml ===\n{sitemap_text[:3000]}")
    else:
        raw_parts.append(f"=== /sitemap.xml ===\n(HTTP {sitemap_status} — not found)")

    if home_status == 200:
        head_m = re.search(r"<head[^>]*>.*?</head>", home_html, re.DOTALL | re.IGNORECASE)
        snippet = head_m.group(0)[:4000] if head_m else home_html[:2000]
        raw_parts.append(f"=== Homepage <head> ===\n{snippet}")

    return verified, "\n\n".join(raw_parts)


def _deterministic_checks(
    website_url: str,
    home_html: str,
    home_ms: float,
    robots_status: int,
    robots_text: str,
    sitemap_status: int,
    sitemap_text: str,
) -> str:
    """Return verified facts grounded in direct HTTP fetches — no LLM inference."""
    lines: list[str] = [
        "=== VERIFIED FACTS (direct HTTP fetch — treat as ground truth, do not contradict) ==="
    ]

    # HTTPS
    if website_url.startswith("https://"):
        lines.append("✓ HTTPS: Site URL uses HTTPS")
    else:
        lines.append("✗ HTTPS: Site URL does NOT use HTTPS — critical security issue")

    # Homepage response time
    if home_ms > 0:
        ms = int(home_ms)
        if ms < 800:
            lines.append(f"✓ Response time: {ms}ms (fast)")
        elif ms < 2000:
            lines.append(f"~ Response time: {ms}ms (acceptable, aim for <800ms)")
        else:
            lines.append(f"✗ Response time: {ms}ms (slow — impacts Core Web Vitals)")

    # robots.txt
    if robots_status == 200:
        lines.append("✓ robots.txt: Present (HTTP 200)")
        has_sitemap_dir = bool(re.search(r"^Sitemap:", robots_text, re.MULTILINE | re.IGNORECASE))
        blocks_all = bool(
            re.search(r"User-agent:\s*\*", robots_text, re.IGNORECASE)
            and re.search(r"^Disallow:\s*/\s*$", robots_text, re.MULTILINE)
        )
        lines.append("✓ robots.txt: Contains Sitemap directive" if has_sitemap_dir else "✗ robots.txt: No Sitemap directive")
        if blocks_all:
            lines.append("✗ robots.txt: Disallow: / blocks ALL crawlers — site will not be indexed")
    else:
        lines.append(f"✗ robots.txt: Missing (HTTP {robots_status})")

    # sitemap.xml
    if sitemap_status == 200:
        url_count = len(re.findall(r"<url\b", sitemap_text, re.IGNORECASE))
        lines.append(f"✓ sitemap.xml: Present (HTTP 200), {url_count} <url> entries")
    else:
        lines.append(f"✗ sitemap.xml: Missing (HTTP {sitemap_status})")

    if not home_html:
        lines.append("✗ Homepage HTML: Could not fetch — HTML checks skipped")
        return "\n".join(lines)

    # Page title
    title_m = re.search(r"<title[^>]*>(.*?)</title>", home_html, re.DOTALL | re.IGNORECASE)
    if title_m:
        title = re.sub(r"\s+", " ", title_m.group(1)).strip()
        tlen = len(title)
        preview = f'"{title[:55]}"'
        if 30 <= tlen <= 60:
            lines.append(f'✓ Page title: {tlen} chars (good) — {preview}')
        elif tlen < 30:
            lines.append(f'✗ Page title: {tlen} chars — too short (ideal 30–60) — {preview}')
        else:
            lines.append(f'✗ Page title: {tlen} chars — too long (ideal 30–60) — {preview}')
    else:
        lines.append("✗ Page title: No <title> tag found")

    # Meta description
    desc_m = re.search(
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)["\']',
        home_html, re.IGNORECASE,
    ) or re.search(
        r'<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']description["\']',
        home_html, re.IGNORECASE,
    )
    if desc_m:
        dlen = len(desc_m.group(1).strip())
        if 120 <= dlen <= 160:
            lines.append(f"✓ Meta description: {dlen} chars (good)")
        elif dlen < 120:
            lines.append(f"✗ Meta description: {dlen} chars — too short (ideal 120–160)")
        else:
            lines.append(f"✗ Meta description: {dlen} chars — too long (ideal 120–160)")
    else:
        lines.append("✗ Meta description: Missing")

    # H1 count
    h1_count = len(re.findall(r"<h1[\s>]", home_html, re.IGNORECASE))
    if h1_count == 1:
        lines.append("✓ H1: Exactly one H1 tag")
    elif h1_count == 0:
        lines.append("✗ H1: No H1 tag found on homepage")
    else:
        lines.append(f"✗ H1: {h1_count} H1 tags found (should be exactly 1)")

    # Viewport
    if re.search(r'<meta[^>]+name=["\']viewport["\']', home_html, re.IGNORECASE):
        lines.append("✓ Viewport: Meta viewport present (mobile-friendly)")
    else:
        lines.append("✗ Viewport: Missing meta viewport tag — not mobile-friendly")

    # Canonical
    canonical_m = re.search(
        r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']*)["\']',
        home_html, re.IGNORECASE,
    ) or re.search(
        r'<link[^>]+href=["\']([^"\']*)["\'][^>]+rel=["\']canonical["\']',
        home_html, re.IGNORECASE,
    )
    if canonical_m:
        lines.append(f"✓ Canonical: Present — {canonical_m.group(1)[:80]}")
    else:
        lines.append('✗ Canonical: No <link rel="canonical"> found')

    # Open Graph
    og_title = bool(re.search(r'<meta[^>]+property=["\']og:title["\']', home_html, re.IGNORECASE))
    og_desc = bool(re.search(r'<meta[^>]+property=["\']og:description["\']', home_html, re.IGNORECASE))
    og_image = bool(re.search(r'<meta[^>]+property=["\']og:image["\']', home_html, re.IGNORECASE))
    og_hits = sum([og_title, og_desc, og_image])
    if og_hits == 3:
        lines.append("✓ Open Graph: og:title, og:description, og:image all present")
    elif og_hits > 0:
        missing_og = [t for t, v in [("og:title", og_title), ("og:description", og_desc), ("og:image", og_image)] if not v]
        lines.append(f"✗ Open Graph: Partial — missing {', '.join(missing_og)}")
    else:
        lines.append("✗ Open Graph: No OG tags found")

    # Structured data
    if re.search(r'<script[^>]+type=["\']application/ld\+json["\']', home_html, re.IGNORECASE):
        lines.append("✓ Structured data: JSON-LD script found")
    else:
        lines.append("✗ Structured data: No JSON-LD found")

    return "\n".join(lines)


_AUDIT_PROMPT = """\
Produce an SEO and technical audit for the site below.
Your entire response MUST be a single raw JSON object — no markdown fences, \
no prose before or after, no code blocks. Start with {{ and end with }}.

Target URL: {url}

{verified_facts}

{raw_content}

IMPORTANT: The VERIFIED FACTS above came from direct HTTP fetches — they are ground truth. \
Reflect them accurately in passed_checks / failed_checks. Add further checks for areas not \
covered above: image alt text, internal/external link quality, Core Web Vitals estimate, \
accessibility signals (ARIA, contrast, skip links), and any other SEO signals you can infer.

Required JSON shape (all keys required):
{{
  "performance_score": <int 0-100>,
  "accessibility_score": <int 0-100>,
  "best_practices_score": <int 0-100>,
  "seo_score": <int 0-100>,
  "summary": "<≤3 sentences>",
  "passed_checks": [
    {{"name": "<string>", "description": "<string>", "value": "<≤20 chars>"}}
  ],
  "failed_checks": [
    {{"name": "<string>", "description": "<string>", "value": "<≤20 chars>",
      "priority": "critical|high|medium",
      "how_to_fix": "<non-empty numbered steps>"}}
  ]
}}

Scores must reflect the actual findings — not generic defaults.\
"""


def _competitor_json_slices(text: str) -> list[str]:
    """Substrings that might decode as a JSON array of competitor objects."""
    t = text.strip()
    seen: set[str] = set()
    out: list[str] = []

    def add(s: str) -> None:
        s = s.strip()
        if s and s not in seen:
            seen.add(s)
            out.append(s)

    add(t)
    for m in re.finditer(r"```(?:json)?\s*(\[[\s\S]*?\])\s*```", text, re.IGNORECASE | re.DOTALL):
        add(m.group(1))
    start = text.find("[")
    if start != -1:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "[":
                depth += 1
            elif text[i] == "]":
                depth -= 1
                if depth == 0:
                    add(text[start : i + 1])
                    break
    return out


def _parse_competitor_response(text: str) -> tuple[list[CompetitorReportRow], list[CompetitorItem]]:
    """Prefer JSON array; fall back to markdown pipe rows."""
    rows: list[CompetitorReportRow] = []
    competitors: list[CompetitorItem] = []
    if not (text or "").strip():
        return rows, competitors
    for slice_ in _competitor_json_slices(text):
        try:
            data = json.loads(slice_)
        except json.JSONDecodeError:
            continue
        if not isinstance(data, list):
            continue
        for obj in data:
            if not isinstance(obj, dict):
                continue
            name = (obj.get("competitor") or obj.get("name") or obj.get("company") or "").strip()
            if not name:
                continue
            raw_cat = (obj.get("category") or "").strip()
            if raw_cat.lower() == "direct":
                cat = "Direct"
            else:
                cat = "Secondary"
            price = (obj.get("pricing") or obj.get("price") or "").strip() or "—"
            rows.append(CompetitorReportRow(competitor=name, category=cat, pricing=price))
            competitors.append(CompetitorItem(id=name.lower().replace(" ", "-"), name=name))
        if rows:
            return rows, competitors
    for line in text.split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "|" in line:
            parts = [p.strip() for p in line.split("|") if p.strip()]
            if len(parts) >= 3:
                if re.match(r"^[-=:]+$", parts[0]):
                    continue
                if parts[0].lower() in ("competitor", "name", "company", "tool"):
                    continue
                name = parts[0].strip("*_ ")
                if not name:
                    continue
                rows.append(CompetitorReportRow(competitor=name, category=parts[1], pricing=parts[2]))
                competitors.append(CompetitorItem(id=name.lower().replace(" ", "-"), name=name))
        elif " - " in line and ("Direct" in line or "Secondary" in line or "Free" in line or "$" in line):
            parts = line.split(" - ", 1)
            if len(parts) == 2:
                name = re.sub(r"^[\d.\-*\s]+|[*_]+", "", parts[0]).strip()
                rest = parts[1].strip()
                cat = "Direct" if "direct" in rest.lower() else "Secondary"
                if name:
                    rows.append(CompetitorReportRow(competitor=name, category=cat, pricing=rest))
                    competitors.append(CompetitorItem(id=name.lower().replace(" ", "-"), name=name))
    return rows, competitors


def _how_to_fix_or_fallback(check: dict) -> str:
    """Models often omit how_to_fix; keep FixDrawer usable."""
    raw = (check.get("how_to_fix") or "").strip()
    if raw:
        return raw
    name = (check.get("name") or "This issue").strip()
    desc = (check.get("description") or "").strip()
    if desc:
        return (
            f"1. Open your site and locate the area related to: {name}.\n"
            f"2. Address this finding: {desc}\n"
            "3. Deploy the change and re-run an audit or use browser devtools to verify.\n"
            "4. If unsure, search your CMS or hosting docs for this checklist item."
        )
    return (
        f"1. Review your site for: {name}.\n"
        "2. Compare against current SEO and accessibility best practices for this area.\n"
        "3. Implement fixes, then validate with an audit tool or manual QA.\n"
        "4. Re-run this analysis after changes to confirm the issue is resolved."
    )


def _backfill_feed_how_to_fix(items: list[FeedItem]) -> list[FeedItem]:
    """Placeholder or partial audit rows may omit how_to_fix; never ship empty FixDrawer bodies."""
    out: list[FeedItem] = []
    for it in items:
        if (it.how_to_fix or "").strip():
            out.append(it)
            continue
        fix = _how_to_fix_or_fallback({"name": it.title, "description": it.description})
        out.append(it.model_copy(update={"how_to_fix": fix}))
    return out


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


# In-memory run state: run_id -> RunStatus and replay-safe terminal log for SSE
_runs: dict[str, RunStatus] = {}
_terminal_lines: dict[str, list[str]] = {}   # all lines ever emitted (for replay)
_terminal_events: dict[str, asyncio.Event] = {}  # signalled on each new line


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
    """Append a terminal line and wake any waiting SSE readers."""
    if not line.strip().startswith(">"):
        line = f"> {line}"
    _terminal_lines.setdefault(run_id, []).append(line)
    evt = _terminal_events.get(run_id)
    if evt:
        evt.set()


_chat_threads: dict[str, str] = {}
_run_user_assistants: dict[str, str] = {}


def get_run(run_id: str) -> Optional[RunStatus]:
    return _runs.get(run_id)


_run_plans: dict[str, str] = {}
_run_users: dict[str, str] = {}
_run_llm_providers: dict[str, str] = {}
_run_model_names: dict[str, str] = {}


async def _store_agent_memory(run_id: str, content: str, label: str) -> None:
    """Write an agent result as a memory on the user's personal assistant."""
    ua = _run_user_assistants.get(run_id, "")
    if not ua:
        return
    try:
        await _get_client().add_memory(
            assistant_id=ua,
            content=content,
            metadata={"type": f"cmodog_{label}", "run_id": run_id},
        )
    except Exception as e:
        print(f"[orchestrator] Memory store failed ({label}): {e}")


async def chat_reply(run_id: str, message: str) -> str:
    """Send a chat message for this run and return the assistant reply."""
    client = _get_client()
    plan = _run_plans.get(run_id, "free")
    llm_provider = _run_llm_providers.get(run_id)
    model_name = _run_model_names.get(run_id)
    assistant_id = _run_user_assistants.get(run_id) or _assistant_id("BACKBOARD_ASSISTANT_AUDIT")

    if run_id not in _chat_threads:
        run = _runs.get(run_id)
        if run and run.chat_thread_id:
            # Restore from persisted thread_id (e.g. after server restart)
            _chat_threads[run_id] = run.chat_thread_id
            print(f"[chat_reply] restored thread {run.chat_thread_id} for run {run_id}")
        else:
            thread = await client.create_thread(assistant_id)
            _chat_threads[run_id] = str(thread.thread_id)
            if run:
                run.chat_thread_id = _chat_threads[run_id]
            print(f"[chat_reply] created new thread {_chat_threads[run_id]} for run {run_id}")

    reply = await _add_message_with_search(
        _chat_threads[run_id], message, plan=plan, memory="Auto",
        llm_provider=llm_provider, model_name=model_name,
    )

    if not reply or reply.startswith("__backboard_error__:"):
        print(f"[chat_reply] empty or error reply for run {run_id}: {reply!r}")
        raise RuntimeError(f"Backboard returned no reply: {reply!r}")

    return reply


def get_terminal_lines(run_id: str) -> list[str]:
    return _terminal_lines.get(run_id, [])


def get_terminal_event(run_id: str) -> asyncio.Event:
    if run_id not in _terminal_events:
        _terminal_events[run_id] = asyncio.Event()
    return _terminal_events[run_id]


def _build_greeting(run: RunStatus, domain: str) -> str:
    """Build a specific, data-driven opening message based on actual run results."""
    failed = run.failed_checks or []
    competitors = run.competitors or []
    analytics = run.analytics_overview or []

    parts: list[str] = []

    # Lead with what was found
    if failed:
        top_issues = [c.name for c in failed[:3]]
        issue_preview = ", ".join(top_issues)
        parts.append(
            f"I found **{len(failed)} SEO issue{'s' if len(failed) != 1 else ''}** on {domain} "
            f"— including {issue_preview}."
        )
    else:
        # Check page speed scores for something to mention
        seo_metric = next((m for m in analytics if m.key == "seo"), None)
        if seo_metric and seo_metric.score < 90:
            parts.append(f"Your SEO score came in at **{seo_metric.score}/100** — good but with room to grow.")
        else:
            parts.append(f"Good news: no critical SEO gaps on {domain}.")

    # Mention competitors if found
    if competitors:
        comp_names = ", ".join(c.name.replace("**", "") for c in competitors[:3])
        parts.append(f"I also mapped **{len(competitors)} competitor{'s' if len(competitors) != 1 else ''}**: {comp_names}.")

    # Suggest relevant follow-ups
    followups: list[str] = []
    if failed:
        followups.append("prioritize the fixes")
    if competitors:
        followups.append("compare you against the competition")
    followups.append("draft a content brief")

    parts.append("Want me to " + " or ".join(followups[:2]) + "?")

    return " ".join(parts)


async def _run_audit_agent(
    run_id: str,
    run: RunStatus,
    client: BackboardClient,
    plan: str,
    llm_provider: Optional[str],
    model_name: Optional[str],
) -> None:
    """Run the audit agent and update run state in place."""
    audit_id = _assistant_id("BACKBOARD_ASSISTANT_AUDIT")
    website_url = run.website_url

    await _emit(run_id, "Audit: Running website health checks…")
    thread = await client.create_thread(audit_id)

    await _emit(run_id, "Audit: Fetching homepage, robots.txt and sitemap.xml…")
    verified_facts, raw_content = await _prefetch_site_data(website_url)

    heartbeat_msgs = [
        "Audit: Checking meta tags and Open Graph…",
        "Audit: Evaluating Core Web Vitals…",
        "Audit: Analyzing robots.txt and sitemap structure…",
        "Audit: Reviewing structured data…",
        "Audit: Checking mobile-friendliness…",
        "Audit: Auditing accessibility signals…",
        "Audit: Scanning internal and external links…",
    ]

    async def _heartbeat() -> None:
        for msg in heartbeat_msgs:
            await asyncio.sleep(12)
            await _emit(run_id, msg)

    heartbeat_task = asyncio.create_task(_heartbeat())
    try:
        prompt = _AUDIT_PROMPT.format(url=website_url, verified_facts=verified_facts, raw_content=raw_content)
        audit_raw = await _add_message_with_search(
            str(thread.thread_id),
            prompt,
            plan=plan,
            llm_provider=llm_provider,
            model_name=model_name,
        )
        if not audit_raw:
            audit_raw = await _add_message_with_search(
                str(thread.thread_id),
                prompt,
                plan=plan,
                llm_provider="openai",
                model_name="gpt-5.4",
            )
    finally:
        heartbeat_task.cancel()

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
                how_to_fix=_how_to_fix_or_fallback(c),
            )
            for c in failed
        ]
        run.feed_items = [
            FeedItem(
                id=c["name"].lower().replace(" ", "-")[:40],
                title=c["name"],
                status=f"{c.get('priority', 'medium').title()} priority",
                description=c.get("description", ""),
                how_to_fix=_how_to_fix_or_fallback(c),
                action_label="Fix",
            )
            for c in failed
        ]
        run.audit_summary = audit_data.get("summary", audit_raw[:1500])
        audit_memory = (
            f"Website audit for {website_url}:\n"
            f"Scores — Performance: {perf}, Accessibility: {a11y}, Best Practices: {bp}, SEO: {seo}\n"
            f"Summary: {run.audit_summary}\n"
            f"Issues ({len(failed)}): " + ", ".join(c["name"] for c in failed[:10])
        )
        await _store_agent_memory(run_id, audit_memory, "audit")
        await _emit(run_id, f"✓ Audit: Found {len(failed)} SEO opportunities (score: {seo}/100)")
    except Exception as e:
        print(f"[audit] JSON parse failed: {e}\nRaw ({len(audit_raw)} chars): {audit_raw[:800]!r}")
        run.audit_summary = audit_raw[:1500]
        await _emit(run_id, "⚠ Audit: Could not parse response — scores unavailable")


async def ensure_run_in_memory(run_id: str, user_id: str, plan: str = "free") -> Optional[RunStatus]:
    """Load a historical run into memory so SSE stream is available. No-op if already present."""
    if run_id in _runs:
        return _runs[run_id]
    from app.services.run_history_service import get_run_detail
    detail = await get_run_detail(run_id, user_id)
    if not detail:
        return None
    run = RunStatus(**{k: v for k, v in detail.items() if k in RunStatus.model_fields})
    _runs[run_id] = run
    _terminal_lines[run_id] = list(run.terminal_log) if run.terminal_log else []
    _terminal_events[run_id] = asyncio.Event()
    _run_plans[run_id] = plan
    _run_llm_providers[run_id] = run.llm_provider
    _run_model_names[run_id] = run.model_name
    _run_users[run_id] = user_id
    if run.chat_thread_id:
        _chat_threads[run_id] = run.chat_thread_id
        print(f"[ensure_run_in_memory] restored chat thread {run.chat_thread_id} for run {run_id}")
    return run


async def retry_audit_agent(run_id: str, user_id: str = "") -> None:
    """Re-run just the audit agent for a run that is already in memory."""
    run = _runs.get(run_id)
    if not run:
        print(f"[retry_audit] run {run_id} not in memory — call ensure_run_in_memory first")
        return

    plan = _run_plans.get(run_id, "free")
    llm_provider = _run_llm_providers.get(run_id) or run.llm_provider
    model_name = _run_model_names.get(run_id) or run.model_name

    run.status = "running"
    run.analytics_overview = []
    run.passed_checks = []
    run.failed_checks = []
    run.feed_items = []
    run.audit_summary = ""

    # Clear buffered lines so a reconnecting terminal only sees retry output
    _terminal_lines[run_id] = []
    if run_id in _terminal_events:
        _terminal_events[run_id] = asyncio.Event()

    await _emit(run_id, "Onni: Hold on, let me try that again…")

    client = _get_client()
    try:
        await _run_audit_agent(run_id, run, client, plan, llm_provider, model_name)
        run.feed_items = _backfill_feed_how_to_fix(run.feed_items or [])
    except Exception as e:
        print(f"[retry_audit] audit agent failed for {run_id}: {e}")
        await _emit(run_id, f"✕ Retry failed: {e}")

    run.status = "completed"
    await _emit(run_id, "Onni: All done!")

    run.terminal_log = list(_terminal_lines.get(run_id, []))
    if user_id:
        try:
            from app.services.run_history_service import save_run
            await save_run(run, user_id)
        except Exception as e:
            print(f"[retry_audit] Failed to re-save run {run_id}: {e}")


async def run_orchestrator(
    run_id: str,
    website_url: str,
    plan: str = "free",
    user_id: str = "",
    llm_provider: Optional[str] = None,
    model_name: Optional[str] = None,
) -> None:
    """Run all four agents concurrently. Brand waits on Content via an asyncio.Event."""
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

    _run_plans[run_id] = plan
    _run_llm_providers[run_id] = llm_provider or _DEFAULT_PROVIDER
    _run_model_names[run_id] = model_name or _DEFAULT_MODEL
    if user_id:
        _run_users[run_id] = user_id
        try:
            from app.services.user_service import get_or_create_user_assistant
            _run_user_assistants[run_id] = await get_or_create_user_assistant(user_id)
        except Exception as e:
            print(f"[orchestrator] Could not resolve user assistant: {e}")

    run = _runs.get(run_id)
    if run:
        run.status = "running"
        run.chat_status = "loading"

    domain = website_url.replace("https://", "").replace("http://", "").split("/")[0]

    # Brand depends on product_info from Content; signal readiness via an event
    content_done = asyncio.Event()
    product_info_holder: list[str] = []

    await _emit(run_id, "Onni: Starting agents…")

    # ── Content ──────────────────────────────────────────────────────────────
    async def _run_content() -> None:
        await _emit(run_id, f"Content: Scanning {domain}…")
        thread = await client.create_thread(content_id)
        prompt = (
            f"URL: {website_url}\n"
            "Answer with ≤8 sentences: what the site sells/offers and main content or docs. Plain text only."
        )
        product_info = (await _add_message_with_search(
            str(thread.thread_id), prompt, plan=plan,
            stream_to_run=run_id, agent_label="Content",
            llm_provider=llm_provider, model_name=model_name,
        ))[:2000]

        product_info_holder.append(product_info)
        content_done.set()

        if run:
            run.project_description = product_info or f"Site: {website_url}"
            existing = [d for d in (run.documents or []) if d.id != "product"]
            run.documents = [DocumentItem(id="product", title="Product Information")] + existing
            run.feed_items = []
        await _store_agent_memory(run_id, f"Product/content summary for {website_url}:\n{product_info}", "content")
        await _emit(run_id, "✓ Content: Product summary ready")

    # ── Competitors ───────────────────────────────────────────────────────────
    async def _run_competitors() -> None:
        await _emit(run_id, "Competitors: Searching for rivals…")
        thread = await client.create_thread(competitor_id)
        prompt = (
            f"URL: {website_url}\n"
            "Answer with ONLY a JSON array — no markdown fences, no commentary.\n"
            "At least 3 real competitors (mix Direct and Secondary) for the same market as this URL.\n"
            'Each object: {"competitor":"<company name>","category":"Direct"|"Secondary","pricing":"<short>"} '
            '(pricing e.g. Free, $9/mo, Contact sales, Open core).'
        )
        comp_text = await _add_message_with_search(
            str(thread.thread_id), prompt, plan=plan,
            stream_to_run=run_id, agent_label="Competitors",
            llm_provider=llm_provider, model_name=model_name,
        )

        report_rows, competitors = _parse_competitor_response(comp_text)
        comp_count = len(competitors)
        if run:
            run.competitors = competitors or [CompetitorItem(id="c1", name="See report")]
            run.documents = (run.documents or []) + [DocumentItem(id="competitor", title="Competitor Analysis")]
            from datetime import datetime
            if report_rows:
                names = ", ".join(r.competitor for r in report_rows[:6])
                exec_sum = f"Mapped {len(report_rows)} competitors: {names}."
            else:
                exec_sum = comp_text[:1500] if comp_text else "No summary."
            run.competitor_report = CompetitorReport(
                title="Competitor Analysis",
                date=datetime.utcnow().strftime("As of %B %d, %Y"),
                executive_summary=exec_sum,
                rows=report_rows if report_rows else [
                    CompetitorReportRow(competitor="—", category="—", pricing=comp_text[:200] or "—"),
                ],
            )
        await _store_agent_memory(run_id, f"Competitor research for {website_url}:\n{comp_text[:2000]}", "competitors")
        await _emit(run_id, f"✓ Competitors: Found {comp_count or 'several'} competitors")

    # ── Brand (waits for Content's product_info) ──────────────────────────────
    async def _run_brand() -> None:
        await _emit(run_id, "Brand: Waiting for content…")
        await content_done.wait()
        product_info = product_info_holder[0] if product_info_holder else ""

        await _emit(run_id, "Brand: Analyzing tone and voice…")
        prompt = (
            f"URL: {website_url}\n"
            f"Context: {product_info[:300]}\n"
            "4-6 sentences: tone, formal vs casual, key themes, one example phrase that sounds like the brand."
        )
        thread = await client.create_thread(brand_id)
        brand_snippet = (await _add_message_with_search(
            str(thread.thread_id), prompt, plan=plan,
            stream_to_run=run_id, agent_label="Brand",
            llm_provider=llm_provider, model_name=model_name,
        ))[:500]
        await _store_agent_memory(run_id, f"Brand voice analysis for {website_url}:\n{brand_snippet}", "brand")
        await _emit(run_id, "✓ Brand: Voice guide ready")
        if run:
            run.brand_voice_snippet = brand_snippet
            run.documents = (run.documents or []) + [DocumentItem(id="brand", title="Brand Voice")]

    # ── Audit ─────────────────────────────────────────────────────────────────
    async def _run_audit() -> None:
        await _run_audit_agent(run_id, run, client, plan, llm_provider, model_name)

    # ── Launch all four concurrently ──────────────────────────────────────────
    await asyncio.gather(
        _run_content(),
        _run_competitors(),
        _run_brand(),
        _run_audit(),
    )

    if run:
        run.feed_items = _backfill_feed_how_to_fix(run.feed_items or [])
        if not (run.brand_voice_snippet or "").strip():
            pd = (run.project_description or "").strip()
            run.brand_voice_snippet = (
                pd[:500]
                if pd
                else "Brand voice could not be inferred this session. Review your homepage hero, about page, and product copy for tone, then document two or three voice guidelines for your team."
            )
        run.status = "completed"
        run.project_name = domain.replace(".", " ").title() if domain else "Project"
        run.chat_status = "ready"
        run.chat_messages = [
            ChatMessage(
                role="assistant",
                content=_build_greeting(run, domain),
            )
        ]

        run.terminal_log = list(_terminal_lines.get(run_id, []))
        uid = _run_users.get(run_id, "")
        if uid:
            try:
                from app.services.run_history_service import save_run
                await save_run(run, uid)
            except Exception as e:
                print(f"[history] Failed to save run {run_id}: {e}")
