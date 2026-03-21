"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createRun, getMe, getStoredToken, storeToken, clearToken, UserInfo } from "@/lib/api";
import { SignupModal } from "@/components/auth/SignupModal";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { ReleaseNotesModal } from "@/components/ReleaseNotesModal";
import { SettingsModal, FREE_PROVIDER, FREE_MODEL } from "@/components/SettingsModal";

const SETTINGS_PROVIDER_KEY = "cmodog_llm_provider";
const SETTINGS_MODEL_KEY = "cmodog_model_name";

function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
      <path
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M12 2a10 10 0 0 1 10 10"
        className="origin-center"
      />
    </svg>
  );
}

const ONNI_QUIPS = [
  "Fetching your goals…",
  "Good boy is on it…",
  "Sniffing out your brand voice…",
  "Digging up SEO fixes…",
  "Chasing down your rivals…",
  "Chewing up your competitors…",
];

export default function Home() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [quip, setQuip] = useState("");
  const [error, setError] = useState("");

  const [user, setUser] = useState<UserInfo | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [llmProvider, setLlmProvider] = useState("openrouter");
  const [modelName, setModelName] = useState("anthropic/claude-sonnet-4-5");

  const router = useRouter();
  const searchParams = useSearchParams();

  const refreshUser = useCallback(async (token: string) => {
    try {
      const info = await getMe(token);
      setUser(info);
      if (info.plan === "free" && !localStorage.getItem(SETTINGS_MODEL_KEY)) {
        setLlmProvider(FREE_PROVIDER);
        setModelName(FREE_MODEL);
      }
      return info;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const storedProvider = localStorage.getItem(SETTINGS_PROVIDER_KEY);
    const storedModel = localStorage.getItem(SETTINGS_MODEL_KEY);
    if (storedProvider) setLlmProvider(storedProvider);
    if (storedModel) setModelName(storedModel);
  }, []);

  useEffect(() => {
    // Google OAuth drops ?sso_token after the inline localStorage write (fallback)
    const ssoToken = searchParams.get("sso_token");
    if (ssoToken) {
      storeToken(ssoToken);
      router.replace("/");
      refreshUser(ssoToken);
      return;
    }

    const token = getStoredToken();
    if (token) refreshUser(token);

    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      setCheckoutSuccess(true);
      if (token) setTimeout(() => refreshUser(token), 1500);
      router.replace("/");
    }

    const authError = searchParams.get("auth_error");
    if (authError) {
      setError(`Sign-in failed: ${authError.replace(/_/g, " ")}`);
      router.replace("/");
    }
  }, [refreshUser, router, searchParams]);

  function handleSaveSettings(provider: string, model: string) {
    setLlmProvider(provider);
    setModelName(model);
    localStorage.setItem(SETTINGS_PROVIDER_KEY, provider);
    localStorage.setItem(SETTINGS_MODEL_KEY, model);
  }

  async function launchRun(targetUrl: string, currentUser: UserInfo) {
    setLoading(true);
    setQuip(ONNI_QUIPS[Math.floor(Math.random() * ONNI_QUIPS.length)]);
    try {
      const { run_id } = await createRun(targetUrl, currentUser.token, llmProvider, modelName);
      // Optimistically update local count
      setUser((u) => u ? { ...u, prompts_used: u.prompts_used + 1 } : u);
      router.push(`/run/${run_id}`);
    } catch (err) {
      if (err instanceof Error && err.message === "limit_reached") {
        setShowUpgrade(true);
      } else {
        setError(err instanceof Error ? err.message : "Onni hit a snag — try again");
      }
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Drop in a URL — any URL");
      return;
    }
    let target = trimmed;
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
    setError("");

    if (!user) {
      setPendingUrl(target);
      setShowSignup(true);
      return;
    }

    if (user.plan === "free" && user.prompts_used >= user.prompts_limit) {
      setShowUpgrade(true);
      return;
    }

    await launchRun(target, user);
  }

  function handleSignupSuccess(newUser: UserInfo) {
    storeToken(newUser.token);
    setUser(newUser);
    setShowSignup(false);
    if (pendingUrl) {
      const target = pendingUrl;
      setPendingUrl(null);
      void launchRun(target, newUser);
    }
  }

  const promptsLeft =
    user?.plan === "free"
      ? Math.max(0, user.prompts_limit - user.prompts_used)
      : null;

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6 py-4 overflow-auto">
      {showSignup && (
        <SignupModal
          onSuccess={handleSignupSuccess}
          onClose={() => { setShowSignup(false); setPendingUrl(null); }}
        />
      )}

      {showUpgrade && user && (
        <UpgradeModal
          token={user.token}
          onClose={() => setShowUpgrade(false)}
        />
      )}

      {showReleaseNotes && (
        <ReleaseNotesModal onClose={() => setShowReleaseNotes(false)} />
      )}

      {showSettings && (
        <SettingsModal
          provider={llmProvider}
          model={modelName}
          isPro={user?.plan !== "free"}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
          onUpgrade={user ? () => { setShowSettings(false); setShowUpgrade(true); } : undefined}
        />
      )}

      <div
        className="flex flex-col items-center gap-6 w-full max-w-md"
        style={{ animation: "fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {checkoutSuccess && (
          <div className="w-full rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 text-center">
            🎉 You&apos;re on Pro — unlimited analyses, go fetch!
          </div>
        )}

        {/* Onni */}
        <div
          className="relative"
          style={{ animation: "floatDog 3.5s ease-in-out infinite" }}
        >
          <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-bb-blue/20 shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/onni.png"
              alt="Onni — Finnish dog and your new CMO"
              className="object-cover w-full h-full"
            />
          </div>
          <span
            className="absolute -bottom-1 -right-1 bg-bb-blue text-white text-xs font-semibold px-2 py-0.5 rounded-full shadow"
            style={{ animation: "wagBadge 0.8s ease-in-out infinite alternate" }}
          >
            CMO
          </span>
        </div>

        {/* Copy */}
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl md:text-3xl font-semibold text-bb-phantom leading-tight">
            Meet Onni.<br />Your new CMO.
          </h1>
          <p className="text-sm text-bb-steel max-w-xs mx-auto">
          Checks your website like a good dog.
          </p>
        </div>

        {/* URL form */}
        <form onSubmit={handleSubmit} className="w-full">
          <div className="flex items-center rounded-full border border-bb-steel/50 bg-white overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-bb-blue/20 focus-within:border-bb-steel transition-shadow">
            <input
              type="text"
              placeholder="yourbusiness.com"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(""); }}
              disabled={loading}
              className="flex-1 min-w-0 bg-transparent text-bb-phantom placeholder:text-gray-400 text-base outline-none border-0 pl-5 py-3"
              aria-label="Website URL"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              disabled={loading}
              className="flex-shrink-0 text-bb-steel hover:text-bb-phantom disabled:opacity-40 transition-colors p-2 mr-0.5 rounded-full hover:bg-bb-cloud focus:outline-none focus:ring-2 focus:ring-bb-blue/30"
              aria-label="Model settings"
              title="Model settings"
            >
              <GearIcon className="w-4 h-4" />
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-shrink-0 rounded-full bg-bb-phantom text-white px-5 py-2 m-1.5 text-sm font-medium disabled:opacity-70 transition-all hover:bg-bb-phantom/80 active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bb-phantom"
              aria-label={loading ? "Onni is working" : "Fetch my CMO report"}
            >
              <span className="flex items-center gap-1.5">
                {loading ? (
                  <>
                    <SpinnerIcon className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">{quip}</span>
                  </>
                ) : (
                  <>
                    <span>Fetch</span>
                    <span aria-hidden>🐾</span>
                  </>
                )}
              </span>
            </button>
          </div>

          {error && (
            <p className="mt-2 text-sm text-destructive text-center animate-in fade-in slide-in-from-top-1 duration-200">
              {error}
            </p>
          )}

          {loading && (
            <p className="mt-2 text-xs text-bb-steel text-center sm:hidden">
              {quip}
            </p>
          )}

          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1 text-[11px] text-bb-steel/60 hover:text-bb-steel transition-colors"
              aria-label="Change model"
            >
              <GearIcon className="w-3 h-3" />
              <span>{llmProvider} · {modelName.split("/").pop()}</span>
            </button>
          </div>
        </form>

        {/* User status strip */}
        {user ? (
          <div className="flex items-center justify-between w-full px-1 text-xs text-bb-steel">
            <span className="truncate max-w-[140px]">{user.email}</span>
            <div className="flex items-center gap-3 flex-shrink-0">
              {promptsLeft !== null ? (
                <span
                  className={`font-medium ${promptsLeft === 0 ? "text-red-500" : promptsLeft <= 2 ? "text-amber-500" : "text-bb-steel"}`}
                >
                  {promptsLeft} of {user.prompts_limit} free left
                </span>
              ) : (
                <span className="text-green-600 font-medium">Pro — unlimited</span>
              )}
              <button
                onClick={() => router.push("/history")}
                className="text-bb-blue hover:underline font-medium"
                aria-label="View history"
              >
                History
              </button>
              <button
                onClick={() => { clearToken(); setUser(null); }}
                className="text-bb-steel hover:text-red-500 transition-colors font-medium"
                aria-label="Log out"
              >
                Log out
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-bb-steel text-center">
            5 free analyses. No credit card required.{" "}
            <button
              onClick={() => setShowSignup(true)}
              className="text-bb-blue underline"
            >
              Sign up free
            </button>
          </p>
        )}

        {/* Feature pills */}
        <div
          className="flex flex-wrap justify-center gap-2 text-xs text-bb-steel"
          style={{ animation: "fadeUp 0.55s 0.15s cubic-bezier(0.22,1,0.36,1) both" }}
        >
          {["Site Audit", "Competitor Intel", "Brand Voice", "SEO Fixes", "AI Chat"].map((f) => (
            <span
              key={f}
              className="px-2.5 py-1 rounded-full bg-bb-cloud border border-bb-steel/20 font-medium"
            >
              {f}
            </span>
          ))}
        </div>

        {/* Release notes link */}
        <button
          onClick={() => setShowReleaseNotes(true)}
          className="text-[11px] text-bb-steel/60 hover:text-bb-steel transition-colors underline underline-offset-2 decoration-bb-steel/30"
          style={{ animation: "fadeUp 0.6s 0.25s cubic-bezier(0.22,1,0.36,1) both" }}
        >
          What&apos;s new in v0.1.1
        </button>
      </div>

      <style jsx>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatDog {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
        @keyframes wagBadge {
          from { transform: rotate(-8deg) scale(1); }
          to   { transform: rotate(8deg) scale(1.05); }
        }
      `}</style>
    </div>
  );
}
