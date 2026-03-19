"use client";

import { useMemo } from "react";

const GhostIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
  >
    <path d="M12 2a8 8 0 0 0-8 8v10l2-2 2 2 2-2 2 2 2-2 2 2V10a8 8 0 0 0-8-8zm0 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-3 7.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
  </svg>
);

type HeaderProps = {
  credits?: number;
  user?: string;
};

export function Header({ credits = 1989, user = "chris@backboard.io" }: HeaderProps) {
  const formattedCredits = useMemo(
    () => (credits ?? 0).toLocaleString() + " Credits",
    [credits]
  );

  return (
    <header className="flex items-center justify-between gap-4 bg-bb-phantom text-bb-phantomLight px-4 py-3 rounded-t-xl border-b border-bb-steelDark">
      <div className="flex items-center gap-2">
        <GhostIcon />
        <span className="font-semibold text-white">AI CMO Terminal</span>
      </div>
      <div className="flex items-center gap-2 rounded-full bg-bb-steelDark/80 px-3 py-1.5 text-sm">
        <div className="w-6 h-6 rounded-full bg-bb-blue/30 flex items-center justify-center text-xs font-medium">
          {user.slice(0, 1).toUpperCase()}
        </div>
        <span className="text-bb-phantomLight truncate max-w-[120px]">{user}</span>
        <span className="text-bb-steel font-medium">{formattedCredits}</span>
      </div>
    </header>
  );
}
