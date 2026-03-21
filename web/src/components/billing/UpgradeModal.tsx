"use client";

import { useState } from "react";
import { createCheckout } from "@/lib/api";

type Props = {
  token: string;
  onClose: () => void;
};

export function UpgradeModal({ token, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpgrade() {
    setLoading(true);
    setError("");
    try {
      const { url } = await createCheckout(token);
      window.location.href = url;
    } catch {
      setError("Something went wrong — try again");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col gap-6"
        style={{ animation: "fadeUp 0.3s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-bb-phantom flex items-center justify-center text-3xl">
            🐾
          </div>
          <div>
            <h2 className="text-xl font-semibold text-bb-phantom">
              You&apos;ve used all 5 free analyses
            </h2>
            <p className="mt-1 text-sm text-bb-steel">
              Onni needs a treat. Upgrade to keep the insights coming.
            </p>
          </div>
        </div>

        {/* Plan card */}
        <div className="rounded-xl border-2 border-bb-blue/30 bg-bb-cloud p-5 flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold text-bb-phantom text-lg">Pro</span>
            <div className="text-right">
              <span className="text-2xl font-bold text-bb-phantom">$5</span>
              <span className="text-sm text-bb-steel"> / month</span>
            </div>
          </div>
          <ul className="space-y-1.5 text-sm text-bb-steel">
            {[
              "Unlimited analyses",
              "Competitor intel",
              "Brand voice reports",
              "SEO & audit fixes",
              "AI chat support",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="text-bb-blue">✓</span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <p className="text-xs text-destructive text-center -mt-2">{error}</p>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full rounded-lg bg-bb-phantom text-white py-2.5 text-sm font-medium disabled:opacity-60 hover:bg-bb-phantom/85 active:scale-[0.98] transition-all"
          >
            {loading ? "Redirecting to Stripe…" : "Upgrade for $5 / month"}
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-bb-steel/30 py-2.5 text-sm text-bb-steel hover:bg-bb-cloud transition"
          >
            Maybe later
          </button>
        </div>
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
