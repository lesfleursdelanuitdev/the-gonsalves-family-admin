'use client';

import { createContext, useContext, useEffect, useState } from 'react';

/** Set to true to re-enable dark mode and the theme toggle */
export const DARK_MODE_ENABLED = true;

type Theme = 'light' | 'dark';

type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_KEY = 'gonsalves-theme';

/** DaisyUI theme name for each app mode */
export function daisyDataTheme(mode: Theme): 'lemonade' | 'business' {
  return mode === 'dark' ? 'business' : 'lemonade';
}

function getInitialTheme(): Theme {
  if (!DARK_MODE_ENABLED) return 'light';
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light') return 'light';
  if (stored == null || stored === '') {
    localStorage.setItem(STORAGE_KEY, 'dark');
  }
  return 'dark';
}

function applyColorScheme(mode: Theme) {
  document.documentElement.style.colorScheme = mode === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = getInitialTheme();
    setThemeState(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
    document.documentElement.setAttribute('data-theme', daisyDataTheme(initial));
    applyColorScheme(initial);
    setMounted(true);
  }, []);

  const setTheme = (newTheme: Theme) => {
    if (!DARK_MODE_ENABLED) return;
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    document.documentElement.setAttribute('data-theme', daisyDataTheme(newTheme));
    applyColorScheme(newTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
