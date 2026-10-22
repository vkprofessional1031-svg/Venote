'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

type ThemePreference = 'system' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveEffectiveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === 'system') return getSystemTheme();
  return pref;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark');

  // Initialize from localStorage and DOM
  useEffect(() => {
    let saved: ThemePreference = 'system';
    try {
      const val = localStorage.getItem('theme');
      if (val === 'light' || val === 'dark' || val === 'system') {
        saved = val;
      }
    } catch (e) {}

    const resolved = resolveEffectiveTheme(saved);
    setThemeState(saved);
    setResolvedTheme(resolved);
    document.documentElement.setAttribute('data-theme', resolved);

    // Watch OS system preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      try {
        const current = localStorage.getItem('theme');
        if (!current || current === 'system') {
          const nextResolved: ResolvedTheme = e.matches ? 'dark' : 'light';
          setResolvedTheme(nextResolved);
          document.documentElement.setAttribute('data-theme', nextResolved);
        }
      } catch (err) {}
    };

    mediaQuery.addEventListener('change', handleMediaChange);
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, []);

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    setThemeState(nextTheme);
    try {
      localStorage.setItem('theme', nextTheme);
    } catch (e) {}

    const nextResolved = resolveEffectiveTheme(nextTheme);
    setResolvedTheme(nextResolved);
    document.documentElement.setAttribute('data-theme', nextResolved);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
