"use client";

import { Sun, Moon } from "lucide-react";
import { DARK_MODE_ENABLED, useTheme } from "@/providers/theme-provider";

export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  if (!DARK_MODE_ENABLED) return null;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center justify-center p-2 rounded-lg border border-border bg-surface hover:bg-surface-elevated text-text focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-2 focus:ring-offset-bg transition"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
    </button>
  );
}
