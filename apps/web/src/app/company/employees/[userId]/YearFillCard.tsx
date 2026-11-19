"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Chef: Jahr eines Mitarbeiters mit seinen Standardzeiten füllen (ab heute, nichts wird überschrieben). */
export function YearFillCard({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear + 1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function fill() {
    if (!window.confirm(
      `${year} für ${name} mit den Standardzeiten füllen?\n\n` +
      `Mo–Fr ab heute, ohne Feiertage und Urlaub. Vorhandene Einträge bleiben unverändert. ` +
      `Die Tage sind als „automatisch“ markiert und können jederzeit geändert werden.`,
    )) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/company/employees/${userId}/year-fill`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year }),
      });
      const json = await res.json().catch(() => ({})) as { error?: string; inserted?: number };
      if (!res.ok) { setMsg({ ok: false, text: json.error ?? "Fehlgeschlagen" }); return; }
      setMsg({
        ok: true,
        text: json.inserted ? `✅ ${json.inserted} Tage in ${year} eingetragen.` : `${year} ist schon komplett gefüllt.`,
      });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Netzwerkfehler" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 24 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>⚡ Jahr mit Standardzeiten füllen</div>
      <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5, margin: "0 0 12px" }}>
        Trägt alle freien Werktage ab heute mit den Standardzeiten des Mitarbeiters ein
        (ohne Feiertage und Urlaub). Bestehende Einträge werden nicht überschrieben.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select className="input" aria-label="Jahr" value={year} onChange={(e) => setYear(Number(e.target.value))}
          style={{ width: 110 }}>
          <option value={thisYear}>{thisYear}</option>
          <option value={thisYear + 1}>{thisYear + 1}</option>
        </select>
        <button type="button" className="btn btn-primary" onClick={() => void fill()} disabled={busy}
          style={{ flex: 1, minWidth: 160 }}>
          {busy ? "Wird eingetragen…" : `${year} füllen`}
        </button>
      </div>
      {msg && (
        <div role={msg.ok ? "status" : "alert"} style={{ marginTop: 10, fontSize: 12, color: msg.ok ? "var(--green)" : "var(--red)" }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
