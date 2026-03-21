"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ;

type ModelEntry = {
  id: string;
  context: number;
  input_cost: number;
  output_cost: number;
};

type ModelData = {
  providers: string[];
  models: Record<string, ModelEntry[]>;
};

const PROVIDER_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  anthropic:    { label: "Anthropic",   color: "text-orange-700",  bg: "bg-orange-50 border-orange-200",  dot: "bg-orange-400" },
  openai:       { label: "OpenAI",      color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-400" },
  openrouter:   { label: "OpenRouter",  color: "text-violet-700",  bg: "bg-violet-50 border-violet-200",  dot: "bg-violet-400" },
  google:       { label: "Google",      color: "text-blue-700",    bg: "bg-blue-50 border-blue-200",      dot: "bg-blue-400" },
  "aws-bedrock":{ label: "AWS Bedrock", color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",   dot: "bg-amber-400" },
  xai:          { label: "xAI",         color: "text-gray-700",    bg: "bg-gray-50 border-gray-200",      dot: "bg-gray-500" },
  cerebras:     { label: "Cerebras",    color: "text-teal-700",    bg: "bg-teal-50 border-teal-200",      dot: "bg-teal-400" },
  cohere:       { label: "Cohere",      color: "text-rose-700",    bg: "bg-rose-50 border-rose-200",      dot: "bg-rose-400" },
};

const DEFAULT_PROVIDER    = "openrouter";
const DEFAULT_MODEL       = "anthropic/claude-sonnet-4-5";
export const FREE_PROVIDER = "openrouter";
export const FREE_MODEL    = "meta-llama/llama-3.3-70b-instruct:free";

function formatContext(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function formatCost(n: number): string {
  if (n === 0) return "free";
  if (n < 1)   return `$${n.toFixed(2)}`;
  return `$${n.toFixed(1)}`;
}

function shortName(id: string): string {
  // Strip provider prefix (e.g. "anthropic/claude-3-haiku" → "claude-3-haiku")
  const slash = id.indexOf("/");
  const base = slash !== -1 ? id.slice(slash + 1) : id;
  return base;
}

function subLabel(id: string): string | null {
  const slash = id.indexOf("/");
  return slash !== -1 ? id.slice(0, slash) : null;
}

function costTone(cost: number): string {
  if (cost === 0)   return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (cost < 1)     return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (cost < 5)     return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-red-700 bg-red-50 border-red-200";
}

function isRecommended(id: string): boolean {
  return id === DEFAULT_MODEL;
}

export function SettingsModal({
  provider: initProvider,
  model: initModel,
  isPro = false,
  onSave,
  onClose,
  onUpgrade,
}: {
  provider: string;
  model: string;
  isPro?: boolean;
  onSave: (provider: string, model: string) => void;
  onClose: () => void;
  onUpgrade?: () => void;
}) {
  const [data, setData] = useState<ModelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeProvider, setActiveProvider] = useState(initProvider || DEFAULT_PROVIDER);
  const [selectedModel, setSelectedModel] = useState(initModel || DEFAULT_MODEL);
  const [search, setSearch] = useState("");
  const [listKey, setListKey] = useState(0); // force re-mount on provider switch for animation
  const [saved, setSaved] = useState(false);
  const [nudge, setNudge] = useState(false); // flash upgrade nudge when locked model clicked
  const [freeOnly, setFreeOnly] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/models`)
      .then((r) => r.json())
      .then((d: ModelData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) setTimeout(() => searchRef.current?.focus(), 50);
  }, [loading]);

  const switchProvider = useCallback((p: string) => {
    setActiveProvider(p);
    setSearch("");
    setFreeOnly(false);
    setListKey((k) => k + 1);
  }, []);

  function toggleFreeOnly() {
    const next = !freeOnly;
    setFreeOnly(next);
    if (next) {
      // all free models live on openrouter
      setActiveProvider("openrouter");
      setSearch("");
      setListKey((k) => k + 1);
    }
  }

  const models = useMemo(() => {
    const list = data?.models[activeProvider] ?? [];
    let filtered = freeOnly ? list.filter((m) => m.input_cost === 0 && m.output_cost === 0) : list;
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter((m) => m.id.toLowerCase().includes(q));
  }, [data, activeProvider, search, freeOnly]);

  function handleSave() {
    setSaved(true);
    setTimeout(() => {
      onSave(activeProvider, selectedModel);
      onClose();
    }, 500);
  }

  function handleLockedClick() {
    setNudge(true);
    setTimeout(() => setNudge(false), 2200);
  }

  const meta = (p: string) => PROVIDER_META[p] ?? { label: p, color: "text-gray-700", bg: "bg-gray-50 border-gray-200", dot: "bg-gray-400" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal
      aria-label="Model settings"
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        style={{ animation: "settings-fadein 0.2s ease both" }}
        onClick={onClose}
      />

      {/* modal */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden"
        style={{ maxHeight: "85vh", animation: "settings-slideUp 0.28s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Choose a Model</h2>
            <p className="text-xs text-gray-400 mt-0.5">Onni uses this for all four analysis agents</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors rounded-full p-1.5 hover:bg-gray-100 -mr-1"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* ── LEFT: provider list ── */}
          <aside className="w-44 flex-shrink-0 border-r border-gray-100 overflow-auto py-3 bg-gray-50/50">
            {loading ? (
              <div className="flex flex-col gap-2 px-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-9 rounded-lg bg-gray-200/60 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
                ))}
              </div>
            ) : (
              (data?.providers ?? []).map((p, i) => {
                const m = meta(p);
                const count = data?.models[p]?.length ?? 0;
                const isActive = p === activeProvider;
                return (
                  <button
                    key={p}
                    onClick={() => switchProvider(p)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 mx-2 text-left rounded-xl transition-all duration-150 mb-0.5 text-sm font-medium
                      ${isActive ? `${m.bg} ${m.color} border` : "text-gray-600 hover:bg-white hover:text-gray-900 border border-transparent"}`}
                    style={{ animation: `settings-staggerIn 0.3s ${i * 40}ms cubic-bezier(0.22,1,0.36,1) both` }}
                    aria-pressed={isActive}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.dot}`} />
                    <span className="flex-1 truncate">{m.label}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/70" : "bg-gray-200/70 text-gray-500"}`}>
                      {count}
                    </span>
                  </button>
                );
              })
            )}
          </aside>

          {/* ── RIGHT: model list ── */}
          <div className="flex flex-col flex-1 min-w-0 min-h-0">
            {/* search + filters */}
            <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0 flex items-center gap-2">
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 focus-within:border-bb-blue/50 focus-within:ring-2 focus-within:ring-bb-blue/10 transition flex-1">
                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  placeholder={`Search ${freeOnly ? models.length : (data?.models[activeProvider]?.length ?? "")} models…`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={toggleFreeOnly}
                className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-2 rounded-lg border text-xs font-semibold transition-all active:scale-[0.97]
                  ${freeOnly
                    ? "bg-emerald-500 border-emerald-500 text-white shadow-sm"
                    : "bg-gray-50 border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50"
                  }`}
                title="Show only free ($0) models"
              >
                <span>$0</span>
                <span className="hidden sm:inline">Free</span>
              </button>
            </div>

            {/* list */}
            <div className="flex-1 overflow-auto px-3 py-2" key={listKey}>
              {loading ? (
                <div className="flex flex-col gap-1 py-2">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" style={{ animationDelay: `${i * 30}ms` }} />
                  ))}
                </div>
              ) : models.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <span className="text-3xl mb-2">🔍</span>
                  <p className="text-sm font-medium text-gray-600">No models match</p>
                  <p className="text-xs text-gray-400">Try a different search term</p>
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {models.map((m, i) => {
                    const isSelected = m.id === selectedModel;
                    const rec = isRecommended(m.id);
                    const isFreeModel = m.input_cost === 0 && m.output_cost === 0;
                    const locked = !isPro && !rec && !isFreeModel;
                    const sub = subLabel(m.id);
                    const short = shortName(m.id);
                    return (
                      <li
                        key={m.id}
                        style={{ animation: `settings-staggerIn 0.22s ${Math.min(i, 20) * 20}ms cubic-bezier(0.22,1,0.36,1) both` }}
                      >
                        <button
                          type="button"
                          onClick={() => locked ? handleLockedClick() : setSelectedModel(m.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-100 group
                            ${locked
                              ? "opacity-50 cursor-default hover:bg-amber-50/60"
                              : isSelected
                                ? "bg-bb-phantom text-white shadow-sm"
                                : "hover:bg-gray-50 text-gray-800"
                            }`}
                        >
                          {/* checkmark / lock / empty dot */}
                          <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center transition-all
                            ${locked ? "border border-gray-200 bg-gray-50" : isSelected ? "bg-white/20" : "border border-gray-200 group-hover:border-gray-300"}`}>
                            {locked ? (
                              <svg className="w-2 h-2 text-gray-400" viewBox="0 0 12 12" fill="currentColor">
                                <rect x="2" y="5.5" width="8" height="5.5" rx="1"/>
                                <path d="M4 6V4a2 2 0 0 1 4 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                            ) : isSelected ? (
                              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M2 6l3 3 5-5"/>
                              </svg>
                            ) : null}
                          </span>

                          {/* name */}
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-xs font-medium truncate ${isSelected && !locked ? "text-white" : "text-gray-900"}`}>
                                {short}
                              </span>
                              {sub && (
                                <span className={`text-[10px] px-1.5 py-px rounded-full border flex-shrink-0
                                  ${isSelected && !locked ? "bg-white/15 border-white/20 text-white/70" : "bg-gray-100 border-gray-200 text-gray-500"}`}>
                                  {sub}
                                </span>
                              )}
                              {rec && (
                                <span className={`text-[10px] px-1.5 py-px rounded-full border flex-shrink-0 font-semibold
                                  ${isSelected ? "bg-white/20 border-white/30 text-white" : "bg-bb-blue/10 border-bb-blue/20 text-bb-blue"}`}>
                                  ✦ default
                                </span>
                              )}
                              {locked && (
                                <span className="text-[10px] px-1.5 py-px rounded-full border flex-shrink-0 font-semibold bg-amber-50 border-amber-200 text-amber-700">
                                  ✦ Pro
                                </span>
                              )}
                            </span>
                          </span>

                          {/* cost + context badges */}
                          <span className="flex items-center gap-1.5 flex-shrink-0">
                            {m.context > 0 && (
                              <span className={`text-[10px] px-1.5 py-px rounded border font-mono
                                ${isSelected && !locked ? "bg-white/15 border-white/20 text-white/70" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                                {formatContext(m.context)}
                              </span>
                            )}
                            <span className={`text-[10px] px-1.5 py-px rounded border font-medium
                              ${isSelected && !locked ? "bg-white/15 border-white/20 text-white/80" : costTone(m.input_cost)}`}>
                              {formatCost(m.input_cost)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* footer: nudge OR current selection + save */}
            <div className="border-t border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0 bg-gray-50/50 min-h-[56px]">
              {nudge ? (
                <div className="flex-1 flex items-center gap-3">
                  <span className="flex-1 text-xs text-amber-700 font-medium">
                    ✦ Pro unlocks 300+ models across 8 providers.
                  </span>
                  {onUpgrade && (
                    <button
                      onClick={() => { onClose(); onUpgrade(); }}
                      className="flex-shrink-0 px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-all active:scale-[0.97]"
                    >
                      Upgrade to Pro →
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    {selectedModel ? (
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta(activeProvider).dot}`} />
                        <span className="text-xs text-gray-600 font-mono truncate">{selectedModel}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No model selected</span>
                    )}
                  </div>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-gray-500 rounded-full border border-gray-200 hover:bg-white hover:border-gray-300 transition-all active:scale-[0.97]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!selectedModel || saved}
                    className="flex items-center gap-2 px-5 py-2 rounded-full bg-bb-phantom text-white text-sm font-medium
                      hover:bg-bb-phantom/80 disabled:opacity-50 transition-all active:scale-[0.97]"
                  >
                    {saved ? (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M5 13l4 4L19 7"/>
                        </svg>
                        Saved!
                      </>
                    ) : (
                      "Use this model"
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
