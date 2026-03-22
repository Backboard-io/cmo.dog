"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { getRun, chatRun, retryAudit, getStoredToken, getMe, type RunStatus, type UserInfo } from "@/lib/api";
import { Terminal } from "@/components/terminal";
import { ReportModal } from "@/components/report-modal";
import { FixDrawer } from "@/components/fix-drawer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronRight, Maximize2, Plus, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { PdfReportButton } from "@/components/PdfReportButton";
import { MonthlyMonitorModal } from "@/components/MonthlyMonitorModal";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { ReleaseNotesModal } from "@/components/ReleaseNotesModal";
import { BackboardBadge } from "@/components/BackboardBadge";
function CircleProgress({ score, tone }: { score: number; tone: string }) {
  const r = 22;
  const cx = 28;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(score, 100) / 100);
  const color =
    tone === "green" ? "#10b981" :
    tone === "yellow" ? "#f59e0b" :
    "#ef4444";

  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
      <circle
        cx={cx} cy={cx} r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text x={cx} y={cx} textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="700" fill="#111827">
        {score}
      </text>
    </svg>
  );
}

function HealthRow({
  name,
  value,
  passed,
  warn,
}: {
  name: string;
  value: string;
  passed: boolean;
  warn?: boolean;
}) {
  const bg = warn
    ? "bg-yellow-50"
    : passed
    ? "bg-green-50"
    : "bg-red-50";
  const iconColor = warn ? "text-yellow-400" : passed ? "text-green-500" : "text-red-400";
  const valueColor = warn ? "text-yellow-600" : passed ? "text-green-600" : "text-red-500";

  return (
    <li className={`flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-md ${bg}`}>
      <span className={`flex items-center gap-1.5 min-w-0`}>
        <span className={`${iconColor} text-xs flex-shrink-0 w-3 text-center`}>
          {warn ? "△" : passed ? "✓" : "✕"}
        </span>
        <span className="text-xs text-gray-700 truncate">{name}</span>
      </span>
      <span className={`text-xs font-medium flex-shrink-0 ${valueColor}`}>
        {value || (passed ? "OK" : "Missing")}
      </span>
    </li>
  );
}

const SadDogFace = ({ className = "w-16 h-16" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 80 80" fill="none" aria-hidden>
    <ellipse cx="14" cy="40" rx="10" ry="15" fill="#D4A76A" transform="rotate(8 14 40)" />
    <ellipse cx="66" cy="40" rx="10" ry="15" fill="#D4A76A" transform="rotate(-8 66 40)" />
    <circle cx="40" cy="43" r="27" fill="#F0C87A" />
    <path d="M25 32 Q31 28 37 31" stroke="#8B5E3C" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <path d="M43 31 Q49 28 55 32" stroke="#8B5E3C" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <circle cx="30" cy="39" r="5" fill="#2D1B00" />
    <circle cx="31.5" cy="37.5" r="1.5" fill="white" />
    <circle cx="50" cy="39" r="5" fill="#2D1B00" />
    <circle cx="51.5" cy="37.5" r="1.5" fill="white" />
    <ellipse cx="40" cy="50" rx="5" ry="3.5" fill="#8B5E3C" />
    <path d="M31 60 Q40 56 49 60" stroke="#8B5E3C" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <path d="M28 43 Q26 49 28 51 Q30 49 28 43Z" fill="#93C5FD" opacity="0.85" />
  </svg>
);

const PawIcon = ({ className = "w-12 h-12" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="currentColor" aria-hidden>
    <ellipse cx="50" cy="72" rx="23" ry="19" />
    <ellipse cx="21" cy="46" rx="10" ry="13" transform="rotate(-18, 21, 46)" />
    <ellipse cx="38" cy="32" rx="10" ry="13" transform="rotate(-6, 38, 32)" />
    <ellipse cx="62" cy="32" rx="10" ry="13" transform="rotate(6, 62, 32)" />
    <ellipse cx="79" cy="46" rx="10" ry="13" transform="rotate(18, 79, 46)" />
  </svg>
);

const CheckCircle = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 12.5l2.5 2.5 4.5-5" />
  </svg>
);

const XCircle = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l6 6M15 9l-6 6" />
  </svg>
);

