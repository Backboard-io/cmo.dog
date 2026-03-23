"use client";

import { useEffect } from "react";

const THEME_KEY = "cmodog_theme";

type Theme = "light" | "dark";

function getPreferredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

export function ThemeInit() {
  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY);
    const theme = stored === "dark" || stored === "light" ? stored : getPreferredTheme();
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, []);

  return null;
}
