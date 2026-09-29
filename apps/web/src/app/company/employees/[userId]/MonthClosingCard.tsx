"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  userId:        string;
  year:          number;
  month:         number;
  monthLabel:    string;
  status:        "submitted" | "approved" | null;
  submittedAt:   string | null;
  approvedAt:    string | null;
  findingsCount: number;
}

const dateDE = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Monatsabschluss: freigeben (sperrt den Monat für den Mitarbeiter) oder wieder öffnen. */
export function MonthClosingCard({ userId, year, month, monthLabel, status, submittedAt, approvedAt, findingsCount }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(action: "approve" | "reopen") {
    if (action === "approve" && findingsCount > 0 &&
        !confirm(`${findingsCount} Auffälligkeit${findingsCount === 1 ? "" : "en"} in ${monthLabel}. Trotzdem freigeben?`)) return;
    if (action === "reopen" && !confirm(`${monthLabel} wieder öffnen? Der Mitarbeiter kann dann wieder ändern.`)) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/company/month-closings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, year, month, action }),
      });
      const json = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setError(json.error ?? "Fehlgeschlagen"); return; }
      router.refresh();
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setBusy(false);
    }
  }

  const color = status === "approved" ? "var(--green)" : status === "submitted" ? "var(--accent2)" : "var(--muted)";
  return (
    <div className="card" style={{
      padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
      background: `color-mix(in srgb, ${color} 7%, var(--surface))`,
    }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color }}>
          {status === "approved" ? `🔒 ${monthLabel} freigegeben` : status === "submitted" ? `📤 ${monthLabel} eingereicht` : `${monthLabel} noch nicht eingereicht`}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
          {status === "approved"
            ? `Am ${approvedAt ? dateDE(approvedAt) : "–"} · Mitarbeiter kann nicht mehr ändern, Korrekturen nur durch dich.`
            : status === "submitted"
              ? `Am ${submittedAt ? dateDE(submittedAt) : "–"} · ${findingsCount ? `${findingsCount} Auffälligkeit${findingsCount === 1 ? "" : "en"} prüfen` : "keine Auffälligkeiten"}`
              : "Du kannst trotzdem freigeben, wenn alles stimmt."}
        </div>
        {error && <div role="alert" style={{ fontSize: 12, color: "var(--red)", marginTop: 4 }}>⚠️ {error}</div>}
      </div>
      {status === "approved" ? (
        <button type="button" className="btn" onClick={() => void send("reopen")} disabled={busy} style={{ fontSize: 13 }}>
          {busy ? "…" : "Wieder öffnen"}
        </button>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => void send("approve")} disabled={busy} style={{ fontSize: 13 }}>
          {busy ? "…" : "✓ Monat freigeben"}
        </button>
      )}
    </div>
  );
}
