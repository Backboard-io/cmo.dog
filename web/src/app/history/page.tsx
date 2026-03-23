"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getHistory, getStoredToken, retryAudit, type RunSummary } from "@/lib/api";
import { ReleaseNotesModal } from "@/components/ReleaseNotesModal";
import { BackboardBadge } from "@/components/BackboardBadge";

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

// ─── Sad dog SVG ──────────────────────────────────────────────────────────────

function SadDogFace({ className = "w-14 h-14" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" aria-hidden>
      {/* Floppy left ear */}
      <ellipse cx="14" cy="40" rx="10" ry="15" fill="#D4A76A" transform="rotate(8 14 40)" />
      {/* Floppy right ear */}
      <ellipse cx="66" cy="40" rx="10" ry="15" fill="#D4A76A" transform="rotate(-8 66 40)" />
      {/* Head */}
      <circle cx="40" cy="43" r="27" fill="#F0C87A" />
      {/* Sad inner brow (left) — dips toward nose bridge */}
      <path d="M25 32 Q31 28 37 31" stroke="#8B5E3C" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Sad inner brow (right) */}
      <path d="M43 31 Q49 28 55 32" stroke="#8B5E3C" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Left eye */}
      <circle cx="30" cy="39" r="5" fill="#2D1B00" />
      <circle cx="31.5" cy="37.5" r="1.5" fill="white" />
      {/* Right eye */}
      <circle cx="50" cy="39" r="5" fill="#2D1B00" />
      <circle cx="51.5" cy="37.5" r="1.5" fill="white" />
      {/* Nose */}
      <ellipse cx="40" cy="50" rx="5" ry="3.5" fill="#8B5E3C" />
      {/* Sad frown */}
      <path d="M31 60 Q40 56 49 60" stroke="#8B5E3C" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Teardrop on left cheek */}
      <path d="M28 43 Q26 49 28 51 Q30 49 28 43Z" fill="#93C5FD" opacity="0.85" />
    </svg>
  );
}

// ─── Run card ─────────────────────────────────────────────────────────────────

const SCORE_KEYS: { key: string; label: string }[] = [
  { key: "seo", label: "SEO" },
  { key: "performance", label: "Perf" },
  { key: "accessibility", label: "A11y" },
  { key: "best_practices", label: "BP" },
];

function RunCard({
  run,
  index,
  onClick,
  onRetry,
}: {
  run: RunSummary;
  index: number;
  onClick: () => void;
  onRetry?: () => Promise<void>;
}) {
  const [retrying, setRetrying] = useState(false);

  const date = new Date(run.created_at);
  const dateLabel = isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  const domain = run.website_url
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  const scores = run.scores ?? {};
  const auditEmpty =
    run.status === "completed" &&
    Object.values(scores).every((s) => s === 0) &&
    run.issues_count === 0 &&
    run.passed_count === 0;

  const issuesLabel =
    auditEmpty
      ? "Audit empty"
      : run.issues_count === 0
      ? "All clear 🎉"
      : `${run.issues_count} issue${run.issues_count === 1 ? "" : "s"}`;

  const issuesColor =
    auditEmpty
      ? "text-orange-600 bg-orange-50 border-orange-200"
      : run.issues_count === 0
      ? "text-green-600 bg-green-50 border-green-200"
      : run.issues_count <= 3
      ? "text-amber-600 bg-amber-50 border-amber-200"
      : "text-red-600 bg-red-50 border-red-200";

  const modelLabel = run.model_name
    ? run.model_name.includes("/")
      ? run.model_name.split("/").pop()!
      : run.model_name
    : null;

  async function handleRetry(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onRetry || retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div
      className="group w-full text-left rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
      style={{ animation: `cardIn 0.4s ${index * 60}ms cubic-bezier(0.22,1,0.36,1) both` }}
    >
      {/* Clickable main area */}
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => e.key === "Enter" && onClick()}
        className="p-5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-bb-blue/30 rounded-2xl"
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
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${issuesColor}`}>
              {issuesLabel}
            </span>
            <span className="text-[10px] text-gray-400">{dateLabel}</span>
            {modelLabel && (
              <span
                className="text-[10px] text-bb-steel/70 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded font-mono truncate max-w-[120px]"
                title={run.model_name}
              >
                {modelLabel}
              </span>
            )}
          </div>
        </div>

        {/* Score rings — or sad dog when audit empty */}
        {auditEmpty ? (
          <div className="mt-3 flex items-center gap-3">
            <div style={{ animation: "sadSway 2.8s ease-in-out infinite" }}>
              <SadDogFace className="w-12 h-12 flex-shrink-0" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Woof… nothing came back</p>
              <p className="text-xs text-gray-400 mt-0.5">The model returned an empty audit.</p>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex gap-4">
            {SCORE_KEYS.map(({ key, label }) => {
              const score = scores[key] ?? 0;
              return <ScoreRing key={key} score={score} label={label} size={44} />;
            })}
            <div className="flex-1" />
            <div className="self-end mb-1 text-bb-steel/40 group-hover:text-bb-blue/60 group-hover:translate-x-0.5 transition-all">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Retry strip — only visible when audit empty */}
      {auditEmpty && onRetry && (
        <div className="px-5 pb-4">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className={`
              w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
              transition-all duration-200 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/40
              ${retrying
                ? "bg-orange-50 text-orange-400 cursor-wait"
                : "bg-orange-500 text-white hover:bg-orange-600 shadow-sm hover:shadow-[0_4px_16px_rgba(249,115,22,0.35)]"
              }
            `}
          >
            {retrying ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
                  <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 2a10 10 0 0 1 10 10" className="origin-center" />
                </svg>
                <span>Sniffing again…</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 100 100" fill="currentColor" className="w-4 h-4" aria-hidden>
                  <ellipse cx="50" cy="72" rx="23" ry="19" />
                  <ellipse cx="21" cy="46" rx="10" ry="13" transform="rotate(-18, 21, 46)" />
                  <ellipse cx="38" cy="32" rx="10" ry="13" transform="rotate(-6, 38, 32)" />
                  <ellipse cx="62" cy="32" rx="10" ry="13" transform="rotate(6, 62, 32)" />
                  <ellipse cx="79" cy="46" rx="10" ry="13" transform="rotate(18, 79, 46)" />
                </svg>
                <span>Retry Audit</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  useEffect(() => {
    const t = getStoredToken();
    if (!t) {
      router.replace("/");
      return;
    }
    setToken(t);
    getHistory(t)
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
                onRetry={token ? async () => {
                  await retryAudit(run.run_id, token);
                  router.push(`/run/${run.run_id}`);
                } : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer — pinned to bottom of scroll container */}
      <div className="w-full flex flex-wrap items-center justify-center gap-4 py-3 border-t border-gray-100 bg-white">
        <button
          onClick={() => setShowReleaseNotes(true)}
          className="text-[11px] text-bb-steel/50 hover:text-bb-steel transition-colors underline underline-offset-2 decoration-bb-steel/20"
        >
          What&apos;s new in v2.4.4
        </button>

        <span className="text-bb-steel/20 text-xs">·</span>

        <BackboardBadge />
      </div>

      {showReleaseNotes && (
        <ReleaseNotesModal onClose={() => setShowReleaseNotes(false)} />
      )}

      <style jsx>{`
        @keyframes pageIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes sadSway {
          0%, 100% { transform: rotate(-4deg) translateY(0px); }
          50%       { transform: rotate(4deg) translateY(-3px); }
        }
      `}</style>
    </div>
  );
}
