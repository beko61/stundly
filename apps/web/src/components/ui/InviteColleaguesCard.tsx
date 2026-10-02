"use client";

import { useEffect, useState } from "react";
import { useSessionUserId } from "@/hooks/useSessionUserId";
import { inviteText, inviteUrl } from "@/lib/marketing/referral";
import { QrCodeButton } from "./QrCodeButton";

/**
 * "Kollegen einladen" — persönlicher Empfehlungslink zum Teilen (WhatsApp, Mail, …).
 * Wer sich darüber registriert, bekommt `referred_by` = dein Code (lib/marketing/referral).
 */
export function InviteColleaguesCard() {
  const userId = useSessionUserId();
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => { setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"); }, []);

  if (!userId) return null;
  const url = inviteUrl(userId);
  const text = inviteText(userId);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Link kopieren:", url);
    }
  }

  function share() {
    // Synchron im Klick aufrufen (iOS blockt navigator.share nach await)
    navigator.share({ title: "Stundly", text }).catch(() => { /* abgebrochen */ });
  }

  return (
    <div className="card purple" style={{ padding: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>👥 Kollegen einladen</h2>
      <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 12 }}>
        Kennst du jemanden, der seine Stunden noch auf Zettel schreibt? Zeig ihm den QR-Code
        oder schick deinen Link — in der Beta ist Stundly für alle kostenlos.
      </p>
      <div style={{
        fontFamily: "'DM Mono',monospace", fontSize: 13, padding: "10px 12px", borderRadius: 10,
        background: "var(--surface2)", border: "1px solid var(--border)", marginBottom: 12,
        overflowWrap: "anywhere",
      }}>
        {url}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <QrCodeButton
          primary
          url={url}
          title="Arbeitszeit & Notdienst am Handy — kostenlos"
          hint="Mit der Handykamera scannen"
          fileName="Stundly-QR-Code.png"
        />
        {canShare && (
          <button type="button" className="btn btn-secondary" onClick={share}>📤 Teilen</button>
        )}
        <a
          className="btn btn-secondary"
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none" }}
        >
          💬 WhatsApp
        </a>
        <button type="button" className="btn btn-secondary" onClick={() => void copy()}>
          {copied ? "✓ Kopiert" : "🔗 Link kopieren"}
        </button>
      </div>
    </div>
  );
}
