"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { UserInfo } from "@/lib/api";
import { clearToken } from "@/lib/api";

const PawIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
  >
    <ellipse cx="5.5" cy="9" rx="2" ry="2.5" />
    <ellipse cx="9.5" cy="6.5" rx="2" ry="2.5" />
    <ellipse cx="14.5" cy="6.5" rx="2" ry="2.5" />
    <ellipse cx="18.5" cy="9" rx="2" ry="2.5" />
    <path d="M12 11c-3.5 0-6.5 2-6.5 5.5 0 2.2 1.8 3.5 4 3.5.8 0 1.6-.3 2.5-.3s1.7.3 2.5.3c2.2 0 4-1.3 4-3.5C18.5 13 15.5 11 12 11z" />
  </svg>
);

type HeaderProps = {
  user?: UserInfo | null;
};

export function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const usageLabel = user
    ? user.plan === "free"
      ? `${Math.max(0, user.prompts_limit - user.prompts_used)} / ${user.prompts_limit} free`
      : "Pro"
    : null;

  const usageColor =
    user?.plan === "free"
      ? Math.max(0, user.prompts_limit - user.prompts_used) === 0
        ? "text-red-400"
        : Math.max(0, user.prompts_limit - user.prompts_used) <= 2
        ? "text-amber-400"
        : "text-bb-steel"
      : "text-green-400";

  const isHistory = pathname === "/history";
  const isBilling = pathname === "/billing";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleBilling() {
    setOpen(false);
    router.push("/billing");
  }

  function handleLogout() {
    clearToken();
    setOpen(false);
    router.push("/");
  }

  return (
    <header className="flex items-center justify-between gap-4 bg-bb-phantom text-bb-phantomLight px-4 py-3 rounded-t-xl border-b border-bb-steelDark">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none">
          <PawIcon />
          <span className="font-semibold text-white">CMO.dog</span>
        </Link>
      </div>

      {user && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full bg-bb-steelDark/80 px-3 py-1.5 text-sm hover:bg-bb-steelDark transition-colors focus:outline-none focus:ring-2 focus:ring-bb-blue/30"
            aria-expanded={open}
            aria-haspopup="menu"
          >
            <div className="w-6 h-6 rounded-full bg-bb-blue/30 flex items-center justify-center text-xs font-medium text-white flex-shrink-0">
              {user.email.slice(0, 1).toUpperCase()}
            </div>
            <span className="hidden sm:inline text-bb-phantomLight truncate max-w-[130px]">{user.email}</span>
            {usageLabel && (
              <span className={`hidden sm:inline font-medium flex-shrink-0 ${usageColor}`}>{usageLabel}</span>
            )}
            <svg
              className={`w-3.5 h-3.5 text-bb-steel flex-shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
              viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden
            >
              <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 mt-1.5 w-48 rounded-xl border border-bb-steelDark bg-bb-phantom shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
            >
              <div className="px-3 py-2 border-b border-bb-steelDark mb-1">
                <p className="text-xs text-bb-steel truncate">{user.email}</p>
                <p className={`text-xs font-semibold mt-0.5 ${usageColor}`}>
                  {user.plan === "free"
                    ? `${Math.max(0, user.prompts_limit - user.prompts_used)} of ${user.prompts_limit} free left`
                    : "Pro — unlimited"}
                </p>
              </div>

              <Link
                href="/history"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-bb-phantomLight hover:bg-white/10 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3.5l2 1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                History
              </Link>

              <button
                role="menuitem"
                onClick={handleBilling}
                className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-white/10 transition-colors ${isBilling ? "text-bb-blue" : "text-bb-phantomLight"}`}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <rect x="1" y="3" width="14" height="10" rx="2" />
                  <path d="M1 6h14" strokeLinecap="round" />
                </svg>
                Billing
              </button>

              <div className="border-t border-bb-steelDark mt-1 pt-1">
                <button
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-400 hover:bg-white/10 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                    <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" strokeLinecap="round" />
                    <path d="M10 11l3-3-3-3M13 8H6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
