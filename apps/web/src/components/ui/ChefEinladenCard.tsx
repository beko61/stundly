"use client";

import { useState } from "react";
import { useSessionUserId } from "@/hooks/useSessionUserId";
import { useCompanyMembership } from "@/hooks/queries/useCompanyMembership";
import { chefInviteText, chefInviteUrl } from "@/lib/marketing/referral";
import { QrCodeButton } from "./QrCodeButton";

/**
 * "Chef einladen" — nur für Nutzer ohne Firma. Link auf /firma?ref=<code>
 * (Landingpage für Betriebe). Eigenständig, berührt das Einladungssystem nicht.
 */
export function ChefEinladenCard() {
  const userId = useSessionUserId();
  const membership = useCompanyMembership();
  const [copied, setCopied] = useState(false);

  if (!userId || !membership.data || membership.data.hasCompany) return null;
  const url = chefInviteUrl(userId);
  const text = chefInviteText(userId);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Text kopieren:", text);
    }
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>🏢 Nutzt deine Firma schon Stundly?</h2>
      <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 12 }}>
        Dein Chef bekommt deine Monatsstunden und Notdienste fertig — ohne Zettel abtippen.
        Deine bisherigen Einträge bleiben deine.
      </p>
      <div style={{
        fontSize: 12, padding: "10px 12px", borderRadius: 10, background: "var(--surface2)",
        border: "1px solid var(--border)", marginBottom: 12, color: "var(--muted)", lineHeight: 1.5, overflowWrap: "anywhere",
      }}>
        „{text}“
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a className="btn btn-primary" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
          💬 Per WhatsApp senden
        </a>
        <QrCodeButton
          url={url}
          title="Stundenzettel ohne Abtippen — für deinen Betrieb"
          hint="Chef, scann mich mit der Handykamera"
          fileName="Stundly-Chef-QR-Code.png"
        />
        <button type="button" className="btn btn-secondary" onClick={() => void copy()}>
          {copied ? "✓ Kopiert" : "📋 Text kopieren"}
        </button>
        <a className="btn btn-secondary" href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
          Seite ansehen
        </a>
      </div>
    </div>
  );
}
