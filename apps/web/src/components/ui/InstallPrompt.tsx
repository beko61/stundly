"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "stundly_install_dismissed_at";
const DISMISS_DAYS = 14;

type Platform = "android-chrome" | "ios-safari" | "other";

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "other";
  const ua = window.navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  if (isIOS) return "ios-safari";
  if (isAndroid) return "android-chrome";
  return "other";
}

/**
 * Custom install prompt — always shows a tappable banner on mobile.
 *  • Android Chrome → if `beforeinstallprompt` fires, button calls prompt().
 *    Otherwise the button opens an instruction modal ("3-Punkt-Menü → App installieren").
 *  • iOS Safari → button opens an instruction modal (Safari has no programmatic
 *    install API; user must use the Share menu).
 *  • Desktop / standalone (already installed) → nothing shown.
 */
export function InstallPrompt() {
  const [platform, setPlatform] = useState<Platform>("other");
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [howto, setHowto] = useState<"ios" | "android" | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed (standalone)?
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
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

    const p = detectPlatform();
    setPlatform(p);

    // Only show on mobile platforms
    if (p === "other") return;

    // Chrome path: capture event so button works programmatically
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Show banner after a small delay so it doesn't interrupt first paint
    const t = setTimeout(() => setShow(true), 1500);

    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleClick = async () => {
    if (platform === "ios-safari") {
      setHowto("ios");
      return;
    }
    // Android Chrome
    if (installEvent) {
      try {
        await installEvent.prompt();
        const res = await installEvent.userChoice;
        if (res.outcome === "accepted") {
          setShow(false);
          return;
        }
        dismiss();
      } catch {
        setHowto("android");
      }
      return;
    }
    // Chrome event not fired → show manual instructions
    setHowto("android");
  };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setShow(false);
    setHowto(null);
  };

  if (!show && !howto) return null;

  return (
    <>
      {show && !howto && (
        <div
          role="dialog"
          aria-label="Stundly App installieren"
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
              Stundly auf dem Home-Bildschirm
            </div>
            <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.4 }}>
              Schneller Zugriff, kein App Store nötig.
            </div>
          </div>
          <button
            type="button"
            onClick={handleClick}
            style={{
              background: "white",
              color: "#5b4ad6",
              border: "none",
              padding: "9px 14px",
              borderRadius: 8,
              fontWeight: 800,
              fontSize: 13,
              cursor: "pointer",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            Installieren
          </button>
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
      )}

      {howto && (
        <div
          role="dialog"
          aria-label="Installationsanleitung"
          onClick={dismiss}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(6px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)",
              borderRadius: 16,
              padding: 24,
              maxWidth: 380,
              width: "100%",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12, textAlign: "center" }}>📲</div>
            <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 12, textAlign: "center" }}>
              {howto === "ios" ? "So installierst du Stundly" : "Stundly als App installieren"}
            </h3>
            {howto === "ios" ? (
              <ol style={{ paddingLeft: 22, fontSize: 14, lineHeight: 1.9, color: "var(--muted)" }}>
                <li>Tippe unten auf das <strong style={{ color: "var(--text)" }}>Teilen-Symbol</strong> (Quadrat mit Pfeil ↑)</li>
                <li>Scrolle nach unten</li>
                <li>Wähle <strong style={{ color: "var(--text)" }}>„Zum Home-Bildschirm“</strong></li>
                <li>Tippe oben rechts auf <strong style={{ color: "var(--text)" }}>„Hinzufügen“</strong></li>
              </ol>
            ) : (
              <ol style={{ paddingLeft: 22, fontSize: 14, lineHeight: 1.9, color: "var(--muted)" }}>
                <li>Tippe oben rechts auf das <strong style={{ color: "var(--text)" }}>3-Punkte-Menü</strong> (⋮)</li>
                <li>Wähle <strong style={{ color: "var(--text)" }}>„App installieren“</strong> oder <strong style={{ color: "var(--text)" }}>„Zum Startbildschirm hinzufügen“</strong></li>
                <li>Bestätige mit <strong style={{ color: "var(--text)" }}>„Installieren“</strong></li>
              </ol>
            )}
            <button
              type="button"
              onClick={dismiss}
              style={{
                marginTop: 18,
                width: "100%",
                padding: "12px",
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: 10,
                fontWeight: 800,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Verstanden
            </button>
          </div>
        </div>
      )}
    </>
  );
}
