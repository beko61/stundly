"use client";

import { useEffect, useState } from "react";

interface Props {
  storageKey: string;
  title: string;
  text: string;
  cta?: string;
}

export function WelcomeBanner({ storageKey, title, text, cta = "Verstanden" }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed) setShow(true);
  }, [storageKey]);

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label={title}
      style={{
        margin: "14px 32px 0",
        maxWidth: 960,
        marginLeft: "auto",
        marginRight: "auto",
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--accent2) 18%, transparent), color-mix(in srgb, var(--accent2) 6%, transparent))",
        border: "1px solid color-mix(in srgb, var(--accent2) 40%, transparent)",
        borderRadius: 14,
        padding: "16px 18px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        position: "relative",
      }}
    >
      <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }} aria-hidden="true">
        👋
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "var(--text)",
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{text}</div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="btn btn-primary"
        style={{ padding: "8px 14px", fontSize: 12, flexShrink: 0 }}
      >
        {cta}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Schließen"
        style={{
          position: "absolute",
          top: 6,
          right: 8,
          background: "transparent",
          border: "none",
          color: "var(--muted)",
          fontSize: 18,
          cursor: "pointer",
          padding: 4,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
