"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createRun, getMe, getStoredToken, storeToken, clearToken, syncSubscription, UserInfo } from "@/lib/api";
import { SignupModal } from "@/components/auth/SignupModal";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { ReleaseNotesModal } from "@/components/ReleaseNotesModal";
import { SettingsModal, FREE_PROVIDER, FREE_MODEL } from "@/components/SettingsModal";
import { MonthlyMonitorModal } from "@/components/MonthlyMonitorModal";
import { BackboardBadge } from "@/components/BackboardBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowUpRight } from "lucide-react";

const SETTINGS_PROVIDER_KEY = "cmodog_llm_provider";
const SETTINGS_MODEL_KEY = "cmodog_model_name";
const PENDING_URL_KEY = "cmodog_pending_url";
const GITHUB_REPO = "Backboard-io/cmo.dog";
const GITHUB_URL = "https://github.com/Backboard-io/cmo.dog";
const YOUTUBE_ID = "92brtM12mAs";
const YOUTUBE_EMBED_SRC = `https://www.youtube.com/embed/${YOUTUBE_ID}?rel=0&modestbranding=1&playsinline=1`;

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

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.873 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z" />
    </svg>
  );
}

function GitHubStars() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
      headers: { Accept: "application/vnd.github.v3+json" },
    })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.stargazers_count === "number") setStars(d.stargazers_count);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col items-start gap-2">
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-bb-steel/25 bg-white/70 hover:bg-bb-phantom hover:border-bb-phantom hover:text-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-all duration-300 active:scale-[0.97] text-sm text-bb-phantom font-semibold"
      >
        <GitHubIcon className="w-4 h-4" />
        <span className="hidden sm:inline">View on GitHub</span>
        {stars !== null && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 group-hover:bg-white/20 border border-amber-200 group-hover:border-white/30 text-amber-600 group-hover:text-white text-xs font-bold transition-all duration-300">
            <StarIcon className="w-3 h-3" />
            {stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars}
          </span>
        )}
      </a>
    </div>
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
  const [showMonitor, setShowMonitor] = useState(false);
  const [demoVideoOpen, setDemoVideoOpen] = useState(false);
  const [llmProvider, setLlmProvider] = useState("openrouter");
  const [modelName, setModelName] = useState("openrouter/free");

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
      const savedUrl = sessionStorage.getItem(PENDING_URL_KEY);
      if (savedUrl) {
        sessionStorage.removeItem(PENDING_URL_KEY);
        setPendingUrl(savedUrl);
        // Strip protocol for display in the input
        setUrl(savedUrl.replace(/^https?:\/\//i, ""));
        refreshUser(ssoToken).then((info) => {
          if (info) void launchRun(savedUrl, info);
        });
      } else {
        refreshUser(ssoToken);
      }
      return;
    }

    const token = getStoredToken();
    if (token) refreshUser(token);

    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      setCheckoutSuccess(true);
      router.replace("/");
      if (token) {
        // Give the webhook a moment, then sync directly from Stripe to self-heal
        // any case where the webhook missed or the user lookup failed.
        setTimeout(async () => {
          try {
            await syncSubscription(token);
          } catch (e) {
            console.warn("[billing] sync failed:", e);
          }
          await refreshUser(token);
        }, 2000);
      }
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
      sessionStorage.setItem(PENDING_URL_KEY, target);
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
    sessionStorage.removeItem(PENDING_URL_KEY);
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
    <div className="flex flex-col flex-1 items-center overflow-auto">
      {/* Corner bar — full viewport width */}
      <div className="w-full flex items-start justify-between px-6 pt-3 pb-1">
        <GitHubStars />

        {/* Mini YouTube — top right corner (absolute iframe fills aspect box so taps hit the player on mobile) */}
        <div className="relative z-20 flex-shrink-0 w-28 sm:w-44 md:w-48 touch-manipulation">
          <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.12)] ring-1 ring-bb-steel/10 hover:shadow-[0_12px_32px_rgba(0,0,0,0.18)] transition-shadow duration-300 isolate">
            <iframe
              src={YOUTUBE_EMBED_SRC}
              title="CMO.dog — The World's First Free Open Source AI CMO"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 block h-full w-full border-0"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDemoVideoOpen(true);
              }}
              className="absolute top-1.5 right-1.5 z-30 flex size-7 items-center justify-center rounded-full bg-bb-phantom/80 text-white shadow-md ring-1 ring-white/30 backdrop-blur-[2px] transition hover:bg-bb-phantom hover:ring-white/50 active:scale-95 touch-manipulation sm:size-8"
              aria-label="Expand demo video"
            >
              <ArrowUpRight className="size-3.5 sm:size-4" aria-hidden />
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-bb-steel/60 text-center font-medium tracking-wide">▶ Watch the demo</p>
        </div>
      </div>

      <Dialog open={demoVideoOpen} onOpenChange={setDemoVideoOpen}>
        <DialogContent
          className="w-[min(100vw-1.5rem,56rem)] max-w-[calc(100%-1.5rem)] gap-3 p-3 sm:p-4 sm:max-w-5xl bg-bb-cloud border-bb-steel/60"
          showCloseButton
        >
          <DialogHeader className="text-left space-y-0">
            <DialogTitle className="text-base font-semibold text-bb-phantom pr-8">
              CMO.dog demo
            </DialogTitle>
          </DialogHeader>
          <div className="relative w-full aspect-video overflow-hidden rounded-xl ring-1 ring-bb-steel/15 shadow-lg isolate touch-manipulation">
            <iframe
              src={YOUTUBE_EMBED_SRC}
              title="CMO.dog — The World's First Free Open Source AI CMO (expanded)"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 block h-full w-full border-0"
            />
          </div>
        </DialogContent>
      </Dialog>

      {showSignup && (
        <SignupModal
          onSuccess={handleSignupSuccess}
          onClose={() => { setShowSignup(false); setPendingUrl(null); }}
          pendingDomain={pendingUrl ?? undefined}
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

      {showMonitor && (
        <MonthlyMonitorModal
          user={user}
          onClose={() => setShowMonitor(false)}
          onNeedSignup={() => { setShowMonitor(false); setShowSignup(true); }}
          onNeedUpgrade={() => { setShowMonitor(false); setShowUpgrade(true); }}
          prefillDomain={url}
        />
      )}

      <div className="flex flex-col items-center gap-6 w-full max-w-2xl px-6 pb-8 pt-2">

        {checkoutSuccess && (
          <div className="w-full rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 text-center">
            🎉 You&apos;re on Pro — unlimited analyses, go fetch!
          </div>
        )}

        {/* Hero */}
        <div
          className="text-center space-y-3"
          style={{ animation: "fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both" }}
        >
          {/* Onni floating */}
          <div
            className="inline-block relative"
            style={{ animation: "floatDog 3.5s ease-in-out infinite" }}
          >
            <div className="w-16 h-16 rounded-full overflow-hidden ring-4 ring-bb-blue/15 shadow-xl mx-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/onni.png" alt="Onni — The World's First Free Open Source AI CMO" className="object-cover w-full h-full" />
            </div>
            <span
              className="absolute -bottom-1 -right-1 bg-bb-phantom text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow"
              style={{ animation: "wagBadge 0.9s ease-in-out infinite alternate" }}
            >
              CMO
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold text-bb-phantom leading-[1.05] tracking-tight">
            Meet Onni.<br />
            <span
              className="hidden sm:block bg-gradient-to-r from-bb-blue via-purple-500 to-pink-500 bg-clip-text text-transparent"
              style={{ animation: "gradientShift 4s ease-in-out infinite" }}
            >
            The World's First Free Open Source AI CMO.
            </span>
            <span
              className="sm:hidden text-lg bg-gradient-to-r from-bb-blue via-purple-500 to-pink-500 bg-clip-text text-transparent"
              style={{ animation: "gradientShift 4s ease-in-out infinite" }}
            >
              The World's First Free Open Source AI CMO.
            </span>
          </h1>
          <p className="hidden sm:block text-base text-bb-steel max-w-sm mx-auto leading-relaxed">
            Drop in your domain. Onni audits your site, maps competitors, and finds your brand voice — free, instantly.
          </p>
        </div>

        {/* Domain form — the hero action */}
        <div
          className="w-full max-w-lg"
          style={{ animation: "fadeUp 0.45s 0.15s cubic-bezier(0.22,1,0.36,1) both" }}
        >
          <form onSubmit={handleSubmit} className="w-full">
            <div className="flex items-center rounded-2xl border-2 border-bb-steel/20 bg-white overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.08)] focus-within:border-bb-blue/40 focus-within:shadow-[0_4px_32px_rgba(0,123,252,0.12)] transition-all duration-200">
              <span className="pl-5 text-bb-steel/40 text-sm select-none flex-shrink-0">https://</span>
              <input
                type="text"
                placeholder="yourbusiness.com"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(""); }}
                disabled={loading}
                className="flex-1 min-w-0 bg-transparent text-bb-phantom placeholder:text-gray-300 text-lg font-medium outline-none border-0 pl-1 pr-2 py-4"
                aria-label="Website URL"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                disabled={loading}
                className="hidden sm:flex flex-shrink-0 text-bb-steel/40 hover:text-bb-phantom disabled:opacity-40 transition-colors p-2 rounded-xl hover:bg-bb-cloud"
                aria-label="Model settings"
                title="Model settings"
              >
                <GearIcon className="w-4 h-4" />
              </button>
              {/* Inline submit — desktop only */}
              <button
                type="submit"
                disabled={loading}
                className="hidden sm:flex flex-shrink-0 rounded-xl bg-bb-phantom text-white px-6 py-3 m-1.5 text-sm font-bold disabled:opacity-70 transition-all hover:bg-bb-blue active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bb-phantom whitespace-nowrap items-center gap-1.5"
                aria-label={loading ? "Onni is working" : "Analyze my site"}
              >
                {loading ? (
                  <>
                    <SpinnerIcon className="w-4 h-4 animate-spin" />
                    <span>Analyze</span>
                  </>
                ) : (
                  <>
                    <span>Analyze</span>
                    <span aria-hidden className="text-sm">🐾</span>
                  </>
                )}
              </button>
            </div>

            {/* Full-width submit — mobile only */}
            <button
              type="submit"
              disabled={loading}
              className="sm:hidden mt-2 w-full rounded-2xl bg-bb-phantom text-white py-4 text-base font-bold disabled:opacity-70 transition-all hover:bg-bb-blue active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bb-phantom flex items-center justify-center gap-2"
              aria-label={loading ? "Onni is working" : "Analyze my site"}
            >
              {loading ? (
                <>
                  <SpinnerIcon className="w-5 h-5 animate-spin" />
                  <span>{quip}</span>
                </>
              ) : (
                <>
                  <span>Analyze</span>
                  <span aria-hidden className="text-base">🐾</span>
                </>
              )}
            </button>

            {error && (
              <p className="mt-2 text-sm text-destructive text-center animate-in fade-in slide-in-from-top-1 duration-200">
                {error}
              </p>
            )}
            {loading && (
              <p className="mt-2 text-xs text-bb-steel text-center sm:hidden">{quip}</p>
            )}
          </form>

          {/* User status strip */}
          <div className="mt-3 hidden sm:flex items-center justify-between px-1 text-xs text-bb-steel/70">
            {user ? (
              <>
                <span className="truncate max-w-[160px]">{user.email}</span>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {promptsLeft !== null ? (
                    <span className={`font-medium ${promptsLeft === 0 ? "text-red-500" : promptsLeft <= 2 ? "text-amber-500" : ""}`}>
                      {promptsLeft}/{user.prompts_limit} free left
                    </span>
                  ) : (
                    <span className="text-green-600 font-medium">Pro · unlimited</span>
                  )}
                  <button onClick={() => router.push("/history")} className="text-bb-blue hover:underline font-medium">History</button>
                  <button onClick={() => router.push("/billing")} className="text-bb-blue hover:underline font-medium">Billing</button>
                  <button onClick={() => { clearToken(); setUser(null); }} className="hover:text-red-500 transition-colors font-medium">Log out</button>
                </div>
              </>
            ) : (
              <p className="text-xs text-bb-steel/60 w-full text-center">
                5 free analyses · no credit card ·{" "}
                <button onClick={() => setShowSettings(true)} className="inline-flex items-center gap-0.5 text-bb-steel/50 hover:text-bb-steel transition-colors">
                  <GearIcon className="w-3 h-3" />
                  <span>{modelName.split("/").pop()}</span>
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Feature pills + monthly monitor CTA */}
        <div
          className="hidden sm:flex flex-wrap justify-center gap-2 text-xs text-bb-steel"
          style={{ animation: "fadeUp 0.5s 0.3s cubic-bezier(0.22,1,0.36,1) both" }}
        >
          {[
            { label: "Site Audit", icon: "🔍" },
            { label: "Competitor Intel", icon: "🏆" },
            { label: "Brand Voice", icon: "🎙️" },
            { label: "SEO Fixes", icon: "📈" },
            { label: "AI Chat", icon: "💬" },
          ].map((f) => (
            <span
              key={f.label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-bb-steel/15 font-medium shadow-sm hover:border-bb-blue/20 hover:bg-bb-blue/[0.03] transition-colors cursor-default"
            >
              <span>{f.icon}</span>
              {f.label}
            </span>
          ))}

          {/* Monthly Monitor pill — actionable CTA */}
          <button
            onClick={() => setShowMonitor(true)}
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-violet-200 font-medium shadow-sm hover:border-violet-400 hover:bg-violet-50 hover:shadow-[0_2px_12px_rgba(139,92,246,0.15)] transition-all active:scale-[0.97]"
          >
            <span>📅</span>
            <span className="text-violet-700 group-hover:text-violet-800 transition-colors">Monthly Monitor</span>
            <span className="text-[9px] font-bold uppercase tracking-wide text-violet-500 bg-violet-100 group-hover:bg-violet-200 px-1.5 py-0.5 rounded-full leading-none transition-colors">Pro</span>
          </button>
        </div>


      </div>

      {/* Footer — pinned to bottom of scroll container */}
      <div className="mt-auto w-full flex flex-wrap items-center justify-center gap-4 py-4">
        <button
          onClick={() => setShowReleaseNotes(true)}
          className="text-[11px] text-bb-steel/50 hover:text-bb-steel transition-colors underline underline-offset-2 decoration-bb-steel/20"
        >
          What&apos;s new in v2.2.0
        </button>

        <span className="text-bb-steel/20 text-xs">·</span>

        <BackboardBadge />
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
        @keyframes gradientShift {
          0%, 100% { filter: hue-rotate(0deg); }
          50%       { filter: hue-rotate(20deg); }
        }
      `}</style>
    </div>
  );
}
