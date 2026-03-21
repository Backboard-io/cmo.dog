"""Monthly monitor scheduler.

Runs every hour via APScheduler. For each active monitor whose
next_run_at has passed, it:
  1. Kicks off a full orchestrator run (same as a user-triggered run)
  2. Waits for it to complete (polls up to 10 minutes)
  3. Sends an HTML email report via Gmail
  4. Bumps next_run_at forward 30 days
"""

import asyncio
import uuid
from datetime import datetime, timezone
from html import escape

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.services.monitor_service import list_all_monitors, update_monitor_next_run
from app.services.gmail_sender import SendEmailRequest, send_email

_scheduler: AsyncIOScheduler | None = None

# ── Email template ─────────────────────────────────────────────────────────────

def _score_bar(score: int) -> str:
    color = "#10b981" if score >= 80 else "#f59e0b" if score >= 60 else "#ef4444"
    pct = min(100, score)
    return (
        f'<div style="display:inline-block;width:60px;height:6px;background:#e5e7eb;border-radius:3px;vertical-align:middle;margin-left:6px;">'
        f'<div style="width:{pct}%;height:100%;background:{color};border-radius:3px;"></div></div>'
    )


def _build_html_report(run, domain: str, monitor: dict) -> str:
    analytics = run.analytics_overview or []
    failed = run.failed_checks or []
    competitors = run.competitors or []
    brand_voice = run.brand_voice_snippet or ""
    audit_summary = run.audit_summary or ""

    # Score rows
    score_rows = ""
    for m in analytics:
        color = "#10b981" if m.score >= 80 else "#f59e0b" if m.score >= 60 else "#ef4444"
        score_rows += (
            f'<tr>'
            f'<td style="padding:6px 0;font-size:14px;color:#374151;">{escape(m.label)}</td>'
            f'<td style="padding:6px 0;text-align:right;">'
            f'<span style="font-size:14px;font-weight:700;color:{color};">{m.score}</span>'
            f'{_score_bar(m.score)}'
            f'</td>'
            f'</tr>'
        )

    # Top issues (max 5)
    issue_rows = ""
    for item in failed[:5]:
        issue_rows += (
            f'<li style="margin:6px 0;font-size:13px;color:#374151;line-height:1.45;">'
            f'<strong style="color:#111827;">{escape(item.name)}</strong> — {escape(item.description[:120])}'
            f'</li>'
        )
    if not issue_rows:
        issue_rows = '<li style="color:#6b7280;font-size:13px;">No critical issues found 🎉</li>'

    # Competitors (max 8)
    comp_pills = ""
    for c in competitors[:8]:
        comp_pills += (
            f'<span style="display:inline-block;margin:3px;padding:4px 10px;border-radius:20px;'
            f'background:#f3f4f6;font-size:12px;color:#374151;">{escape(c.name)}</span>'
        )
    if not comp_pills:
        comp_pills = '<span style="font-size:13px;color:#6b7280;">No competitors mapped this cycle.</span>'

    # Brand voice
    brand_html = (
        f'<p style="font-size:13px;color:#374151;line-height:1.55;font-style:italic;'
        f'border-left:3px solid #3b82f6;padding-left:12px;margin:0;">'
        f'{escape(brand_voice[:400])}</p>'
        if brand_voice else ""
    )

    track_flag = ""
    if monitor.get("track_new_competitors"):
        new_count = len(competitors)
        track_flag = (
            f'<p style="font-size:12px;color:#6b7280;margin-top:6px;">'
            f'🔭 Competitor discovery active — {new_count} rival{"s" if new_count != 1 else ""} tracked this cycle.</p>'
        )

    domain_url = monitor.get("domain", f"https://{domain}")

    return f"""<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

  <!-- Header -->
  <div style="background:#0f1117;padding:28px 32px;">
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.4);letter-spacing:0.05em;text-transform:uppercase;">Monthly Report</p>
    <h1 style="margin:6px 0 0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">
      {escape(domain)}
    </h1>
    <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.35);">
      {datetime.now(timezone.utc).strftime("%B %Y")} · CMO.dog
    </p>
  </div>

  <div style="padding:28px 32px;">

    <!-- Scores -->
    <h2 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#111827;letter-spacing:-0.01em;">📊 Site Scores</h2>
    <table style="width:100%;border-collapse:collapse;">
      {score_rows}
    </table>

    <!-- Audit summary -->
    {f'<p style="margin:16px 0 0;font-size:13px;color:#6b7280;line-height:1.55;">{escape(audit_summary[:300])}</p>' if audit_summary else ""}

    <hr style="margin:24px 0;border:none;border-top:1px solid #f3f4f6;">

    <!-- Issues -->
    <h2 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#111827;letter-spacing:-0.01em;">⚠️ Top Issues to Fix</h2>
    <ul style="margin:0;padding-left:18px;">
      {issue_rows}
    </ul>

    <hr style="margin:24px 0;border:none;border-top:1px solid #f3f4f6;">

    <!-- Competitors -->
    <h2 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#111827;letter-spacing:-0.01em;">🏆 Competitors Tracked</h2>
    <div>{comp_pills}</div>
    {track_flag}

    <!-- Brand voice -->
    {f'<hr style="margin:24px 0;border:none;border-top:1px solid #f3f4f6;"><h2 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#111827;letter-spacing:-0.01em;">🎙️ Brand Voice</h2>{brand_html}' if brand_html else ""}

    <hr style="margin:24px 0;border:none;border-top:1px solid #f3f4f6;">

    <!-- CTA -->
    <div style="text-align:center;padding:8px 0;">
      <a href="{escape(domain_url)}"
         style="display:inline-block;padding:12px 28px;background:#0f1117;color:#ffffff;
                text-decoration:none;border-radius:10px;font-size:14px;font-weight:700;
                letter-spacing:-0.01em;">
        View your site →
      </a>
    </div>

  </div>

  <!-- Footer -->
  <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #f3f4f6;">
    <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">
      Sent by <strong>CMO.dog</strong> · Monthly Monitor ·
      Next report in ~30 days
    </p>
  </div>

</div>
</body>
</html>"""


