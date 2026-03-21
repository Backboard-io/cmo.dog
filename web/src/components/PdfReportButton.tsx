"use client";

import { useState, useCallback } from "react";
import { FileDown, Loader2, CheckCircle2, FileText } from "lucide-react";
import type { RunStatus } from "@/lib/api";
import { generatePdfReport } from "@/lib/generate-pdf";

type Phase = "idle" | "loading" | "done";

type Props = {
  run: RunStatus | null;
  disabled?: boolean;
};

export function PdfReportButton({ run, disabled }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");

  const handleClick = useCallback(async () => {
    if (!run || phase !== "idle") return;

    setPhase("loading");

    // Brief pause so the animation is appreciable, then open the report
    await new Promise((r) => setTimeout(r, 800));

    try {
      generatePdfReport(run);
      setPhase("done");
      // Reset to idle after 3s
      setTimeout(() => setPhase("idle"), 3000);
    } catch {
      setPhase("idle");
    }
  }, [run, phase]);

  const isDisabled = disabled || !run || phase === "loading";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      aria-label="Export PDF report"
      className={`
        group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
        text-xs font-semibold select-none
        transition-all duration-200 ease-out
        active:scale-[0.96]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bb-blue/40
        ${phase === "idle"
          ? "bg-bb-phantom text-white hover:bg-bb-phantom/85 shadow-sm hover:shadow-md"
          : phase === "loading"
          ? "bg-bb-phantom/70 text-white/80 cursor-wait"
          : "bg-emerald-600 text-white shadow-md"
        }
        disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
      `}
    >
      {/* Icon slot */}
      <span className="relative flex-shrink-0 w-3.5 h-3.5">
        {phase === "idle" && (
          <FileDown
            className="w-3.5 h-3.5 transition-transform duration-200 group-hover:-translate-y-0.5"
            strokeWidth={2.5}
          />
        )}
        {phase === "loading" && (
          <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} />
        )}
        {phase === "done" && (
          <CheckCircle2 className="w-3.5 h-3.5 animate-[scale-in_0.25s_ease-out]" strokeWidth={2.5} />
        )}
      </span>

      {/* Label */}
      <span className="transition-all duration-200">
        {phase === "idle" && "Export PDF"}
        {phase === "loading" && "Preparing…"}
        {phase === "done" && "Opened!"}
      </span>

      {/* Shimmer on hover (idle only) */}
      {phase === "idle" && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        >
          <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </span>
      )}
    </button>
  );
}

export function PdfReportButtonLarge({ run, disabled }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");

  const handleClick = useCallback(async () => {
    if (!run || phase !== "idle") return;
    setPhase("loading");
    await new Promise((r) => setTimeout(r, 900));
    try {
      generatePdfReport(run);
      setPhase("done");
      setTimeout(() => setPhase("idle"), 3000);
    } catch {
      setPhase("idle");
    }
  }, [run, phase]);

  const isDisabled = disabled || !run || phase === "loading";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        group relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
        text-sm font-semibold select-none transition-all duration-200 active:scale-[0.97]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-bb-blue/40
        ${phase === "idle"
          ? "bg-gradient-to-br from-bb-phantom to-slate-800 text-white shadow-lg hover:shadow-xl hover:-translate-y-px"
          : phase === "loading"
          ? "bg-bb-phantom/60 text-white/70 cursor-wait"
          : "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg"
        }
        disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none
      `}
    >
      <span className="w-4 h-4 flex-shrink-0">
        {phase === "idle" && <FileText className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" strokeWidth={2} />}
        {phase === "loading" && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />}
        {phase === "done" && <CheckCircle2 className="w-4 h-4" strokeWidth={2} />}
      </span>
      <span>
        {phase === "idle" && "Generate PDF Report"}
        {phase === "loading" && "Building report…"}
        {phase === "done" && "Report ready!"}
      </span>
      {phase === "idle" && (
        <span aria-hidden className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-600 bg-gradient-to-r from-transparent via-white/8 to-transparent" />
        </span>
      )}
    </button>
  );
}