function SectionToggle({
  label,
  badge,
  open,
  onToggle,
  accent = "bg-bb-phantom",
}: {
  label: React.ReactNode;
  badge?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  accent?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`lg:hidden flex-shrink-0 flex items-center justify-between w-full px-4 py-3.5 rounded-2xl border-2 bg-white active:scale-[0.98] transition-all duration-200 ${
        open
          ? "border-bb-steel/40 shadow-md"
          : "border-bb-steel/20 shadow-sm hover:shadow-md hover:border-bb-steel/40"
      }`}
    >
      <span className="flex items-center gap-3 text-sm font-semibold text-gray-800">{label}</span>
      <span className="flex items-center gap-2">
        {badge && (
          <span className="text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
        <span
          className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 ${
            open ? `${accent} text-white shadow-sm` : "bg-gray-100 text-gray-400"
          }`}
        >
          <ChevronRight
            className={`w-3.5 h-3.5 transition-transform duration-300 ${open ? "rotate-90" : ""}`}
          />
        </span>
      </span>
    </button>
  );
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\n+/g, " ")
    .trim();
}

type Tab = "health" | "links" | "aigeo" | "passed";

export default function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<RunStatus | null>(null);
  const [runLoaded, setRunLoaded] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [showMonitor, setShowMonitor] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [activeDoc, setActiveDoc] = useState<"product" | "brand" | null>(null);
  const [fixItem, setFixItem] = useState<RunStatus["feed_items"][number] | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("health");
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [auditRetrying, setAuditRetrying] = useState(false);
  const [terminalVersion, setTerminalVersion] = useState(0);
  const [activeSection, setActiveSection] = useState<"project" | "analytics" | "feed" | "chat" | null>("chat");
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const toggleSection = (s: "project" | "analytics" | "feed" | "chat") =>
    setActiveSection((prev) => (prev === s ? null : s));
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);

  const resolvedParams = React.use(params);
  const id = resolvedParams.runId;

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getRun(id, getStoredToken());
      setRun(data);
    } catch {
      setRun(null);
    } finally {
      setRunLoaded(true);
    }
  }, [id]);

  useEffect(() => { setRunId(id); }, [id]);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);
  useEffect(() => {
    const token = getStoredToken();
    if (token) getMe(token).then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    const msgs = run?.chat_messages ?? [];
    const newCount = msgs.length;
    const prevCount = prevMsgCountRef.current;
    if (newCount > prevCount) {
      // New message arrived — scroll to bottom
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      prevMsgCountRef.current = newCount;
    }
  }, [run?.chat_messages]);

  const isLoading = run?.status === "pending" || run?.status === "running";

  // Clear auditRetrying once the server confirms it's running — prevents
  // a flash back to the sad-dog state during the 3s poll gap.
  useEffect(() => {
    if (isLoading && auditRetrying) setAuditRetrying(false);
  }, [isLoading, auditRetrying]);
  const passedChecks = run?.passed_checks ?? [];
  const failedChecks = run?.failed_checks ?? [];
  const feedItems = run?.feed_items ?? [];
  const chatMessages = run?.chat_messages ?? [];
  const chatReady = run?.chat_status === "ready";

  async function handleChat(e: React.FormEvent) {
    e.preventDefault();
    const msg = chatInput.trim();
    if (!msg || !runId || chatSending) return;
    setChatInput("");
    setChatSending(true);
    // Optimistically show the user message immediately
    setRun((prev) => prev ? {
      ...prev,
      chat_messages: [...prev.chat_messages, { role: "user", content: msg }],
    } : prev);
    try {
      const { messages } = await chatRun(runId, msg);
      prevMsgCountRef.current = 0; // force scroll on next update
      setRun((prev) => prev ? { ...prev, chat_messages: messages } : prev);
    } catch {
      // Restore input and append an error bubble so the user knows what happened
      setChatInput(msg);
      setRun((prev) => prev ? {
        ...prev,
        chat_messages: [
          ...prev.chat_messages.filter((m) => !(m.role === "user" && m.content === msg)),
          { role: "assistant", content: "Sorry, I couldn't reach Onni right now. Please try again." },
        ],
      } : prev);
    } finally {
      setChatSending(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "health", label: "Health" },
    { key: "links", label: "Links" },
    { key: "aigeo", label: "AI/GEO" },
    { key: "passed", label: "Passed" },
  ];

  const toneClass = (tone: string) =>
    tone === "green" ? "text-green-500" :
    tone === "yellow" ? "text-yellow-500" :
    "text-red-500";

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {showMonitor && (
        <MonthlyMonitorModal
          user={user}
          onClose={() => setShowMonitor(false)}
          onNeedSignup={() => setShowMonitor(false)}
          onNeedUpgrade={() => { setShowMonitor(false); setShowUpgrade(true); }}
          prefillDomain={run?.website_url ?? ""}
        />
      )}
      {showUpgrade && user && (
        <UpgradeModal token={user.token} onClose={() => setShowUpgrade(false)} />
      )}

      {/* Dark zone — seamless with header, no border/rounding */}
      <div className="flex-shrink-0 bg-bb-phantom pb-4">
        {runLoaded && (
          <Terminal
            runId={runId}
            initialLines={run?.terminal_log ?? []}
            skipStream={(run?.status === "completed" || run?.status === "failed") && !auditRetrying}
            className="w-full"
            isComplete={!isLoading && run !== null && !auditRetrying}
            version={terminalVersion}
          />
        )}
        <div className="flex items-center justify-between mt-2 px-4">
          <div className="flex items-center gap-2">
            <PdfReportButton run={run} disabled={isLoading} />
            <button
              type="button"
              onClick={() => setShowMonitor(true)}
              disabled={isLoading || !run}
              className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold select-none transition-all duration-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 bg-violet-600/80 text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
              aria-label="Get monthly report"
            >
              <span className="relative flex-shrink-0">📅</span>
              <span>Monthly Report</span>
            </button>
          </div>
          {run?.model_name && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-white/60 text-[11px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400/80 flex-shrink-0" />
              {run.llm_provider} · {run.model_name.split("/").pop()}
            </span>
          )}
        </div>
      </div>

      <div className="flex max-lg:pb-8 flex-col flex-1 min-h-0 gap-2 overflow-y-auto overflow-x-hidden lg:overflow-hidden lg:grid lg:grid-cols-[260px_1fr_220px_320px] lg:gap-5 px-4 lg:px-6 py-4 lg:py-5">

        {/* ── LEFT: company + docs + competitors ── */}
        <div className="flex w-full shrink-0 flex-col min-h-0 lg:flex-none lg:gap-4 lg:overflow-auto">
          <SectionToggle
            label={
              <span className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-xl bg-bb-phantom/10 flex items-center justify-center flex-shrink-0">
                  <PawIcon className="w-4 h-4 text-bb-phantom" />
                </span>
                {run?.project_name || "Project"}
              </span>
            }
            open={activeSection === "project"}
            onToggle={() => toggleSection("project")}
            accent="bg-bb-phantom"
          />
          <div className={`mt-2 flex max-lg:w-full flex-col gap-4 ${activeSection === "project" ? "" : "hidden"} lg:mt-0 lg:flex lg:min-h-fit lg:flex-none lg:overflow-auto`}>
          <div className="rounded-xl border border-bb-steel/60 bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <PawIcon className="w-6 h-6 text-bb-phantom" />
              <h2 className="text-base font-semibold text-gray-900">
                {run?.project_name || "Project"}
              </h2>
            </div>
            <p className="text-sm text-gray-600 line-clamp-6">
              {run?.project_description ? stripMarkdown(run.project_description) : "Gathering your product context…"}
            </p>
          </div>

          <div className="rounded-xl border border-bb-steel/60 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Documents</h3>
            <ul className="space-y-1">
              {run?.documents?.length ? (
                run.documents.map((doc) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (doc.title === "Competitor Analysis") setReportOpen(true);
                        else if (doc.title === "Product Information") setActiveDoc("product");
                        else if (doc.title === "Brand Voice") setActiveDoc("brand");
                      }}
                      className="flex items-center justify-between w-full text-left py-2 px-3 rounded-lg border border-transparent hover:border-bb-steel/60 hover:bg-bb-cloud transition-colors group"
                    >
                      <span className="flex items-center gap-2 text-sm text-gray-700">
                        <span className="text-gray-400">📄</span>
                        {doc.title}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </li>
                ))
              ) : (
                <li className="text-sm text-gray-500 py-5 border border-dashed border-bb-steel/60 rounded-lg text-center">
                  No documents yet
                </li>
              )}
            </ul>
          </div>

          <div className="rounded-xl border border-bb-steel/60 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Competitors</h3>
            <div className="flex flex-wrap gap-2">
              {run?.competitors?.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-bb-steel/30 text-bb-phantom text-sm">
                  {c.name.replace(/\*\*/g, "")}
                </span>
              ))}
              <Button variant="outline" size="sm" className="rounded-full border-dashed border-bb-steel text-bb-phantom hover:bg-bb-cloud">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
          </div>
          </div>{/* end projectOpen content */}
        </div>

        {/* ── CENTER: analytics overview ── */}
        <div className="flex w-full shrink-0 flex-col min-h-0 lg:flex-none lg:gap-4 lg:overflow-auto">
          <SectionToggle
            label={
              <span className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-base leading-none">📊</span>
                </span>
                Analytics
                {!isLoading && failedChecks.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                )}
                {!isLoading && failedChecks.length === 0 && passedChecks.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                )}
              </span>
            }
            open={activeSection === "analytics"}
            onToggle={() => toggleSection("analytics")}
            accent="bg-blue-500"
          />
          <div className={`mt-2 flex max-lg:w-full flex-col gap-4 ${activeSection === "analytics" ? "" : "hidden"} lg:mt-0 lg:flex lg:min-h-0 lg:flex-1`}>
          <div className="flex flex-col rounded-xl border border-bb-steel/60 bg-white p-4 max-lg:min-h-0 lg:min-h-0 lg:flex-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Analytics Overview</h3>
              <div className="flex gap-1">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTab(t.key)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      activeTab === t.key
                        ? "bg-bb-phantom text-white font-semibold"
                        : "text-gray-500 hover:text-gray-700 hover:bg-bb-cloud"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "health" && (
              (isLoading || auditRetrying) ? (
                <div className="flex flex-col items-center justify-center py-10 text-center lg:flex-1">
                  <PawIcon className="w-14 h-14 text-bb-steel animate-pulse" />
                  <p className="font-semibold text-gray-600 mt-3">Analyzing…</p>
                </div>
              ) : !isLoading && (run?.analytics_overview ?? []).length === 0 && run?.status === "completed" ? (
                <div className="flex flex-col items-center justify-center py-8 text-center lg:flex-1 gap-3">
                  <div style={{ animation: "sadSway 2.8s ease-in-out infinite" }}>
                    <SadDogFace className="w-16 h-16" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600">Woof… audit came up empty</p>
                    <p className="text-xs text-gray-400 mt-1">The model didn&apos;t return valid scores.</p>
                  </div>
                  <button
                    onClick={async () => {
                      const token = getStoredToken();
                      if (!runId || !token || auditRetrying) return;
                      setAuditRetrying(true);
                      try {
                        await retryAudit(runId, token);
                        // Reconnect terminal to the new stream — auditRetrying stays
                        // true until the poll confirms isLoading (avoids sad-dog flash).
                        setTerminalVersion((v) => v + 1);
                      } catch {
                        setAuditRetrying(false);
                      }
                    }}
                    disabled={auditRetrying}
                    className={`
                      inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                      transition-all duration-200 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/40
                      ${auditRetrying
                        ? "bg-orange-50 text-orange-400 cursor-wait"
                        : "bg-orange-500 text-white hover:bg-orange-600 shadow-sm hover:shadow-[0_4px_16px_rgba(249,115,22,0.35)]"
                      }
                    `}
                  >
                    {auditRetrying ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
                          <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 2a10 10 0 0 1 10 10" className="origin-center" />
                        </svg>
                        <span>Sniffing again…</span>
                      </>
                    ) : (
                      <>
                        <PawIcon className="w-4 h-4" />
                        <span>Retry Audit</span>
                      </>
                    )}
                  </button>
                  <style jsx>{`
                    @keyframes sadSway {
                      0%, 100% { transform: rotate(-4deg) translateY(0px); }
                      50%       { transform: rotate(4deg) translateY(-3px); }
                    }
                  `}</style>
                </div>
              ) : (
                <div className="space-y-5 max-lg:overflow-visible lg:flex-1 lg:overflow-auto">
                  {/* Page Speed */}
                  {(run?.analytics_overview ?? []).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Page Speed</p>
                      <div className="grid grid-cols-4 gap-2">
                        {(run?.analytics_overview ?? []).map((m) => (
                          <div key={m.key} className="flex flex-col items-center gap-1">
                            <CircleProgress score={m.score} tone={m.tone} />
                            <span className="text-[11px] text-gray-500 text-center leading-tight">{m.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SEO Health */}
                  {(failedChecks.length > 0 || passedChecks.length > 0) && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">SEO Health</p>
                      <ul className="space-y-1.5">
                        {failedChecks.map((c, i) => (
                          <HealthRow
                            key={`f-${i}`}
                            name={c.name}
                            value={c.value}
                            passed={false}
                            warn={/partial|warning/i.test(c.description)}
                          />
                        ))}
                        {passedChecks.slice(0, 5).map((c, i) => (
                          <HealthRow
                            key={`p-${i}`}
                            name={c.name}
                            value={c.value}
                            passed={true}
                          />
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Audit summary */}
                  {run?.audit_summary && failedChecks.length === 0 && passedChecks.length === 0 && (
                    <div className="text-sm text-gray-600 leading-relaxed border-t border-bb-steel/40 pt-3">
                      {run.audit_summary}
                    </div>
                  )}
                </div>
              )
            )}

            {activeTab === "passed" && (
              <div className="max-lg:overflow-visible lg:flex-1 lg:overflow-auto">
                <p className="text-xs text-gray-500 mb-3">
                  Passed Checks ({passedChecks.length})
                </p>
                <ul className="space-y-2">
                  {passedChecks.length ? passedChecks.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 py-1.5 border-b border-bb-steel/30 last:border-0">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-gray-700">{c.name}</div>
                        <div className="text-xs text-gray-500">{c.description}</div>
                      </div>
                    </li>
                  )) : (
                    <li className="text-sm text-gray-400 py-6 text-center border border-dashed rounded-lg">
                      {isLoading ? "Running checks…" : "No passed checks yet"}
                    </li>
                  )}
                </ul>
              </div>
            )}

            {activeTab === "links" && (
              <div className="max-lg:overflow-visible lg:flex-1 lg:overflow-auto">
                <p className="text-xs text-gray-500 mb-3">
                  Failed / Issues ({failedChecks.length})
                </p>
                <ul className="space-y-2">
                  {failedChecks.length ? failedChecks.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 py-1.5 border-b border-bb-steel/30 last:border-0">
                      <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-gray-700">{c.name}</div>
                        <div className="text-xs text-gray-500">{c.description}</div>
                      </div>
                    </li>
                  )) : (
                    <li className="text-sm text-gray-400 py-6 text-center border border-dashed rounded-lg">
                      {isLoading ? "Running checks…" : "No issues found"}
                    </li>
                  )}
                </ul>
              </div>
            )}

            {activeTab === "aigeo" && (
              <div className="flex flex-col items-center justify-center py-10 text-center lg:flex-1">
                <p className="text-sm text-gray-500">AI/GEO analysis coming soon.</p>
              </div>
            )}
          </div>
          </div>{/* end analyticsOpen content */}
        </div>

        {/* ── CMO FEED ── */}
        <div className="flex w-full shrink-0 flex-col min-h-0 lg:flex-none lg:overflow-auto">
          <SectionToggle
            label={
              <span className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-base leading-none">⚡</span>
                </span>
                AI CMO Feed
              </span>
            }
            badge={`${feedItems.length} items`}
            open={activeSection === "feed"}
            onToggle={() => toggleSection("feed")}
            accent="bg-violet-600"
          />
          <div className={`mt-2 flex max-lg:w-full flex-col ${activeSection === "feed" ? "" : "hidden"} lg:mt-0 lg:flex lg:min-h-0 lg:flex-1 lg:overflow-auto`}>
          <div className="flex flex-col rounded-xl border border-bb-steel/60 bg-white p-4 max-lg:min-h-0 lg:flex-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 hidden lg:block">AI CMO Feed</h3>
              <span className="text-xs text-gray-500">{feedItems.length} items</span>
            </div>
            {feedItems.length ? (
              <div className="space-y-2 max-lg:overflow-visible lg:flex-1 lg:overflow-auto">
                {feedItems.map((item) => (
                  <div key={item.id} className="rounded-lg border border-bb-steel/60 bg-bb-cloud/50 px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-700 truncate">{item.title}</div>
                      <div className="text-xs text-gray-500">{item.status}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-3 flex-shrink-0 text-xs"
                      onClick={() => setFixItem(item)}
                    >
                      {item.action_label}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (!run || isLoading) ? (
              <div className="flex flex-col items-center justify-center py-10 text-center lg:flex-1">
                <PawIcon className="w-12 h-12 text-bb-steel animate-pulse" />
                <p className="text-sm font-semibold text-gray-600 mt-3">Researching…</p>
                <p className="text-xs text-gray-500">Scanning for opportunities</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-4 text-center border border-dashed rounded-lg">
                No feed items yet
              </p>
            )}
          </div>
          </div>{/* end feedOpen content */}
        </div>

        {/* ── CHAT ── */}
        <div className="flex w-full shrink-0 flex-col min-h-0 lg:flex-none lg:overflow-hidden">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <SectionToggle
                label={
                  <span className="flex items-center gap-2.5">
                    <span className="relative flex-shrink-0">
                      <Image src="/onni.png" alt="" width={28} height={28} className="rounded-full object-cover" />
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white" />
                    </span>
                    Chat with Onni
                  </span>
                }
                open={activeSection === "chat"}
                onToggle={() => toggleSection("chat")}
                accent="bg-green-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setChatModalOpen(true)}
              className="lg:hidden flex-shrink-0 p-2.5 rounded-2xl border-2 border-bb-steel/20 bg-white shadow-sm hover:shadow-md hover:border-bb-steel/40 text-gray-400 hover:text-gray-600 transition-all"
              title="Open chat in full view"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
          <div className={`mt-2 flex max-lg:w-full flex-col ${activeSection === "chat" ? "" : "hidden"} lg:mt-0 lg:flex lg:min-h-0 lg:flex-1 lg:overflow-hidden`}>
          <div className="flex min-h-0 flex-col rounded-xl border border-bb-steel/60 bg-white p-4 lg:flex-1">
            <div className="hidden lg:flex items-center gap-2 mb-3">
              <div className="relative flex-shrink-0">
                <Image src="/onni.png" alt="Onni" width={28} height={28} className="rounded-full object-cover" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white" />
              </div>
              <h3 className="text-sm font-semibold text-gray-700">Chat with Onni</h3>
              <button
                type="button"
                onClick={() => setChatModalOpen(true)}
                className="ml-auto p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Open in larger view"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {chatReady ? (
              <>
                <div ref={chatScrollRef} className="mb-3 max-h-[min(45vh,20rem)] space-y-2 overflow-y-auto lg:max-h-none lg:flex-1">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        msg.role === "assistant"
                          ? "bg-bb-cloud text-gray-700"
                          : "bg-bb-phantom text-bb-phantomLight ml-6"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:text-gray-800 prose-strong:text-gray-800 text-gray-700">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  ))}
                  {chatSending && (
                    <div className="rounded-lg px-3 py-2.5 text-sm bg-bb-cloud text-gray-700 w-fit">
                      <span className="flex gap-1 items-center h-4">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-[typingDot_1.2s_ease-in-out_infinite]" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-[typingDot_1.2s_ease-in-out_infinite]" style={{ animationDelay: "200ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-[typingDot_1.2s_ease-in-out_infinite]" style={{ animationDelay: "400ms" }} />
                      </span>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>
                <form onSubmit={handleChat} className="flex gap-2 mt-auto">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask your AI CMO…"
                    disabled={chatSending}
                    className="flex-1 rounded-lg border border-bb-steel/60 bg-bb-cloud px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-bb-blue/20 disabled:opacity-50"
                  />
                  <Button type="submit" size="sm" disabled={chatSending || !chatInput.trim()} className="bg-bb-phantom text-white hover:bg-bb-phantom/90 px-3">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center lg:flex-1">
                <PawIcon className="w-12 h-12 text-bb-steel" />
                <p className="text-sm font-semibold text-gray-600 mt-3">Loading Chat</p>
                <p className="text-xs text-gray-500">Preparing AI assistant…</p>
              </div>
            )}
          </div>
          </div>{/* end chatOpen content */}
        </div>
      </div>

      <FixDrawer item={fixItem} onClose={() => setFixItem(null)} />

      <ReportModal open={reportOpen} onOpenChange={setReportOpen} run={run} />

      {/* Chat pop-out modal */}
      <Dialog open={chatModalOpen} onOpenChange={setChatModalOpen}>
        <DialogContent className="sm:max-w-2xl h-[80vh] flex flex-col bg-white border-bb-steel/60 p-0 gap-0">
          <DialogHeader className="flex flex-row items-center gap-2 px-5 pt-5 pb-3 border-b border-bb-steel/20 flex-shrink-0">
            <div className="relative flex-shrink-0">
              <Image src="/onni.png" alt="Onni" width={32} height={32} className="rounded-full object-cover" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white" />
            </div>
            <DialogTitle className="text-base font-semibold text-gray-800">Chat with Onni</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col flex-1 min-h-0 px-5 pb-5 pt-4">
            {chatReady ? (
              <>
                <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 mb-4">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg px-3 py-2.5 text-sm ${
                        msg.role === "assistant"
                          ? "bg-bb-cloud text-gray-700"
                          : "bg-bb-phantom text-bb-phantomLight ml-10"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:text-gray-800 prose-strong:text-gray-800 text-gray-700">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  ))}
                  {chatSending && (
                    <div className="rounded-lg px-3 py-2.5 text-sm bg-bb-cloud text-gray-700 w-fit">
                      <span className="flex gap-1 items-center h-4">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-[typingDot_1.2s_ease-in-out_infinite]" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-[typingDot_1.2s_ease-in-out_infinite]" style={{ animationDelay: "200ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-[typingDot_1.2s_ease-in-out_infinite]" style={{ animationDelay: "400ms" }} />
                      </span>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>
                <form onSubmit={handleChat} className="flex gap-2 mt-auto flex-shrink-0">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask your AI CMO…"
                    disabled={chatSending}
                    className="flex-1 rounded-lg border border-bb-steel/60 bg-bb-cloud px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-bb-blue/20 disabled:opacity-50"
                  />
                  <Button type="submit" size="sm" disabled={chatSending || !chatInput.trim()} className="bg-bb-phantom text-white hover:bg-bb-phantom/90 px-4">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-center">
                <PawIcon className="w-12 h-12 text-bb-steel" />
                <p className="text-sm font-semibold text-gray-600 mt-3">Loading Chat</p>
                <p className="text-xs text-gray-500">Preparing AI assistant…</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {showReleaseNotes && (
        <ReleaseNotesModal onClose={() => setShowReleaseNotes(false)} />
      )}

      <Dialog open={activeDoc === "product"} onOpenChange={(o) => !o && setActiveDoc(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-auto bg-bb-cloud border-bb-steel/60">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Product Information: {run?.project_name || "Project"}
            </DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm max-w-none text-gray-700">
            {run?.project_description
              ? <ReactMarkdown>{run.project_description}</ReactMarkdown>
              : <p className="text-gray-400">No product information available yet.</p>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDoc === "brand"} onOpenChange={(o) => !o && setActiveDoc(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-auto bg-bb-cloud border-bb-steel/60">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Brand Voice: {run?.project_name || "Project"}
            </DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm max-w-none text-gray-700">
            {run?.brand_voice_snippet
              ? <ReactMarkdown>{run.brand_voice_snippet}</ReactMarkdown>
              : <p className="text-gray-400">No brand voice guide available yet.</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-center gap-4 py-3">
        <button
          onClick={() => setShowReleaseNotes(true)}
          className="text-[11px] text-bb-steel/50 hover:text-bb-steel transition-colors underline underline-offset-2 decoration-bb-steel/20"
        >
          What&apos;s new in v2.2.0
        </button>

        <span className="text-bb-steel/20 text-xs">·</span>

        <BackboardBadge />
      </div>
    </div>
  );
}
