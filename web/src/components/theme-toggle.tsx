"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "cmodog_theme";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(THEME_KEY);
  return stored === "dark" || stored === "light" ? stored : null;
}

function getPreferredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

export function ThemeToggle({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const [theme, setTheme] = useState<Theme>("light");
  const isDark = theme === "dark";
  const pillClasses =
    size === "sm"
      ? "h-8 px-2.5 text-[11px]"
      : "h-9 px-3 text-xs";

  useEffect(() => {
    const stored = readStoredTheme();
    const initial = stored ?? getPreferredTheme();
    setTheme(initial);
    applyTheme(initial);

    if (stored) return;
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const handler = (event: MediaQueryListEvent) => {
      const next = event.matches ? "dark" : "light";
      setTheme(next);
      applyTheme(next);
    };
    media.addEventListener?.("change", handler);
    return () => media.removeEventListener?.("change", handler);
  }, []);

  function handleToggle() {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={isDark}
      aria-label="Toggle dark mode"
      className={`group inline-flex items-center gap-2 rounded-full border border-bb-steel/40 bg-white/80 text-bb-phantom shadow-sm backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bb-blue/30 dark:bg-bb-steelDark/80 dark:text-bb-phantomLight dark:border-bb-steelDark ${pillClasses} ${className}`}
    >
      <span
        className={`inline-flex items-center justify-center rounded-full border border-bb-steel/40 bg-white text-bb-phantom transition-all duration-200 group-hover:scale-105 dark:bg-bb-phantom dark:text-bb-phantomLight dark:border-bb-steelDark ${
          size === "sm" ? "h-5 w-5" : "h-6 w-6"
        }`}
      >
        {isDark ? (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
            <path d="M12.76 3.2a.75.75 0 0 0-.82.99 7.5 7.5 0 0 1-8.95 9.9.75.75 0 0 0-.66 1.05A9 9 0 1 0 12.76 3.2Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        )}
      </span>
      <span className="font-semibold tracking-wide">
        {isDark ? "Dark" : "Light"}
      </span>
    </button>
  );
}

