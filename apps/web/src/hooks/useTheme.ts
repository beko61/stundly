"use client";

import { useEffect, useState, useCallback } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "stundly_theme";

/**
 * Theme (dark/light) yönetimi.
 *
 * Öncelik: localStorage > prefers-color-scheme > "dark" (fallback).
 * FOUC önlemi için ilk paint'ten önce `layout.tsx` içindeki inline script
 * `document.documentElement.dataset.theme`'i set eder. Bu hook aynı değeri
 * okuyup React state'e senkronize eder.
 */
export function useTheme(): { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>("dark");

  // Mount'ta gerçek theme'i document'ten oku (script tarafından set edildi)
  useEffect(() => {
    const current = (document.documentElement.dataset.theme as Theme | undefined) ?? "dark";
    setThemeState(current);
  }, []);

  const applyTheme = useCallback((t: Theme) => {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(STORAGE_KEY, t); } catch { /* private mode */ }
    setThemeState(t);
  }, []);

  const toggle = useCallback(() => {
    applyTheme(theme === "dark" ? "light" : "dark");
  }, [theme, applyTheme]);

  return { theme, toggle, setTheme: applyTheme };
}
