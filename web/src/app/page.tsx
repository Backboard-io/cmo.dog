"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { createRun } from "@/lib/api";

function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      aria-hidden
    >
      {/* Pixel-style robot head: eyes + body/teeth */}
      <rect x="8" y="6" width="3" height="3" fill="currentColor" />
      <rect x="13" y="6" width="3" height="3" fill="currentColor" />
      <rect x="6" y="12" width="3" height="3" fill="currentColor" />
      <rect x="10" y="12" width="4" height="3" fill="currentColor" />
      <rect x="15" y="12" width="3" height="3" fill="currentColor" />
      <rect x="8" y="18" width="2" height="2" fill="currentColor" />
      <rect x="11" y="18" width="2" height="2" fill="currentColor" />
      <rect x="14" y="18" width="2" height="2" fill="currentColor" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.25"
      />
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

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Enter a website URL");
      return;
    }
    let target = trimmed;
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
    setError("");
    setLoading(true);
    try {
      const { run_id } = await createRun(target);
      router.push(`/run/${run_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start run");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6">
      <div className="flex flex-col items-center gap-8 w-full max-w-xl">
        <LogoIcon className="w-10 h-10 text-bb-phantom" />
        <h1 className="text-2xl md:text-3xl font-semibold text-bb-phantom text-center leading-tight">
          The only CMO you need to grow your
          <br />
          business.
        </h1>
        <form onSubmit={handleSubmit} className="w-full max-w-md">
          <div className="flex items-center rounded-full border border-bb-steel/60 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-bb-blue/20 focus-within:border-bb-steel">
            <input
              type="text"
              placeholder="yourbusiness.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              className="flex-1 min-w-0 bg-transparent text-bb-phantom placeholder:text-gray-400 text-base outline-none border-0 pl-5 py-3"
              aria-label="Website URL"
            />
            <button
              type="submit"
              disabled={loading}
              className="flex-shrink-0 rounded-full bg-bb-phantom text-white px-5 py-2 m-1.5 text-sm font-medium disabled:opacity-70 transition-colors hover:bg-bb-phantom/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bb-phantom"
              aria-label={loading ? "Loading" : "Start analysis"}
            >
              <span className="flex items-center gap-1.5">
                {loading ? (
                  <SpinnerIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Start</span>
                    <span aria-hidden>→</span>
                  </>
                )}
              </span>
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-destructive text-center">{error}</p>
          )}
        </form>
      </div>
    </div>
  );
}
