import type { RunStatus } from "@/lib/api";

function scoreColor(tone: string): string {
  return tone === "green" ? "#10b981" : tone === "yellow" ? "#f59e0b" : "#ef4444";
}

function scoreBg(tone: string): string {
  return tone === "green" ? "#ecfdf5" : tone === "yellow" ? "#fffbeb" : "#fef2f2";
}

function scoreRing(score: number, tone: string): string {
  const r = 28;
  const cx = 36;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(score, 100) / 100);
  const color = scoreColor(tone);
  return `
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="6"/>
      <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${color}" stroke-width="6"
        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
        stroke-linecap="round" transform="rotate(-90 ${cx} ${cx})"/>
      <text x="${cx}" y="${cx}" text-anchor="middle" dominant-baseline="central"
        font-size="14" font-weight="700" fill="#111827">${score}</text>
    </svg>`;
}

function pawSvg(color = "#1e293b"): string {
  return `<svg width="32" height="32" viewBox="0 0 100 100" fill="${color}">
    <ellipse cx="50" cy="72" rx="23" ry="19"/>
    <ellipse cx="21" cy="46" rx="10" ry="13" transform="rotate(-18,21,46)"/>
    <ellipse cx="38" cy="32" rx="10" ry="13" transform="rotate(-6,38,32)"/>
    <ellipse cx="62" cy="32" rx="10" ry="13" transform="rotate(6,62,32)"/>
    <ellipse cx="79" cy="46" rx="10" ry="13" transform="rotate(18,79,46)"/>
  </svg>`;
}

function stripMd(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/^[-*]\s+/gm, "• ")
    .trim();
}

