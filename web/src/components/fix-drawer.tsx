"use client";

import { useEffect, useRef } from "react";
import { X, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";

type FeedItem = {
  id: string;
  title: string;
  status: string;
  description: string;
  how_to_fix: string;
  action_label: string;
};

type FixDrawerProps = {
  item: FeedItem | null;
  onClose: () => void;
};

function priorityColor(status: string) {
  const s = status.toLowerCase();
  if (s.includes("critical") || s.includes("high")) return "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-200 dark:border-red-500/30";
  if (s.includes("medium")) return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-200 dark:border-yellow-500/30";
  return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-200 dark:border-blue-500/30";
}

function parseSteps(raw: string): string[] {
  if (!raw) return [];
  // Split on numbered lines like "1." "2." or newlines
  const lines = raw
    .split(/\n|(?=\d+\.\s)/)
    .map((l) => l.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);
  return lines;
}

export function FixDrawer({ item, onClose }: FixDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Trap focus inside drawer when open
  useEffect(() => {
    if (item) drawerRef.current?.focus();
  }, [item]);

  const steps = item ? parseSteps(item.how_to_fix) : [];

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 dark:bg-black/60 transition-opacity duration-200 ${
          item ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={item ? `How to fix: ${item.title}` : "Fix guide"}
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white shadow-2xl flex flex-col outline-none dark:bg-bb-phantom dark:border-l dark:border-bb-steelDark
          transition-transform duration-300 ease-in-out
          ${item ? "translate-x-0" : "translate-x-full"}`}
      >
        {item && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4 border-b border-bb-steel/40 dark:border-bb-steelDark">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 flex-shrink-0 rounded-full bg-bb-phantom/10 p-2 dark:bg-bb-phantom/60">
                  <Wrench className="w-4 h-4 text-bb-phantom dark:text-bb-phantomLight" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-900 leading-tight dark:text-bb-phantomLight">
                    {item.title}
                  </h2>
                  <span
                    className={`mt-1 inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${priorityColor(item.status)}`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex-shrink-0 rounded-md p-1.5 text-gray-400 hover:text-gray-700 hover:bg-bb-cloud transition-colors dark:text-bb-phantomLight/60 dark:hover:text-bb-phantomLight dark:hover:bg-bb-phantom"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto px-6 py-5 space-y-6">
              {/* What's the issue */}
              {item.description && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 dark:text-bb-phantomLight/60">
                    What's the issue
                  </h3>
                  <p className="text-sm text-gray-700 leading-relaxed dark:text-bb-phantomLight/80">{item.description}</p>
                </section>
              )}

              {/* How to fix */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 dark:text-bb-phantomLight/60">
                  How to fix
                </h3>
                {steps.length > 0 ? (
                  <ol className="space-y-3">
                    {steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-bb-phantom text-white text-xs font-semibold flex items-center justify-center mt-0.5 dark:bg-bb-steelDark dark:text-bb-phantomLight">
                          {i + 1}
                        </span>
                        <p className="text-sm text-gray-700 leading-relaxed dark:text-bb-phantomLight/80">{step}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-gray-400 italic dark:text-bb-phantomLight/50">
                    No fix steps available yet. Re-run the audit for detailed guidance.
                  </p>
                )}
              </section>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-bb-steel/40 flex gap-3 dark:border-bb-steelDark">
              <Button
                className="flex-1 bg-bb-phantom text-white hover:bg-bb-phantom/90 dark:bg-bb-steelDark dark:text-bb-phantomLight dark:hover:bg-bb-steelDark/90"
                onClick={onClose}
              >
                Got it
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
