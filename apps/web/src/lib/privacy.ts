"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Privacy Mode — Para gizleme.
 *
 * Mobile-first: telefonda açıldığında para değerleri default "●●●●" görünür.
 * Kullanıcı 🔒/👁 butonu ile açıp kapatabilir. localStorage'da saklanır,
 * tüm sekmelerde senkron.
 */

const STORAGE_KEY = "stundly_privacy_mode";
const EVENT_NAME  = "stundly:privacy-changed";

/** Para gizli mi? `true` = gizli (default), `false` = görünür. */
export function isPrivacyHidden(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) !== "0";
}

/** Tüm sekmelerde para görünürlüğünü değiştir. */
export function setPrivacyHidden(hidden: boolean): void {
  localStorage.setItem(STORAGE_KEY, hidden ? "1" : "0");
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: hidden }));
}

/** React hook: [hidden, toggle]. SSR-safe (default true). */
export function usePrivacyMode(): [boolean, () => void] {
  const [hidden, setHidden] = useState<boolean>(true);

  useEffect(() => {
    setHidden(isPrivacyHidden());
    const handler = (e: Event) => {
      const ce = e as CustomEvent<boolean>;
      setHidden(ce.detail);
    };
    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setHidden(e.newValue !== "0");
    };
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, []);

  const toggle = useCallback(() => {
    setPrivacyHidden(!hidden);
  }, [hidden]);

  return [hidden, toggle];
}

/**
 * Para değerini formatla — gizliyse "●●●".
 * @param value sayı (örn 1234.56)
 * @param hidden gizli mi
 * @param opts.withSymbol  öne "€" koy (default true)
 * @param opts.decimals    ondalık (default 2)
 */
export function maskMoney(
  value: number,
  hidden: boolean,
  opts: { withSymbol?: boolean; decimals?: number } = {},
): string {
  const { withSymbol = true, decimals = 2 } = opts;
  if (hidden) return withSymbol ? "€ •••" : "•••";
  const formatted = value.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return withSymbol ? `€ ${formatted}` : formatted;
}
