"use client";

import { useState, useRef, useEffect } from "react";

/**
 * Floating Support-Button — unten links.
 *
 * Reihenfolge der Bevorzugung:
 *   1. WhatsApp (wenn NEXT_PUBLIC_SUPPORT_WHATSAPP gesetzt) — grüner Kreis, direkt-Link
 *   2. E-Mail   (wenn NEXT_PUBLIC_SUPPORT_EMAIL gesetzt)    — accent2 Kreis, Popover mit 3 Optionen
 *      (mailto:, Gmail web, Adresse kopieren — robust für Windows ohne Mail-Client)
 *   3. Nichts (kein Button)
 */

const RAW_NUMBER = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "";
const NUMBER     = RAW_NUMBER.replace(/\D/g, "");
const EMAIL      = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "";

const WA_MSG    = encodeURIComponent("Hallo, ich brauche Hilfe mit Stundly");
const MAIL_SUBJ = encodeURIComponent("Frage zu Stundly");
const MAIL_BODY = encodeURIComponent("Hallo,\n\nich habe eine Frage zu Stundly:\n\n");

const BTN_BASE: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
  transition: "transform 0.2s",
  textDecoration: "none",
  border: "none",
  cursor: "pointer",
};

function EmailPopover() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Outside click + ESC schließen
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard nicht verfügbar */ }
  }

  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${EMAIL}&su=${MAIL_SUBJ}&body=${MAIL_BODY}`;
  const mailtoUrl = `mailto:${EMAIL}?subject=${MAIL_SUBJ}&body=${MAIL_BODY}`;

  return (
    <div ref={wrapRef} className="support-fab">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Hilfe per E-Mail"
        title="Hilfe per E-Mail"
        style={{
          ...BTN_BASE,
          background: "var(--accent2)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            bottom: 70,
            right: 0,
            minWidth: 260,
            background: "var(--surface)",
            border: "1px solid color-mix(in srgb, var(--accent2) 35%, transparent)",
            borderRadius: 12,
            padding: "12px 14px",
            boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
            fontFamily: "'Syne', sans-serif",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--accent2)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
            📧 Schreib mir
          </div>
          <div
            onClick={copyEmail}
            title="Klick zum Kopieren"
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
              padding: "8px 10px",
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              marginBottom: 10,
              cursor: "pointer",
              wordBreak: "break-all",
              color: "var(--text)",
            }}
          >
            {EMAIL} {copied && <span style={{ color: "var(--green)", fontFamily: "'Syne', sans-serif", fontSize: 10 }}> ✓ kopiert</span>}
          </div>

          <a
            href={mailtoUrl}
            onClick={() => setOpen(false)}
            style={{
              display: "block",
              padding: "9px 12px",
              background: "var(--accent2)",
              color: "white",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 12,
              fontWeight: 700,
              textAlign: "center",
              marginBottom: 6,
            }}
          >
            📨 Mail-Programm öffnen
          </a>

          <a
            href={gmailUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={{
              display: "block",
              padding: "9px 12px",
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 12,
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            🌐 Gmail (Web) öffnen
          </a>
        </div>
      )}
    </div>
  );
}

export function SupportButton() {
  if (NUMBER) {
    return (
      <a
        href={`https://wa.me/${NUMBER}?text=${WA_MSG}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Hilfe per WhatsApp"
        title="Hilfe per WhatsApp"
        className="support-fab"
        style={{ ...BTN_BASE, background: "#25D366" }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="white" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.464 3.488" />
        </svg>
      </a>
    );
  }

  if (EMAIL) return <EmailPopover />;

  return null;
}
