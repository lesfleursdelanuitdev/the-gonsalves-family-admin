"use client";

import { createContext, useContext, useEffect, useState } from "react";

/** Set to false to lock to parchment (light) only */
export const DARK_MODE_ENABLED = true;

export type AppTheme = "dark" | "parchment" | "verdure" | "stone";

type ThemeContextType = {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_KEY = "gonsalves-theme";

export const THEME_CONFIG: Record<
  AppTheme,
  { label: string; description: string; daisyTheme: string; dark: boolean }
> = {
  dark: {
    label: "Dark",
    description: "Dark charcoal canvas with forest green & crimson",
    daisyTheme: "business",
    dark: true,
  },
  parchment: {
    label: "Parchment",
    description: "Warm aged vellum — light mode default",
    daisyTheme: "parchment",
    dark: false,
  },
  verdure: {
    label: "Verdure",
    description: "Pale forest green — cool heraldic light",
    daisyTheme: "verdure",
    dark: false,
  },
  stone: {
    label: "Stone & Crimson",
    description: "Neutral stone grey with crimson accents",
    daisyTheme: "stone",
    dark: false,
  },
};

function isAppTheme(s: string | null): s is AppTheme {
  return s != null && s in THEME_CONFIG;
}

function getInitialTheme(): AppTheme {
  if (!DARK_MODE_ENABLED) return "parchment";
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light") {
    localStorage.setItem(STORAGE_KEY, "parchment");
    return "parchment";
  }
  if (isAppTheme(stored)) return stored;
  localStorage.setItem(STORAGE_KEY, "dark");
  return "dark";
}

function applyTheme(theme: AppTheme) {
  const config = THEME_CONFIG[theme];
  document.documentElement.classList.toggle("dark", config.dark);
  document.documentElement.setAttribute("data-theme", config.daisyTheme);
  document.documentElement.style.colorScheme = config.dark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>("dark");

  useEffect(() => {
    const initial = getInitialTheme();
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const setTheme = (newTheme: AppTheme) => {
    if (!DARK_MODE_ENABLED) return;
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    applyTheme(newTheme);
  };

  /** Primary toggle: cycles between dark and parchment only */
  const toggleTheme = () => {
    setTheme(theme === "dark" ? "parchment" : "dark");
  };

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, toggleTheme, isDark: THEME_CONFIG[theme].dark }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
