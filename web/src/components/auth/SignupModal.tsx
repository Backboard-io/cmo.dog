"use client";

import { useState } from "react";
import { signUp, login, storeToken, googleAuthUrl, UserInfo } from "@/lib/api";

type Props = {
  onSuccess: (user: UserInfo) => void;
  onClose: () => void;
};

type Tab = "signup" | "login";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function SignupModal({ onSuccess, onClose }: Props) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col gap-5"
        style={{ animation: "fadeUp 0.3s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-full bg-bb-phantom flex items-center justify-center text-2xl">
            🐾
          </div>
          <h2 className="text-xl font-semibold text-bb-phantom">
            {tab === "signup" ? "Start for free" : "Welcome back"}
          </h2>
          <p className="text-sm text-bb-steel">
            {tab === "signup"
              ? "5 free analyses. No credit card required."
              : "Sign in to continue with Onni."}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-lg border border-bb-steel/30 overflow-hidden text-sm font-medium">
          <button
            type="button"
            onClick={() => switchTab("signup")}
            className={`flex-1 py-2 transition-colors ${
              tab === "signup"
                ? "bg-bb-phantom text-white"
                : "text-bb-steel hover:bg-bb-cloud"
            }`}
          >
            Sign up
          </button>
          <button
            type="button"
            onClick={() => switchTab("login")}
            className={`flex-1 py-2 transition-colors ${
              tab === "login"
                ? "bg-bb-phantom text-white"
                : "text-bb-steel hover:bg-bb-cloud"
            }`}
          >
            Log in
          </button>
        </div>

        {/* Google button */}
        <button
          type="button"
          onClick={handleGoogleClick}
          className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-bb-steel/40 bg-white py-2.5 text-sm font-medium text-bb-phantom hover:bg-bb-cloud active:scale-[0.98] transition-all"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-bb-steel/20" />
          <span className="text-xs text-bb-steel">or</span>
          <div className="flex-1 h-px bg-bb-steel/20" />
        </div>

        {/* Email / password form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            disabled={loading}
            autoFocus
            className="w-full rounded-lg border border-bb-steel/40 bg-bb-cloud px-4 py-2.5 text-sm text-bb-phantom placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-bb-blue/30 focus:border-bb-blue transition"
          />
          <input
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            disabled={loading}
            className="w-full rounded-lg border border-bb-steel/40 bg-bb-cloud px-4 py-2.5 text-sm text-bb-phantom placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-bb-blue/30 focus:border-bb-blue transition"
          />

          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-bb-phantom text-white py-2.5 text-sm font-medium disabled:opacity-60 hover:bg-bb-phantom/85 active:scale-[0.98] transition-all"
          >
            {loading
              ? tab === "signup" ? "Creating account…" : "Signing in…"
              : tab === "signup" ? "Get started free" : "Sign in"}
          </button>
        </form>
      </div>

      <style jsx>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
