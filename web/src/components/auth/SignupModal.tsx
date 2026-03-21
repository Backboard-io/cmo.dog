"use client";

import { useState } from "react";
import { signUp, login, storeToken, googleAuthUrl, UserInfo } from "@/lib/api";

type Props = {
  onSuccess: (user: UserInfo) => void;
  onClose: () => void;
  pendingDomain?: string;
};

type Tab = "signup" | "login";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" />
    </svg>
  );
}

const FEATURES = [
  { icon: "🔍", label: "Site Audit", desc: "Full technical & content audit" },
  { icon: "🏆", label: "Competitor Intel", desc: "See exactly how you stack up" },
  { icon: "🎙️", label: "Brand Voice", desc: "Capture your unique tone" },
  { icon: "📈", label: "SEO Fixes", desc: "Ranked, actionable improvements" },
  { icon: "💬", label: "AI Chat", desc: "Ask Onni anything about your site" },
];

export function SignupModal({ onSuccess, onClose, pendingDomain }: Props) {
  const [tab, setTab] = useState<Tab>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function resetForm() {
    setEmail("");
    setPassword("");
    setError("");
  }

  function switchTab(t: Tab) {
    setTab(t);
    resetForm();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Enter a valid email address");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const user = tab === "signup"
        ? await signUp(trimmedEmail, password)
        : await login(trimmedEmail, password);
      storeToken(user.token);
      onSuccess(user);
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : String(err);
      try {
        const parsed = JSON.parse(text);
        setError(parsed?.detail ?? "Something went wrong — try again");
      } catch {
        setError("Something went wrong — try again");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleClick() {
    window.location.href = googleAuthUrl();
  }

  const displayDomain = pendingDomain
    ? pendingDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: "fadeIn 0.2s ease both" }}
      />

      {/* Modal */}
      <div
        className="relative flex w-full max-w-2xl rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.4)]"
        style={{ animation: "slideUp 0.35s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {/* LEFT — dark auth panel */}
        <div className="flex flex-col w-full sm:w-[52%] bg-[#1a1a1a] px-8 py-9 gap-5">
          {/* Brand mark */}
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/onni.png" alt="Onni" className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10" />
            <span className="text-white font-semibold text-sm tracking-tight">CMO.dog</span>
          </div>

          {/* Headline */}
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-white leading-snug">
              {tab === "signup" ? "Start for free" : "Welcome back"}
            </h2>
            <p className="text-sm text-white/50">
              {tab === "signup"
                ? "Sign up to get your free report"
                : "Sign in to continue with Onni"}
            </p>
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogleClick}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-medium text-white hover:bg-white/10 active:scale-[0.98] transition-all"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/30">Or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden text-sm font-medium">
            <button
              type="button"
              onClick={() => switchTab("signup")}
              className={`flex-1 py-2 transition-colors ${
                tab === "signup"
                  ? "bg-white text-[#1a1a1a]"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              Sign up
            </button>
            <button
              type="button"
              onClick={() => switchTab("login")}
              className={`flex-1 py-2 transition-colors ${
                tab === "login"
                  ? "bg-white text-[#1a1a1a]"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              Log in
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="user@company.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              disabled={loading}
              autoFocus
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:ring-2 focus:ring-white/20 focus:border-white/25 transition"
            />
            <input
              type="password"
              placeholder="Password (min 8 chars)"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              disabled={loading}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:ring-2 focus:ring-white/20 focus:border-white/25 transition"
            />

            {error && (
              <p className="text-xs text-red-400 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-white text-[#1a1a1a] py-2.5 text-sm font-semibold disabled:opacity-50 hover:bg-white/90 active:scale-[0.98] transition-all"
            >
              {loading
                ? tab === "signup" ? "Creating account…" : "Signing in…"
                : tab === "signup" ? "Continue" : "Continue"}
            </button>
          </form>

          {/* Legal */}
          <p className="text-[11px] text-white/25 text-center leading-relaxed">
            By clicking continue, you agree to our{" "}
            <a href="/terms" className="underline hover:text-white/50 transition-colors">Terms of Service</a>
            {" "}and{" "}
            <a href="/privacy" className="underline hover:text-white/50 transition-colors">Privacy Policy</a>.
          </p>

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 sm:hidden text-white/30 hover:text-white/70 transition-colors p-1"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.207 3.793a1 1 0 0 0-1.414 0L8 6.586 5.207 3.793a1 1 0 0 0-1.414 1.414L6.586 8l-2.793 2.793a1 1 0 1 0 1.414 1.414L8 9.414l2.793 2.793a1 1 0 0 0 1.414-1.414L9.414 8l2.793-2.793a1 1 0 0 0 0-1.414Z" />
            </svg>
          </button>
        </div>

        {/* RIGHT — light value panel (hidden on mobile) */}
        <div className="hidden sm:flex flex-col w-[48%] bg-white px-8 py-9 gap-6 relative">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-300 hover:text-gray-500 transition-colors p-1 rounded-lg hover:bg-gray-50"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.207 3.793a1 1 0 0 0-1.414 0L8 6.586 5.207 3.793a1 1 0 0 0-1.414 1.414L6.586 8l-2.793 2.793a1 1 0 1 0 1.414 1.414L8 9.414l2.793 2.793a1 1 0 0 0 1.414-1.414L9.414 8l2.793-2.793a1 1 0 0 0 0-1.414Z" />
            </svg>
          </button>

          {/* Branding */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/onni.png" alt="Onni" className="w-9 h-9 rounded-lg object-cover" />
              <div>
                <p className="text-lg font-extrabold text-gray-900 leading-none tracking-tight">AI CMO</p>
                <p className="text-sm text-gray-400 italic font-medium leading-none">for growth</p>
              </div>
            </div>

            {displayDomain ? (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-xs font-medium text-blue-700">Analyzing: <span className="font-bold">{displayDomain}</span></span>
              </div>
            ) : (
              <p className="text-sm text-gray-500 leading-relaxed mt-1">
                The only agent you need for growth, marketing, and distribution.
              </p>
            )}
          </div>

          {/* Feature list */}
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-2">
              Included free
            </p>
            {FEATURES.map((f) => (
              <div key={f.label} className="flex items-center gap-3 py-1.5">
                <span className="text-lg leading-none">{f.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900 leading-none">{f.label}</p>
                  <p className="text-xs text-gray-400 leading-snug">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Free badge */}
          <div className="mt-auto pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              <span className="font-semibold text-gray-600">5 free analyses.</span> No credit card required.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
