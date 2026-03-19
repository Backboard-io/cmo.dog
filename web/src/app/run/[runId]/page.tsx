"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { getRun, chatRun, type RunStatus } from "@/lib/api";
import { Terminal } from "@/components/terminal";
import { ReportModal } from "@/components/report-modal";
import { FixDrawer } from "@/components/fix-drawer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronRight, Plus, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";

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

const GhostIcon = ({ className = "w-12 h-12" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2a8 8 0 0 0-8 8v10l2-2 2 2 2-2 2 2 2-2 2 2V10a8 8 0 0 0-8-8zm0 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-3 7.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
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
  const [reportOpen, setReportOpen] = useState(false);
  const [activeDoc, setActiveDoc] = useState<"product" | "brand" | null>(null);
  const [fixItem, setFixItem] = useState<RunStatus["feed_items"][number] | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("health");
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const resolvedParams = React.use(params);
  const id = resolvedParams.runId;

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getRun(id);
      setRun(data);
    } catch {
      setRun(null);
    }
  }, [id]);

  useEffect(() => { setRunId(id); }, [id]);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [run?.chat_messages]);

  const isLoading = run?.status === "pending" || run?.status === "running";
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
    try {
      const { messages } = await chatRun(runId, msg);
      setRun((prev) => prev ? { ...prev, chat_messages: messages } : prev);
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
      {/* Dark zone — seamless with header, no border/rounding */}
      <div className="flex-shrink-0 bg-bb-phantom px-6 pt-0 pb-4">
        <Terminal runId={runId} className="w-full" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_220px_320px] gap-5 flex-1 min-h-0 overflow-hidden px-6 py-5">

        {/* ── LEFT: company + docs + competitors ── */}
        <div className="flex flex-col gap-4 overflow-auto">
          <div className="rounded-xl border border-bb-steel/60 bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <GhostIcon className="w-6 h-6 text-bb-phantom" />
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
        </div>

        {/* ── CENTER: analytics overview ── */}
        <div className="flex flex-col gap-4 overflow-auto">
          <div className="rounded-xl border border-bb-steel/60 bg-white p-4 flex flex-col flex-1 min-h-0">
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
              isLoading ? (
                <div className="flex flex-col items-center justify-center flex-1 text-center py-10">
                  <GhostIcon className="w-14 h-14 text-bb-steel animate-pulse" />
                  <p className="font-semibold text-gray-600 mt-3">Analyzing…</p>
                </div>
              ) : (
                <div className="space-y-5 overflow-auto flex-1">
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
              <div className="overflow-auto flex-1">
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
              <div className="overflow-auto flex-1">
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
              <div className="flex flex-col items-center justify-center flex-1 text-center py-10">
                <p className="text-sm text-gray-500">AI/GEO analysis coming soon.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── CMO FEED ── */}
        <div className="flex flex-col overflow-auto">
          <div className="rounded-xl border border-bb-steel/60 bg-white p-4 flex flex-col flex-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">AI CMO Feed</h3>
              <span className="text-xs text-gray-500">{feedItems.length} items</span>
            </div>
            {feedItems.length ? (
              <div className="space-y-2 overflow-auto flex-1">
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
            ) : (
              <p className="text-sm text-gray-400 py-4 text-center border border-dashed rounded-lg">
                {isLoading ? "Scanning for opportunities…" : "No feed items yet"}
              </p>
            )}
          </div>
        </div>

        {/* ── CHAT ── */}
        <div className="flex flex-col overflow-hidden">
          <div className="rounded-xl border border-bb-steel/60 bg-white p-4 flex flex-col flex-1 min-h-0">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Chat</h3>
            {chatReady ? (
              <>
                <div className="flex-1 overflow-auto space-y-2 mb-3">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        msg.role === "assistant"
                          ? "bg-bb-cloud text-gray-700"
                          : "bg-bb-phantom text-bb-phantomLight ml-6"
                      }`}
                    >
                      {msg.content}
                    </div>
                  ))}
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
              <div className="flex flex-col items-center justify-center flex-1 text-center">
                <GhostIcon className="w-12 h-12 text-bb-steel" />
                <p className="text-sm font-semibold text-gray-600 mt-3">Loading Chat</p>
                <p className="text-xs text-gray-500">Preparing AI assistant…</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <FixDrawer item={fixItem} onClose={() => setFixItem(null)} />

      <ReportModal open={reportOpen} onOpenChange={setReportOpen} run={run} />

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
    </div>
  );
}