def _build_plain_report(run, domain: str) -> str:
    analytics = run.analytics_overview or []
    failed = run.failed_checks or []
    competitors = run.competitors or []

    lines = [
        f"CMO.dog Monthly Report — {domain}",
        f"{datetime.now(timezone.utc).strftime('%B %Y')}",
        "",
        "SCORES",
    ]
    for m in analytics:
        lines.append(f"  {m.label}: {m.score}/100")

    lines += ["", "TOP ISSUES"]
    for item in failed[:5]:
        lines.append(f"  • {item.name} — {item.description[:100]}")
    if not failed:
        lines.append("  No critical issues found.")

    lines += ["", "COMPETITORS"]
    if competitors:
        lines.append("  " + ", ".join(c.name for c in competitors[:8]))
    else:
        lines.append("  None tracked this cycle.")

    if run.brand_voice_snippet:
        lines += ["", "BRAND VOICE", f"  {run.brand_voice_snippet[:300]}"]

    lines += ["", "—", "Sent by CMO.dog Monthly Monitor"]
    return "\n".join(lines)


# ── Run + wait ─────────────────────────────────────────────────────────────────

async def _run_and_wait(domain: str, user_id: str) -> tuple[str, object | None]:
    """Trigger a run and wait up to 10 minutes for completion. Returns (run_id, run)."""
    import app.orchestrator as orch
    from app.schemas import RunStatus, AnalyticsMetric

    run_id = uuid.uuid4().hex[:12]
    orch._runs[run_id] = RunStatus(
        run_id=run_id,
        status="pending",
        website_url=domain,
        analytics_overview=[
            AnalyticsMetric(key="performance", label="Performance", score=0, tone="red"),
            AnalyticsMetric(key="accessibility", label="Accessibility", score=0, tone="red"),
            AnalyticsMetric(key="best_practices", label="Best Practices", score=0, tone="red"),
            AnalyticsMetric(key="seo", label="SEO", score=0, tone="red"),
        ],
        feed_items=[],
        chat_status="loading",
    )
    orch._terminal_lines[run_id] = []
    orch._terminal_events[run_id] = asyncio.Event()

    task = asyncio.create_task(
        orch.run_orchestrator(run_id, domain, plan="paid", user_id=user_id)
    )

    # Poll up to 10 minutes
    for _ in range(120):
        await asyncio.sleep(5)
        run = orch.get_run(run_id)
        if run and run.status in ("completed", "failed"):
            break

    run = orch.get_run(run_id)
    if not task.done():
        task.cancel()
    return run_id, run


# ── Core job ───────────────────────────────────────────────────────────────────

async def _process_monitor(monitor: dict) -> None:
    monitor_id = monitor["monitor_id"]
    user_id = monitor["user_id"]
    domain = monitor.get("domain", "")
    notify_email = monitor.get("notify_email", "")
    display_domain = domain.replace("https://", "").replace("http://", "").rstrip("/")

    print(f"[monitor-scheduler] Starting run for {display_domain} → {notify_email}")

    run_id, run = await _run_and_wait(domain, user_id)

    if not run or run.status != "completed":
        print(f"[monitor-scheduler] Run {run_id} did not complete for {display_domain} — skipping email")
        return

    html = _build_html_report(run, display_domain, monitor)
    plain = _build_plain_report(run, display_domain)

    result = send_email(SendEmailRequest(
        to_email=notify_email,
        subject=f"Your monthly CMO report — {display_domain}",
        body=plain,
        html_body=html,
        from_name="Onni @ CMO.dog",
    ))

    if result.success:
        print(f"[monitor-scheduler] ✓ Sent report for {display_domain} to {notify_email}")
        await update_monitor_next_run(monitor_id, user_id)
    else:
        print(f"[monitor-scheduler] ✗ Email failed for {display_domain}: {result.error}")


async def run_due_monitors() -> None:
    """Check all monitors and fire any that are due. Called by the scheduler."""
    try:
        monitors = await list_all_monitors()
    except Exception as e:
        print(f"[monitor-scheduler] Failed to list monitors: {e}")
        return

    now = datetime.now(timezone.utc)
    due = []
    for m in monitors:
        next_run_str = m.get("next_run_at", "")
        if not next_run_str:
            due.append(m)
            continue
        try:
            next_run = datetime.fromisoformat(next_run_str)
            if next_run.tzinfo is None:
                next_run = next_run.replace(tzinfo=timezone.utc)
            if next_run <= now:
                due.append(m)
        except ValueError:
            due.append(m)

    if not due:
        return

    print(f"[monitor-scheduler] {len(due)} monitor(s) due — processing sequentially")
    for monitor in due:
        try:
            await _process_monitor(monitor)
        except Exception as e:
            print(f"[monitor-scheduler] Error processing {monitor.get('monitor_id')}: {e}")


# ── Scheduler lifecycle ────────────────────────────────────────────────────────

def start_scheduler() -> AsyncIOScheduler:
    global _scheduler
    _scheduler = AsyncIOScheduler(timezone="UTC")
    # Check every hour; also fires once 60s after startup for quick local testing
    _scheduler.add_job(run_due_monitors, "interval", hours=1, id="monthly_monitors")
    _scheduler.start()
    print("[monitor-scheduler] Started — checks every hour")
    return _scheduler


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        print("[monitor-scheduler] Stopped")
