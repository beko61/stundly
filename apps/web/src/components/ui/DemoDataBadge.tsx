"use client";

import { useEffect, useState } from "react";
import { hasDemoEdits, getDemoEntriesForImport } from "@/app/demo/state";

/**
 * Register + onboarding sayfalarinda gosterilen kucuk rozet:
 * "💾 X Demo-Eintraege werden bei Abschluss uebernommen."
 *
 * Amac: user kayit akisinda "verim kayboldu mu?" panigine girmesin.
 */
export function DemoDataBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!hasDemoEdits()) {
      setCount(0);
      return;
    }
    setCount(getDemoEntriesForImport().length);
  }, []);

  if (count === null || count === 0) return null;

  return (
    <div
      role="status"
      style={{
        background: "linear-gradient(135deg, color-mix(in srgb, var(--green) 12%, transparent), color-mix(in srgb, var(--accent2) 12%, transparent))",
        border: "1px solid color-mix(in srgb, var(--green) 35%, transparent)",
        borderRadius: 10,
        padding: "10px 14px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <span style={{ fontSize: 20, flexShrink: 0 }}>💾</span>
      <div style={{ color: "var(--text)" }}>
        <strong style={{ color: "var(--green)" }}>{count} Demo-Einträge</strong>
        {" "}werden nach der Registrierung übernommen.
      </div>
    </div>
  );
}
