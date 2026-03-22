"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getHistory, getStoredToken, type RunSummary } from "@/lib/api";

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({
  score,
  label,
  size = 44,
}: {
  score: number;
  label: string;
  size?: number;
}) {
  const r = size * 0.38;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(score, 100) / 100);
  const color =
    score >= 90 ? "#10b981" : score >= 70 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
        <text
          x={cx}
          y={cx}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size * 0.26}
          fontWeight="700"
          fill="#111827"
        >
          {score}
        </text>
      </svg>
      <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard({ i }: { i: number }) {
  return (
    <div
      className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm animate-pulse"
      style={{ animationDelay: `${i * 80}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-100 rounded w-3/4" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
        <div className="h-6 w-14 bg-gray-100 rounded-full" />
      </div>
      <div className="mt-4 flex gap-4">
        {[...Array(4)].map((_, k) => (
          <div key={k} className="flex flex-col items-center gap-1">
            <div className="w-11 h-11 rounded-full bg-gray-100" />
            <div className="h-2 w-10 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onFetch }: { onFetch: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 py-16 text-center">
      {/* Animated paw SVG */}
      <div
        className="text-bb-phantom/20"
        style={{ animation: "emptyFloat 3s ease-in-out infinite" }}
        aria-hidden
      >
        <svg width="96" height="96" viewBox="0 0 100 100" fill="currentColor">
          <ellipse cx="50" cy="72" rx="24" ry="20" />
          <ellipse cx="24" cy="50" rx="11" ry="13" />
          <ellipse cx="42" cy="40" rx="11" ry="13" />
          <ellipse cx="60" cy="40" rx="11" ry="13" />
          <ellipse cx="77" cy="50" rx="11" ry="13" />
        </svg>
      </div>

      <div className="space-y-2 max-w-xs">
        <h2 className="text-xl font-semibold text-bb-phantom">
          No runs yet — go fetch!
        </h2>
        <p className="text-sm text-bb-steel">
          Once Onni analyses a site, each report lands here for you to review any time.
        </p>
      </div>

      <button
        onClick={onFetch}
        className="rounded-full bg-bb-phantom text-white px-6 py-2.5 text-sm font-medium shadow hover:bg-bb-phantom/80 active:scale-[0.97] transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bb-phantom"
      >
        Analyse your first site 🐾
      </button>

      <style jsx>{`
        @keyframes emptyFloat {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}

// ─── Run card ─────────────────────────────────────────────────────────────────

const SCORE_KEYS: { key: string; label: string }[] = [
  { key: "seo", label: "SEO" },
  { key: "performance", label: "Perf" },
  { key: "accessibility", label: "A11y" },
  { key: "best_practices", label: "BP" },
];

function RunCard({ run, index, onClick }: { run: RunSummary; index: number; onClick: () => void }) {
  const date = new Date(run.created_at);
  const dateLabel = isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  const domain = run.website_url
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  const issuesLabel =
    run.issues_count === 0
      ? "All clear 🎉"
      : `${run.issues_count} issue${run.issues_count === 1 ? "" : "s"}`;

  const issuesColor =
    run.issues_count === 0
      ? "text-green-600 bg-green-50 border-green-200"
      : run.issues_count <= 3
      ? "text-amber-600 bg-amber-50 border-amber-200"
      : "text-red-600 bg-red-50 border-red-200";

  const modelLabel = run.model_name
    ? run.model_name.includes("/")
      ? run.model_name.split("/").pop()!
      : run.model_name
    : null;

  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-bb-blue/30"
      style={{
        animation: `cardIn 0.4s ${index * 60}ms cubic-bezier(0.22,1,0.36,1) both`,
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-bb-phantom truncate group-hover:text-bb-blue transition-colors">
            {run.project_name || domain}
          </p>
          <p className="text-xs text-bb-steel truncate mt-0.5">{domain}</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${issuesColor}`}
          >
            {issuesLabel}
          </span>
          <span className="text-[10px] text-gray-400">{dateLabel}</span>
          {modelLabel && (
            <span className="text-[10px] text-bb-steel/70 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded font-mono truncate max-w-[120px]" title={run.model_name}>
              {modelLabel}
            </span>
          )}
        </div>
      </div>

      {/* Score rings */}
      <div className="mt-4 flex gap-4">
        {SCORE_KEYS.map(({ key, label }) => {
          const score = run.scores?.[key] ?? 0;
          return <ScoreRing key={key} score={score} label={label} size={44} />;
        })}
        <div className="flex-1" />
        {/* Arrow hint */}
        <div className="self-end mb-1 text-bb-steel/40 group-hover:text-bb-blue/60 group-hover:translate-x-0.5 transition-all">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/");
      return;
    }
    getHistory(token)
      .then((data) => setRuns(data.runs))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load history"));
  }, [router]);

  return (
    <div
      className="flex flex-col flex-1 overflow-hidden"
      style={{ animation: "pageIn 0.35s cubic-bezier(0.22,1,0.36,1) both" }}
    >
      {/* Sub-header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div>
          <h1 className="text-base font-semibold text-bb-phantom">Run History</h1>
          {runs !== null && (
            <p className="text-xs text-bb-steel mt-0.5">
              {runs.length === 0
                ? "No analyses yet"
                : `${runs.length} report${runs.length === 1 ? "" : "s"} saved`}
            </p>
          )}
        </div>
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-xs text-bb-blue font-medium hover:underline focus:outline-none"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="M10 3H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6" strokeLinecap="round" />
            <path d="M8 8l5-5M10 3h3v3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          New analysis
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {error && (
          <p className="text-sm text-red-500 text-center py-8">{error}</p>
        )}

        {!error && runs === null && (
          <div className="grid gap-3 sm:grid-cols-2">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} i={i} />)}
          </div>
        )}

        {!error && runs !== null && runs.length === 0 && (
          <EmptyState onFetch={() => router.push("/")} />
        )}

        {!error && runs !== null && runs.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {runs.map((run, i) => (
              <RunCard
                key={run.run_id}
                run={run}
                index={i}
                onClick={() => router.push(`/run/${run.run_id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes pageIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
