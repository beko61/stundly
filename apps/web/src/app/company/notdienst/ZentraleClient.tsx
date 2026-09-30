"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { autoDistribute, einsaetzeCsv, type CsvEinsatz } from "@/lib/company/notdienstZentrale";
import { downloadFile } from "@/lib/share/shareFile";

const dateDE = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
const euro = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

/* ── Pauschale ─────────────────────────────────────────────────────────── */

export function PauschaleCard({ value, count, offen, supported }: { value: number | null; count: number; offen: number; supported: boolean }) {
  const router = useRouter();
  const [input, setInput] = useState(value != null ? String(value).replace(".", ",") : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    const t = input.trim();
    const v = t ? Number(t.replace(",", ".")) : null;
    if (v != null && (!Number.isFinite(v) || v < 0 || v > 10000)) { setMsg({ ok: false, text: "Betrag zwischen 0 und 10.000 €" }); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/company/settings", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notdienst_pauschale: v }),
      });
      const json = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setMsg({ ok: false, text: json.error ?? "Speichern fehlgeschlagen" }); return; }
      setMsg({ ok: true, text: "Gespeichert" });
      router.refresh();
    } catch { setMsg({ ok: false, text: "Netzwerkfehler" }); } finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ padding: "16px 18px" }}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>💶 Pauschale pro Einsatz</div>
      {!supported ? (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>In Kürze verfügbar.</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input className="input" inputMode="decimal" aria-label="Pauschale in Euro" placeholder="z. B. 80"
              value={input} onChange={(e) => setInput(e.target.value)} style={{ maxWidth: 140 }} />
            <span style={{ color: "var(--muted)", fontSize: 13 }}>€</span>
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy} style={{ fontSize: 13 }}>
              {busy ? "…" : "Speichern"}
            </button>
          </div>
          {msg && <div role={msg.ok ? "status" : "alert"} style={{ fontSize: 12, marginTop: 6, color: msg.ok ? "var(--green)" : "var(--red)" }}>{msg.text}</div>}
          {value != null && (
            <div style={{ fontSize: 13, marginTop: 12, display: "grid", gridTemplateColumns: "1fr auto", gap: 4 }}>
              <span style={{ color: "var(--muted)" }}>Diesen Monat · {count} Einsätze</span><strong>{euro(count * value)}</strong>
              <span style={{ color: "var(--muted)" }}>davon noch offen · {offen}</span>
              <strong style={{ color: offen ? "var(--orange)" : "var(--green)" }}>{euro(offen * value)}</strong>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Rufbereitschafts-Plan ─────────────────────────────────────────────── */

interface RotaProps {
  weeks:     string[];                                  // Montage
  current:   string;                                    // Montag dieser Woche
  employees: { user_id: string; name: string }[];
  rota:      Record<string, string | undefined>;        // week_start → user_id
  previous?: string | undefined;                        // Einteilung der Woche vor dem Zeitraum
  supported: boolean;
}

export function RotaCard({ weeks, current, employees, rota, previous, supported }: RotaProps) {
  const router = useRouter();
  const [plan, setPlan] = useState(rota);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nameOf = (uid?: string) => employees.find((e) => e.user_id === uid)?.name ?? "—";

  async function send(assignments: { week_start: string; user_id: string | null }[], key: string) {
    setBusy(key); setError(null);
    try {
      const res = await fetch("/api/company/notdienst-rota", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignments }),
      });
      const json = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setError(json.error ?? "Speichern fehlgeschlagen"); return false; }
      setPlan((p) => {
        const n = { ...p };
        for (const a of assignments) n[a.week_start] = a.user_id ?? undefined;
        return n;
      });
      router.refresh();
      return true;
    } catch { setError("Netzwerkfehler"); return false; } finally { setBusy(null); }
  }

  const free = weeks.filter((w) => w >= current && !plan[w]).length;

  if (!supported) {
    return <div className="card" style={{ padding: "16px 18px", fontSize: 12, color: "var(--muted)" }}>📅 Rufbereitschafts-Plan in Kürze verfügbar.</div>;
  }

  return (
    <div className="card" style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 800, fontSize: 14, flex: 1 }}>📅 Rufbereitschaft</div>
        {free > 0 && employees.length > 0 && (
          <button type="button" className="btn" style={{ fontSize: 12 }} disabled={busy !== null}
            onClick={() => void send(autoDistribute(weeks.filter((w) => w >= current), employees.map((e) => e.user_id), plan, previous), "auto")}>
            {busy === "auto" ? "…" : `⟳ ${free} freie Wochen reihum verteilen`}
          </button>
        )}
      </div>
      {error && <div role="alert" style={{ fontSize: 12, color: "var(--red)", marginBottom: 8 }}>⚠️ {error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {weeks.map((w) => {
          const isNow = w === current;
          const past = w < current;
          return (
            <div key={w} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10,
              background: isNow ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "var(--surface2)",
              border: `1px solid ${isNow ? "color-mix(in srgb, var(--accent) 40%, transparent)" : "var(--border)"}`,
              opacity: past ? 0.6 : 1,
            }}>
              <div style={{ minWidth: 118, fontSize: 12 }}>
                <div style={{ fontWeight: 800 }}>{isNow ? "Diese Woche" : past ? "Letzte Woche" : `ab ${dateDE(w)}`}</div>
                <div style={{ color: "var(--muted)" }}>{dateDE(w)} – {dateDE(addDaysLocal(w, 6))}</div>
              </div>
              {past ? (
                <span style={{ fontSize: 13, fontWeight: 700 }}>{nameOf(plan[w])}</span>
              ) : (
                <select className="input" aria-label={`Rufbereitschaft ab ${dateDE(w)}`} value={plan[w] ?? ""}
                  disabled={busy !== null}
                  onChange={(e) => void send([{ week_start: w, user_id: e.target.value || null }], w)}
                  style={{ flex: 1, minWidth: 0, padding: "8px 10px" }}>
                  <option value="">— niemand —</option>
                  {employees.map((e) => <option key={e.user_id} value={e.user_id}>{e.name}</option>)}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function addDaysLocal(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days));
  return dt.toISOString().slice(0, 10);
}

/* ── CSV "Einsätze abrechnen" ──────────────────────────────────────────── */

export function CsvButton({ rows, pauschale, fileName }: { rows: CsvEinsatz[]; pauschale: number | null; fileName: string }) {
  return (
    <button type="button" className="btn" style={{ fontSize: 13 }} disabled={rows.length === 0}
      onClick={() => downloadFile(new File([einsaetzeCsv(rows, pauschale)], fileName, { type: "text/csv;charset=utf-8" }))}>
      📥 Einsätze abrechnen (CSV)
    </button>
  );
}
