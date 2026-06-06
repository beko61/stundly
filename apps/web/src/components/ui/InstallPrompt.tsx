"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "stundly_install_dismissed_at";
const DISMISS_DAYS = 14;

/**
 * Custom install banner — guarantees the user always sees a way to install,
 * even when Chrome doesn't show its native banner due to user-engagement
 * heuristics.
 *
 * Logic:
 * - On modern Chrome/Edge/Samsung Internet: `beforeinstallprompt` fires,
 *   we capture it and show our own button. Clicking calls `prompt()`.
 * - On iOS Safari: the event never fires (no programmatic install). We
 *   detect iOS and show a "Zum Home-Bildschirm hinzufügen" instruction
 *   pointing to the Share button.
 * - Once installed (standalone mode) the prompt disappears forever.
 */
export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed?
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);
    if (isStandalone) return;

    // Recently dismissed?
    try {
      const dismissedAt = localStorage.getItem(DISMISS_KEY);
      if (dismissedAt) {
        const days = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
        if (days < DISMISS_DAYS) return;
      }
    } catch {}

    // Chrome / Edge / Samsung Internet path
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari path
    const ua = window.navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/i.test(ua) && !(window as { MSStream?: unknown }).MSStream;
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
    if (isIOS && isSafari) {
      // Show after a small delay so user sees content first
      const t = setTimeout(() => setShowIos(true), 3000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      if (result.outcome === "accepted") {
        setShow(false);
      } else {
        dismiss();
      }
    } catch {
      dismiss();
    }
  };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setShow(false);
    setShowIos(false);
  };

  if (!show && !showIos) return null;

  return (
    <div
      role="dialog"
      aria-label="App installieren"
      style={{
        position: "fixed",
        bottom: "calc(80px + env(safe-area-inset-bottom))",
        left: 12,
        right: 12,
        zIndex: 200,
        background: "linear-gradient(135deg, #7c6af7, #5b4ad6)",
        borderRadius: 14,
        padding: "14px 16px",
        boxShadow: "0 8px 32px rgba(124, 106, 247, 0.4)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        color: "white",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      <div style={{ fontSize: 28, flexShrink: 0 }} aria-hidden="true">📲</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>
          Stundly als App installieren
        </div>
        <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.4 }}>
          {showIos
            ? "Tippe unten auf das Teilen-Symbol und dann auf „Zum Home-Bildschirm“."
            : "Schneller Zugriff, offline nutzbar, kein App Store nötig."}
        </div>
      </div>
      {show && !showIos && (
        <button
          type="button"
          onClick={handleInstall}
          style={{
            background: "white",
            color: "#5b4ad6",
            border: "none",
            padding: "8px 14px",
            borderRadius: 8,
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Installieren
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Schließen"
        style={{
          background: "transparent",
          border: "none",
          color: "white",
          fontSize: 22,
          cursor: "pointer",
          padding: 4,
          lineHeight: 1,
          opacity: 0.8,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