export function generatePdfReport(run: RunStatus): void {
  const now = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const scores = run.analytics_overview ?? [];
  const failed = run.failed_checks ?? [];
  const passed = run.passed_checks ?? [];
  const feedItems = run.feed_items ?? [];
  const report = run.competitor_report;

  const scoreCards = scores.map((m) => `
    <div class="metric-card" style="background:${scoreBg(m.tone)};">
      ${scoreRing(m.score, m.tone)}
      <div class="metric-label">${m.label}</div>
    </div>`).join("");

  const failedRows = failed.map((c) => `
    <tr>
      <td class="check-icon" style="color:#ef4444;">✕</td>
      <td class="check-name">${c.name}</td>
      <td class="check-val" style="color:#ef4444;">${c.value || "Missing"}</td>
      <td class="check-desc">${c.description || ""}</td>
    </tr>`).join("");

  const passedRows = passed.map((c) => `
    <tr>
      <td class="check-icon" style="color:#10b981;">✓</td>
      <td class="check-name">${c.name}</td>
      <td class="check-val" style="color:#10b981;">${c.value || "OK"}</td>
      <td class="check-desc">${c.description || ""}</td>
    </tr>`).join("");

  const actionItems = feedItems.map((item, i) => `
    <div class="action-item">
      <div class="action-num">${String(i + 1).padStart(2, "0")}</div>
      <div class="action-body">
        <div class="action-title">${item.title}</div>
        <div class="action-desc">${stripMd(item.description || "")}</div>
        ${item.how_to_fix ? `<div class="action-fix">${stripMd(item.how_to_fix)}</div>` : ""}
      </div>
      <div class="action-badge ${item.status === "critical" ? "badge-critical" : item.status === "warning" ? "badge-warn" : "badge-info"}">${item.status}</div>
    </div>`).join("");

  const competitorSection = report ? `
    <div class="section">
      <div class="section-header">
        <h2 class="section-title">Competitor Analysis</h2>
      </div>
      <p class="summary-text">${stripMd(report.executive_summary || "")}</p>
      ${report.rows.length > 0 ? `
      <table class="data-table" style="margin-top:16px;">
        <thead>
          <tr>
            <th>Competitor</th>
            <th>Category</th>
            <th>Pricing</th>
          </tr>
        </thead>
        <tbody>
          ${report.rows.map((r) => `
          <tr>
            <td>${r.competitor.replace(/\*\*/g, "")}</td>
            <td>${r.category.replace(/\*\*/g, "")}</td>
            <td>${r.pricing.replace(/\*\*/g, "")}</td>
          </tr>`).join("")}
        </tbody>
      </table>` : ""}
    </div>` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>CMO Report — ${run.project_name || run.website_url}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: 'Inter', system-ui, sans-serif; color: #111827; background: #fff; font-size: 14px; line-height: 1.6; }

    /* ── COVER ── */
    .cover {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f2240 100%);
      color: #fff;
      padding: 56px 56px 48px;
      min-height: 240px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      break-after: avoid;
    }
    .cover-top { display: flex; align-items: center; gap: 12px; }
    .cover-brand { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #fff; }
    .cover-tagline { font-size: 12px; color: #94a3b8; letter-spacing: 0.5px; margin-top: 2px; }
    .cover-divider { width: 48px; height: 3px; background: linear-gradient(90deg, #3b82f6, #8b5cf6); border-radius: 2px; margin: 24px 0; }
    .cover-title { font-size: 32px; font-weight: 800; line-height: 1.2; letter-spacing: -1px; }
    .cover-url { font-size: 14px; color: #64748b; margin-top: 8px; }
    .cover-meta { display: flex; gap: 32px; margin-top: 32px; }
    .cover-meta-item { }
    .cover-meta-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; }
    .cover-meta-value { font-size: 15px; font-weight: 600; color: #e2e8f0; margin-top: 2px; }

    /* ── SECTIONS ── */
    .section { padding: 32px 56px; border-bottom: 1px solid #f1f5f9; }
    .section:last-child { border-bottom: none; }
    .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
    .section-num { width: 28px; height: 28px; border-radius: 50%; background: #0f172a; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .section-title { font-size: 18px; font-weight: 700; color: #0f172a; letter-spacing: -0.3px; }

    /* ── METRIC CARDS ── */
    .metrics-grid { display: flex; gap: 16px; flex-wrap: wrap; }
    .metric-card {
      flex: 1; min-width: 120px;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      border: 1px solid rgba(0,0,0,0.05);
    }
    .metric-label { font-size: 12px; color: #6b7280; text-align: center; font-weight: 500; }

    /* ── SUMMARY TEXT ── */
    .summary-text { font-size: 14px; color: #374151; line-height: 1.7; max-width: 720px; }

    /* ── CHECKS TABLE ── */
    .checks-table { width: 100%; border-collapse: collapse; }
    .checks-table thead tr { background: #f8fafc; }
    .checks-table th { text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
    .checks-table td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .checks-table tbody tr:last-child td { border-bottom: none; }
    .check-icon { font-size: 14px; width: 24px; font-weight: 700; }
    .check-name { font-size: 13px; font-weight: 500; color: #111827; width: 200px; }
    .check-val { font-size: 12px; font-weight: 600; width: 100px; }
    .check-desc { font-size: 12px; color: #6b7280; }

    /* ── ACTION ITEMS ── */
    .action-item {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      padding: 16px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      margin-bottom: 12px;
      background: #fafafa;
    }
    .action-num { font-size: 22px; font-weight: 800; color: #e5e7eb; line-height: 1; width: 36px; flex-shrink: 0; padding-top: 2px; }
    .action-body { flex: 1; min-width: 0; }
    .action-title { font-size: 14px; font-weight: 600; color: #111827; }
    .action-desc { font-size: 13px; color: #6b7280; margin-top: 4px; }
    .action-fix { font-size: 12px; color: #374151; margin-top: 8px; padding: 8px 10px; background: #fff; border-radius: 6px; border-left: 3px solid #3b82f6; }
    .action-badge { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px; text-transform: capitalize; flex-shrink: 0; }
    .badge-critical { background: #fef2f2; color: #ef4444; }
    .badge-warn { background: #fffbeb; color: #d97706; }
    .badge-info { background: #eff6ff; color: #3b82f6; }

    /* ── DATA TABLE ── */
    .data-table { width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; }
    .data-table thead tr { background: #f1f5f9; }
    .data-table th { text-align: left; font-size: 12px; font-weight: 600; color: #374151; padding: 11px 14px; }
    .data-table td { padding: 10px 14px; border-top: 1px solid #f1f5f9; font-size: 13px; color: #374151; }
    .data-table tbody tr:nth-child(even) td { background: #f8fafc; }

    /* ── FOOTER ── */
    .footer {
      background: #0f172a;
      color: #64748b;
      padding: 24px 56px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
    }
    .footer-brand { color: #94a3b8; font-weight: 600; display: flex; align-items: center; gap: 8px; }

    /* ── STATS SUMMARY BAR ── */
    .stats-bar {
      display: flex;
      gap: 0;
      background: #f8fafc;
      border-radius: 10px;
      border: 1px solid #e5e7eb;
      overflow: hidden;
      margin-bottom: 24px;
    }
    .stat-cell {
      flex: 1;
      padding: 16px 20px;
      border-right: 1px solid #e5e7eb;
      text-align: center;
    }
    .stat-cell:last-child { border-right: none; }
    .stat-value { font-size: 28px; font-weight: 800; color: #0f172a; letter-spacing: -1px; }
    .stat-label { font-size: 11px; font-weight: 500; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
    .stat-value.green { color: #10b981; }
    .stat-value.red { color: #ef4444; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .footer { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .action-item { break-inside: avoid; }
      .section { break-inside: avoid; }
    }

    @page { margin: 0; size: A4; }
  </style>
</head>
<body>

  <!-- COVER -->
  <div class="cover">
    <div class="cover-top">
      ${pawSvg("#ffffff")}
      <div>
        <div class="cover-brand">cmo.dog</div>
        <div class="cover-tagline">AI-POWERED MARKETING INTELLIGENCE</div>
      </div>
    </div>
    <div>
      <div class="cover-divider"></div>
      <div class="cover-title">${run.project_name || "Marketing Audit"}</div>
      <div class="cover-url">${run.website_url}</div>
      <div class="cover-meta">
        <div class="cover-meta-item">
          <div class="cover-meta-label">Report Date</div>
          <div class="cover-meta-value">${now}</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">Issues Found</div>
          <div class="cover-meta-value">${failed.length}</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">Checks Passed</div>
          <div class="cover-meta-value">${passed.length}</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">Action Items</div>
          <div class="cover-meta-value">${feedItems.length}</div>
        </div>
      </div>
    </div>
  </div>

  ${run.audit_summary || run.project_description ? `
  <!-- EXECUTIVE SUMMARY -->
  <div class="section">
    <div class="section-header">
      <div class="section-num">1</div>
      <h2 class="section-title">Executive Summary</h2>
    </div>
    ${run.audit_summary ? `<p class="summary-text">${stripMd(run.audit_summary)}</p>` : ""}
    ${run.project_description ? `<p class="summary-text" style="margin-top:12px;color:#6b7280;">${stripMd(run.project_description)}</p>` : ""}
  </div>` : ""}

  ${scores.length > 0 ? `
  <!-- PAGE SPEED -->
  <div class="section">
    <div class="section-header">
      <div class="section-num">${run.audit_summary ? "2" : "1"}</div>
      <h2 class="section-title">Page Speed</h2>
    </div>
    <div class="metrics-grid">
      ${scoreCards}
    </div>
  </div>` : ""}

  ${(failed.length > 0 || passed.length > 0) ? `
  <!-- SEO HEALTH -->
  <div class="section">
    <div class="section-header">
      <div class="section-num">${2 + (scores.length > 0 ? 1 : 0) + (run.audit_summary ? 0 : -1)}</div>
      <h2 class="section-title">SEO Health Checks</h2>
    </div>
    <div class="stats-bar">
      <div class="stat-cell">
        <div class="stat-value red">${failed.length}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-cell">
        <div class="stat-value green">${passed.length}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat-cell">
        <div class="stat-value">${Math.round((passed.length / (passed.length + failed.length || 1)) * 100)}%</div>
        <div class="stat-label">Pass Rate</div>
      </div>
    </div>
    ${failed.length > 0 ? `
    <p style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;margin-bottom:10px;">Issues to Fix</p>
    <table class="checks-table">
      <thead><tr><th></th><th>Check</th><th>Value</th><th>Details</th></tr></thead>
      <tbody>${failedRows}</tbody>
    </table>` : ""}
    ${passed.length > 0 ? `
    <p style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;margin-top:20px;margin-bottom:10px;">Passing Checks</p>
    <table class="checks-table">
      <thead><tr><th></th><th>Check</th><th>Value</th><th>Details</th></tr></thead>
      <tbody>${passedRows}</tbody>
    </table>` : ""}
  </div>` : ""}

  ${feedItems.length > 0 ? `
  <!-- ACTION ITEMS -->
  <div class="section">
    <div class="section-header">
      <div class="section-num">★</div>
      <h2 class="section-title">AI CMO Action Items</h2>
    </div>
    ${actionItems}
  </div>` : ""}

  ${competitorSection}

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-brand">
      ${pawSvg("#64748b")}
      cmo.dog — AI Marketing Intelligence
    </div>
    <div>Generated ${now} · Confidential</div>
  </div>

  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) {
    win.addEventListener("afterprint", () => {
      URL.revokeObjectURL(url);
    });
  }
}
