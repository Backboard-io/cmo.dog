"use client";

import { useState } from "react";
import { createMonitor, type UserInfo } from "@/lib/api";

type Props = {
  user: UserInfo | null;
  onClose: () => void;
  onNeedSignup: () => void;
  onNeedUpgrade: () => void;
  prefillDomain?: string;
};

const MONITOR_PERKS = [
  { icon: "📅", label: "Monthly Reports", desc: "Full site + competitor re-scan every 30 days" },
  { icon: "🔭", label: "New Competitor Discovery", desc: "Onni sniffs out rivals you've never seen" },
  { icon: "📉", label: "Rank Drift Alerts", desc: "Know when your SEO position slips" },
  { icon: "📣", label: "Brand Voice Drift", desc: "Catch tone inconsistencies before your audience does" },
  { icon: "📬", label: "Email Digest", desc: "Delivered straight to your inbox, ready to share" },
];

export function MonthlyMonitorModal({ user, onClose, onNeedSignup, onNeedUpgrade, prefillDomain }: Props) {
  const [domain, setDomain] = useState(
    prefillDomain ? prefillDomain.replace(/^https?:\/\//, "").replace(/\/$/, "") : ""
  );
  const [email, setEmail] = useState(user?.email ?? "");
  const [trackCompetitors, setTrackCompetitors] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const isPro = user?.plan !== "free";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user) { onNeedSignup(); return; }
    if (!isPro) { onNeedUpgrade(); return; }

    const trimmedDomain = domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!trimmedDomain) { setError("Enter a domain to monitor"); return; }
    if (!email.trim().includes("@")) { setError("Enter a valid email for reports"); return; }

    setError("");
    setLoading(true);
    try {
      await createMonitor(user.token, `https://${trimmedDomain}`, email.trim(), trackCompetitors);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: "mmFadeIn 0.2s ease both" }}
      />

      <div
        className="relative flex w-full max-w-2xl rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.4)]"
        style={{ animation: "mmSlideUp 0.35s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {/* LEFT — dark config panel */}
        <div className="flex flex-col w-full sm:w-[52%] bg-[#0f1117] px-8 py-9 gap-5">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📅</span>
            <div>
              <p className="text-white font-semibold text-sm tracking-tight">Monthly Monitor</p>
              <p className="text-white/40 text-[11px]">by CMO.dog</p>
            </div>
          </div>

          {success ? (
            <div className="flex flex-col flex-1 items-center justify-center gap-4 text-center py-4">
              <div
                className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center text-3xl"
                style={{ animation: "mmBounce 0.5s cubic-bezier(0.22,1,0.36,1)" }}
              >
                🐾
              </div>
              <div className="space-y-1.5">
                <p className="text-white font-semibold text-lg">Onni&apos;s on watch!</p>
                <p className="text-white/50 text-sm leading-relaxed">
                  Your first report for <span className="text-white/80 font-medium">{domain}</span> will arrive within 24 hours.
                  After that, monthly — like clockwork.
                </p>
              </div>
              <button
                onClick={onClose}
                className="mt-2 rounded-xl bg-white text-[#0f1117] px-6 py-2.5 text-sm font-semibold hover:bg-white/90 active:scale-[0.98] transition-all"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-white leading-snug">
                  Set up monthly tracking
                </h2>
                <p className="text-sm text-white/50">
                  Onni watches your domain and emails you a full report every month.
                </p>
              </div>

              {!user && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-300 flex items-center gap-2.5">
                  <span className="text-base flex-shrink-0">🔒</span>
                  <span>Sign up free to configure your monitor.</span>
                </div>
              )}
              {user && !isPro && (
                <div className="rounded-xl border border-purple-500/20 bg-purple-500/8 px-4 py-3 text-sm text-purple-300 flex items-center gap-2.5">
                  <span className="text-base flex-shrink-0">⚡</span>
                  <span>Monthly monitoring is a Pro feature — upgrade in seconds.</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Domain</label>
                  <div className="flex items-center rounded-xl border border-white/10 bg-white/5 overflow-hidden focus-within:border-white/25 focus-within:ring-1 focus-within:ring-white/20 transition">
                    <span className="pl-4 text-white/30 text-sm select-none flex-shrink-0">https://</span>
                    <input
                      type="text"
                      placeholder="yourbusiness.com"
                      value={domain}
                      onChange={(e) => { setDomain(e.target.value); setError(""); }}
                      disabled={loading}
                      autoFocus={!prefillDomain}
                      className="flex-1 min-w-0 bg-transparent text-white placeholder:text-white/20 text-sm outline-none border-0 pl-1 pr-4 py-2.5"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Report email</label>
                  <input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    disabled={loading}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:ring-1 focus:ring-white/20 focus:border-white/25 transition"
                  />
                </div>

                <label className="flex items-center gap-3 cursor-pointer group select-none">
                  <div className="relative flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={trackCompetitors}
                      onChange={(e) => setTrackCompetitors(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 rounded-full bg-white/10 peer-checked:bg-bb-blue transition-colors duration-200" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-4" />
                  </div>
                  <div>
                    <p className="text-sm text-white/80 group-hover:text-white transition-colors">Discover new competitors</p>
                    <p className="text-[11px] text-white/30">Onni scans for rivals that entered your space</p>
                  </div>
                </label>

                {error && (
                  <p className="text-xs text-red-400 text-center">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-white text-[#0f1117] py-2.5 text-sm font-semibold disabled:opacity-50 hover:bg-white/90 active:scale-[0.98] transition-all mt-1"
                >
                  {loading ? "Setting up…" : !user ? "Sign up to monitor" : !isPro ? "Upgrade to enable" : "Start monitoring 🐾"}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-xl border border-white/10 py-2 text-sm text-white/30 hover:text-white/60 hover:border-white/20 transition"
                >
                  Cancel
                </button>
              </form>
            </>
          )}
        </div>

        {/* RIGHT — light value panel */}
        <div className="hidden sm:flex flex-col w-[48%] bg-white px-8 py-9 gap-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-300 hover:text-gray-500 transition-colors p-1 rounded-lg hover:bg-gray-50"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.207 3.793a1 1 0 0 0-1.414 0L8 6.586 5.207 3.793a1 1 0 0 0-1.414 1.414L6.586 8l-2.793 2.793a1 1 0 1 0 1.414 1.414L8 9.414l2.793 2.793a1 1 0 0 0 1.414-1.414L9.414 8l2.793-2.793a1 1 0 0 0 0-1.414Z" />
            </svg>
          </button>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">What you get</p>
            <h3 className="text-lg font-extrabold text-gray-900 leading-snug">
              Your competitive edge,<br />on autopilot.
            </h3>
          </div>

          <div className="flex flex-col gap-1">
            {MONITOR_PERKS.map((p, i) => (
              <div
                key={p.label}
                className="flex items-start gap-3 py-2"
                style={{ animation: `mmFadeIn 0.3s ${i * 60}ms both` }}
              >
                <span className="text-lg leading-none mt-0.5 flex-shrink-0">{p.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900 leading-none">{p.label}</p>
                  <p className="text-xs text-gray-400 leading-snug mt-0.5">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-4 border-t border-gray-100">
            {isPro ? (
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-green-500/15 flex items-center justify-center text-green-600 text-xs">✓</span>
                <p className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">Pro plan.</span> Monthly monitoring included.
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                <span className="font-semibold text-gray-600">$5/month Pro plan</span> — includes unlimited analyses + monthly monitor.
              </p>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes mmFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes mmSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes mmBounce {
          0%   { transform: scale(0.5); opacity: 0; }
          70%  { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
