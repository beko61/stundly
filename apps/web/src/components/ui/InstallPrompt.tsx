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
  // Also show on narrow viewports (mobile Chrome desktop mode, narrow tablets)
  const isNarrow = window.innerWidth <= 900;
  if (isIOS) return "ios-safari";
  if (isAndroid || isNarrow) return "android-chrome";
  return "other";
}

/**
 * Custom install prompt — auf dem Handy ein kleines 📲-Symbol (links über der Navigation); Tippen klappt
 * eine kleine Karte auf. Früher ein breites Banner, das unten Knöpfe (z. B. Speichern) verdeckte.
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
  const [expanded, setExpanded] = useState(false);

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

    // Don't compete with cookie banner — wait until user resolves cookies first
    const checkCookieConsent = () => {
      try {
        return localStorage.getItem("stundly_cookie_consent");
      } catch {
        return null;
      }
    };

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

    // Poll for cookie consent before showing install banner
    const showWhenReady = () => {
      if (checkCookieConsent()) {
        setShow(true);
      } else {
        // Retry every 500ms until cookie banner is resolved
        setTimeout(showWhenReady, 500);
      }
    };
    // First check after 2.5s (let user see content + maybe dismiss cookies)
    const t = setTimeout(showWhenReady, 2500);

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
      {show && !howto && !expanded && (
        // Klein: Symbol links über der Navigation (gegenüber dem Support-Button) — verdeckt keine Knöpfe
        <button
          type="button"
          className="install-fab"
          onClick={() => setExpanded(true)}
          aria-label="Stundly auf dem Home-Bildschirm installieren"
          title="App installieren"
          style={{
            width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer",
            background: "linear-gradient(135deg, #7c6af7, #5b4ad6)", color: "white", fontSize: 20,
            boxShadow: "0 4px 16px rgba(124, 106, 247, 0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <span aria-hidden="true">📲</span>
        </button>
      )}

      {show && !howto && expanded && (
        <div
          role="dialog"
          aria-label="Stundly App installieren"
          className="install-fab"
          style={{
            width: "min(300px, calc(100vw - 32px))",
            background: "linear-gradient(135deg, #7c6af7, #5b4ad6)",
            borderRadius: 14,
            padding: "12px 14px",
            boxShadow: "0 8px 32px rgba(124, 106, 247, 0.4)",
            color: "white",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ fontSize: 22, flexShrink: 0 }} aria-hidden="true">📲</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 2 }}>Stundly auf dem Home-Bildschirm</div>
              <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.4 }}>Schneller Zugriff, kein App Store nötig.</div>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Verkleinern"
              style={{ background: "transparent", border: "none", color: "white", fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1, opacity: 0.85, flexShrink: 0 }}
            >
              ×
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
            <button
              type="button"
              onClick={handleClick}
              style={{ background: "white", color: "#5b4ad6", border: "none", padding: "8px 14px", borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: "pointer" }}
            >
              Installieren
            </button>
            <button
              type="button"
              onClick={dismiss}
              style={{ background: "transparent", border: "none", color: "white", fontSize: 12, opacity: 0.85, cursor: "pointer", textDecoration: "underline", padding: 0 }}
            >
              Nicht mehr anzeigen
            </button>
          </div>
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
