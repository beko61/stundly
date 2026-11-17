"use client";

import { useState } from "react";
import Link from "next/link";
import { FEATURE_INFO, PLUS_BENEFITS, type Feature } from "@/lib/plan/entitlements";
import { PLAN_PRICES, euro } from "@/lib/pricing";
import { startCheckout } from "@/lib/stripe/checkoutClient";

/**
 * Kurze, ruhige Erklärung: was Plus freischaltet und was es kostet. Kein Druck, kein Popup-Spam.
 * Kauf direkt aus der App (Entscheidung 25.10.2026): Basic bleibt nutzbar, niemand muss kaufen.
 */
export function PlusSheet({ feature, onClose, preview }: { feature: Feature; onClose: () => void; preview?: boolean | undefined }) {
  const info = FEATURE_INFO[feature];
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function buy() {
    setBusy(true); setMsg(null);
    const err = await startCheckout("individual", "monthly");
    if (err) { setMsg(err); setBusy(false); }
  }
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12,
    }}>
      <div
        role="dialog" aria-modal="true" aria-labelledby="plus-sheet-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 420, background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 16, padding: "18px 16px calc(16px + env(safe-area-inset-bottom))",
          display: "flex", flexDirection: "column", gap: 10,
        }}
      >
        <div id="plus-sheet-title" style={{ fontSize: 16, fontWeight: 800 }}>🔒 {info.title} — mit Stundly Plus</div>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>{info.text}</p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
          {PLUS_BENEFITS.map((b) => <li key={b}>{b}</li>)}
        </ul>
        <div style={{ fontSize: 13 }}>
          <strong>{euro(PLAN_PRICES.individual.monthly)}</strong>/Monat · monatlich kündbar
          <span style={{ color: "var(--muted)" }}> · Beta-Tester {euro(PLAN_PRICES.individual.beta)}</span>
        </div>
        {preview && (
          <div style={{ fontSize: 11, color: "var(--orange)" }}>Vorschau (Super-Admin): so sieht es ein Basic-Nutzer.</div>
        )}
        {msg && <div role="alert" style={{ fontSize: 12, color: "var(--orange)", lineHeight: 1.5 }}>{msg}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => void buy()} disabled={busy} className="btn btn-primary"
            style={{ flex: 1, cursor: busy ? "wait" : "pointer" }}>
            {busy ? "Weiterleitung…" : "Plus holen"}
          </button>
          <button type="button" onClick={onClose} style={{
            flex: 1, padding: 10, background: "transparent", border: "1px solid var(--border)", borderRadius: 10,
            color: "var(--muted)", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>Später</button>
        </div>
        <Link href="/pricing" style={{ fontSize: 12, color: "var(--muted)", textAlign: "center" }}>Alle Preise vergleichen</Link>
      </div>
    </div>
  );
}

/** Kleines Schloss-Etikett für gesperrte Knöpfe */
export function PlusBadge() {
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 999, marginLeft: 6,
      background: "color-mix(in srgb, var(--accent) 20%, transparent)", color: "var(--accent2)", whiteSpace: "nowrap",
    }}>🔒 Plus</span>
  );
}
