"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getStoredToken,
  getMe,
  createCheckout,
  createBillingPortal,
  type UserInfo,
} from "@/lib/api";
import { UpgradeModal } from "@/components/billing/UpgradeModal";

// ── Plan data ─────────────────────────────────────────────────────────────────

const FREE_FEATURES = [
  "5 site analyses",
  "Competitor intel",
  "Brand voice snapshot",
  "SEO audit",
  "AI chat",
];

const PRO_FEATURES = [
  "Unlimited analyses",
  "Competitor intel",
  "Brand voice reports",
  "SEO & audit fixes",
  "AI chat — unlimited",
  "Monthly monitoring",
  "New competitor alerts",
  "Priority support",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const color =
    pct >= 100 ? "bg-red-500" : pct >= 60 ? "bg-amber-400" : "bg-bb-blue";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-bb-steel">
        <span>{used} used</span>
        <span>{limit - used} remaining</span>
      </div>
      <div className="h-2 rounded-full bg-bb-steel/15 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const isPro = plan !== "free";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
        isPro
          ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-[0_2px_12px_rgba(139,92,246,0.4)]"
          : "bg-bb-steel/10 text-bb-steel"
      }`}
    >
      {isPro ? "⚡ Pro" : "Free"}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getStoredToken();
    if (!token) { router.replace("/"); return; }

    getMe(token)
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoadingUser(false));
  }, [router]);

  async function handlePortal() {
    if (!user) return;
    setLoadingPortal(true);
    try {
      const { url } = await createBillingPortal(user.token);
      window.location.href = url;
    } catch {
      setError("Could not open billing portal — try again");
      setLoadingPortal(false);
    }
  }

  async function handleCheckout() {
    if (!user) return;
    setLoadingCheckout(true);
    try {
      const { url } = await createCheckout(user.token);
      window.location.href = url;
    } catch {
      setError("Could not start checkout — try again");
      setLoadingCheckout(false);
    }
  }

  const isPro = user?.plan !== "free";
  const promptsLeft = user ? Math.max(0, user.prompts_limit - user.prompts_used) : 0;

  if (loadingUser) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-bb-blue/20 border-t-bb-blue animate-spin" />
        <p className="text-sm text-bb-steel">Loading your plan…</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div
      className="flex flex-col flex-1 overflow-y-auto"
      style={{ animation: "billingPageIn 0.35s cubic-bezier(0.22,1,0.36,1) both" }}
    >
      {showUpgrade && (
        <UpgradeModal token={user.token} onClose={() => setShowUpgrade(false)} />
      )}

      {/* Sub-header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-bb-phantom">Billing & Plan</h1>
          <p className="text-xs text-bb-steel mt-0.5">Manage your subscription and monthly monitors</p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-xs text-bb-blue font-medium hover:underline focus:outline-none"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 3H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6" strokeLinecap="round" />
            <path d="M8 8l5-5M10 3h3v3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          New analysis
        </button>
      </div>

      <div className="flex-1 px-5 py-5 max-w-3xl mx-auto w-full space-y-5">

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Current plan hero ── */}
        <div
          className={`rounded-2xl p-5 border ${
            isPro
              ? "bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200/60"
              : "bg-bb-cloud border-bb-steel/10"
          }`}
          style={{ animation: "billingCardIn 0.4s 0.05s cubic-bezier(0.22,1,0.36,1) both" }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <PlanBadge plan={user.plan} />
                <span className="text-xs text-bb-steel">{user.email}</span>
              </div>
              <p className="text-2xl font-extrabold text-bb-phantom mt-2">
                {isPro ? "Unlimited analyses" : `${promptsLeft} of ${user.prompts_limit} analyses left`}
              </p>
              {!isPro && (
                <p className="text-sm text-bb-steel">
                  {user.prompts_used} used · {promptsLeft} remaining
                </p>
              )}
              {isPro && (
                <p className="text-sm text-bb-steel">
                  You&apos;re on Pro — Onni is unleashed 🐾
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 flex-shrink-0">
              {isPro ? (
                <button
                  onClick={handlePortal}
                  disabled={loadingPortal}
                  className="rounded-xl border border-violet-200 bg-white text-violet-700 px-4 py-2 text-sm font-medium hover:bg-violet-50 active:scale-[0.98] transition-all disabled:opacity-50 whitespace-nowrap"
                >
                  {loadingPortal ? "Opening…" : "Manage subscription →"}
                </button>
              ) : (
                <button
                  onClick={handleCheckout}
                  disabled={loadingCheckout}
                  className="rounded-xl bg-bb-phantom text-white px-4 py-2 text-sm font-medium hover:bg-bb-blue active:scale-[0.98] transition-all disabled:opacity-50 whitespace-nowrap"
                >
                  {loadingCheckout ? "Redirecting…" : "Upgrade to Pro — $5/mo"}
                </button>
              )}
            </div>
          </div>

          {!isPro && (
            <div className="mt-4">
              <UsageBar used={user.prompts_used} limit={user.prompts_limit} />
            </div>
          )}
        </div>

        {/* ── Plan comparison ── */}
        <div
          className="grid sm:grid-cols-2 gap-4"
          style={{ animation: "billingCardIn 0.4s 0.12s cubic-bezier(0.22,1,0.36,1) both" }}
        >
          {/* Free */}
          <div className={`rounded-2xl border p-5 space-y-4 ${!isPro ? "border-bb-blue/40 ring-1 ring-bb-blue/15 bg-white" : "border-gray-200 bg-white"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-bb-phantom">Free</span>
              <div className="flex items-center gap-2">
                {!isPro && (
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-bb-blue/10 text-bb-blue px-2 py-0.5 rounded-full">Active</span>
                )}
                <div>
                  <span className="text-xl font-bold text-bb-phantom">$0</span>
                  <span className="text-sm text-bb-steel"> / mo</span>
                </div>
              </div>
            </div>
            {isPro && (
              <button
                onClick={handlePortal}
                disabled={loadingPortal}
                className="w-full rounded-lg border border-gray-200 bg-white text-bb-steel py-2 text-sm font-semibold hover:border-gray-300 hover:text-bb-phantom active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loadingPortal ? "Opening…" : "Downgrade to Free"}
              </button>
            )}
            <ul className="space-y-1.5">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-bb-steel">
                  <span className="text-bb-steel/40 flex-shrink-0">○</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro */}
          <div className={`rounded-2xl border p-5 space-y-4 ${isPro ? "border-violet-300 ring-1 ring-violet-200/60 bg-gradient-to-br from-white to-violet-50/30" : "border-gray-200 bg-white hover:border-violet-200 transition-colors"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-bb-phantom">Pro</span>
              <div className="flex items-center gap-2">
                {isPro && (
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">Active</span>
                )}
                <div>
                  <span className="text-xl font-bold text-bb-phantom">$5</span>
                  <span className="text-sm text-bb-steel"> / mo</span>
                </div>
              </div>
            </div>
            {!isPro && (
              <button
                onClick={handleCheckout}
                disabled={loadingCheckout}
                className="w-full rounded-lg bg-bb-phantom text-white py-2 text-sm font-semibold hover:bg-bb-blue active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loadingCheckout ? "Redirecting…" : "Upgrade now"}
              </button>
            )}
            <ul className="space-y-1.5">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-bb-steel">
                  <span className="text-bb-blue flex-shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>

      <style jsx>{`
        @keyframes billingPageIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes billingCardIn {
          from { opacity: 0; transform: translateY(10px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
