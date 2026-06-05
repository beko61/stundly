"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "workly_cookie_consent";

export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) setShow(true);
  }, []);

  const handle = (choice: "accepted" | "rejected") => {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
      localStorage.setItem(`${STORAGE_KEY}_at`, new Date().toISOString());
    } catch {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie-Einwilligung"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "rgba(15,15,19,0.98)",
        borderTop: "1px solid var(--border)",
        padding: "20px 24px",
        zIndex: 9999,
        backdropFilter: "blur(10px)",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.3)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            flex: "1 1 320px",
            color: "var(--text)",
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          <strong style={{ display: "block", marginBottom: 4 }}>🍪 Cookies & Datenschutz</strong>
          Wir verwenden technisch notwendige Cookies (Login, Spracheinstellung) und optional
          Analyse-Cookies, um Workly zu verbessern. Du kannst deine Auswahl jederzeit ändern.{" "}
          <Link
            href="/datenschutz"
            style={{ color: "var(--accent2)", textDecoration: "underline" }}
          >
            Datenschutzerklärung
          </Link>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => handle("rejected")}
            className="btn"
            style={{ padding: "10px 18px", fontSize: 13 }}
          >
            Nur notwendige
          </button>
          <button
            type="button"
            onClick={() => handle("accepted")}
            className="btn btn-primary"
            style={{ padding: "10px 18px", fontSize: 13 }}
          >
            Alle akzeptieren
          </button>
        </div>
      </div>
    </div>
  );
}
