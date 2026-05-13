import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type ThemePreference = 'dark' | 'light' | 'system';
type ResolvedTheme = 'dark' | 'light';

interface ThemeState {
  theme: ThemePreference;
  resolved: ResolvedTheme;
  setTheme: (next: ThemePreference) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'opsgpt:theme';
const ThemeContext = createContext<ThemeState | null>(null);

function readStoredTheme(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'dark' || raw === 'light' || raw === 'system') return raw;
  } catch {
    /* storage disabled */
  }
  return 'dark';
}

function systemPrefersLight(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-color-scheme: light)').matches;
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('light', resolved === 'light');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => readStoredTheme());
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    theme === 'light' ? 'light' : theme === 'dark' ? 'dark' : (systemPrefersLight() ? 'light' : 'dark')
  );

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  // Re-resolve whenever the user pref changes.
  useEffect(() => {
    if (theme === 'system') {
      setResolved(systemPrefersLight() ? 'light' : 'dark');
    } else {
      setResolved(theme);
    }
  }, [theme]);

  // Listen to system theme changes only when user pref is `system`.
  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e: MediaQueryListEvent) => setResolved(e.matches ? 'light' : 'dark');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage disabled */
    }
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark');
  }, [theme, setTheme]);

  const value = useMemo<ThemeState>(() => ({
    theme,
    resolved,
    setTheme,
    toggleTheme,
  }), [theme, resolved, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
