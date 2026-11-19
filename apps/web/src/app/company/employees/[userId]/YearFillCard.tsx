"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WEEKDAYS, type DayTimes, type WeekPlan } from "@/lib/utils/yearFill";
import { calendarYears } from "@/lib/utils/years";

type Dow = 1 | 2 | 3 | 4 | 5 | 6;
interface Row { on: boolean; start: string; end: string; pause: string }

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const FALLBACK: DayTimes = { start: "07:00", end: "12:00", pause: 0 };

/**
 * Chef: Jahr eines Mitarbeiters füllen. Zeiten je Wochentag Mo–Sa (vorgeschlagen: Standardzeiten
 * des Mitarbeiters, Samstag frei). Ab heute, ohne Feiertage/Urlaub, nichts wird überschrieben.
 */
export function YearFillCard({ userId, name, suggested }: { userId: string; name: string; suggested: WeekPlan }) {
  const router = useRouter();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear + 1);
  const [rows, setRows] = useState<Record<Dow, Row>>(() => {
    const r = {} as Record<Dow, Row>;
    for (const { dow } of WEEKDAYS) {
      const t = suggested[dow];
      const v = t ?? FALLBACK;
      r[dow] = { on: !!t, start: v.start, end: v.end, pause: String(v.pause) };
    }
    return r;
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (dow: Dow, patch: Partial<Row>) => setRows((p) => ({ ...p, [dow]: { ...p[dow], ...patch } }));

  function buildWeek(): { week: Record<Dow, DayTimes | null> } | { error: string } {
    const week = {} as Record<Dow, DayTimes | null>;
    for (const { dow, label } of WEEKDAYS) {
      const r = rows[dow];
      if (!r.on) { week[dow] = null; continue; }
      const pause = parseInt(r.pause, 10) || 0;
      if (!r.start || !r.end || toMin(r.end) - toMin(r.start) <= pause) {
        return { error: `${label}: Ende muss nach Beginn liegen (inkl. Pause).` };
      }
      week[dow] = { start: r.start, end: r.end, pause };
    }
    if (!Object.values(week).some(Boolean)) return { error: "Mindestens einen Arbeitstag auswählen." };
    return { week };
  }

  async function fill() {
    const b = buildWeek();
    if ("error" in b) { setMsg({ ok: false, text: b.error }); return; }
    const days = WEEKDAYS.filter(({ dow }) => b.week[dow]).map(({ label }) => label).join(", ");
    if (!window.confirm(
      `${year} für ${name} füllen (${days})?\n\n` +
      `Ab heute, ohne Feiertage und Urlaub. Schon automatisch gefüllte Tage bekommen die neuen Zeiten, ` +
      `selbst eingetragene Tage bleiben unverändert.`,
    )) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/company/employees/${userId}/year-fill`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year, week: b.week }),
      });
      const json = await res.json().catch(() => ({})) as { error?: string; inserted?: number; updated?: number; removed?: number };
      if (!res.ok) { setMsg({ ok: false, text: json.error ?? "Fehlgeschlagen" }); return; }
      const n = json.inserted ?? 0, u = json.updated ?? 0, r = json.removed ?? 0;
      const parts = [
        n ? `${n} Tage neu eingetragen` : "",
        u ? `${u} automatisch gefüllte Tage aktualisiert` : "",
        r ? `${r} Tage an abgewählten Wochentagen entfernt` : "",
      ].filter(Boolean);
      setMsg({
        ok: true,
        text: parts.length
          ? `✅ ${year}: ${parts.join(", ")}.`
          : `${year}: keine freien Tage (alles selbst eingetragen, Urlaub oder Feiertag).`,
      });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Netzwerkfehler" });
    } finally {
      setBusy(false);
    }
  }

  async function removeYear() {
    if (!window.confirm(
      `Alle automatisch gefüllten Tage in ${year} für ${name} löschen (ab heute)?\n\n` +
      `Selbst eingetragene Tage bleiben erhalten.`,
    )) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/company/employees/${userId}/year-fill?year=${year}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({})) as { error?: string; removed?: number };
      if (!res.ok) { setMsg({ ok: false, text: json.error ?? "Fehlgeschlagen" }); return; }
      setMsg({
        ok: true,
        text: json.removed ? `🗑 ${json.removed} automatisch gefüllte Tage in ${year} gelöscht.` : `${year}: keine automatisch gefüllten Tage.`,
      });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Netzwerkfehler" });
    } finally {
      setBusy(false);
    }
  }

  const cell = { padding: "6px 8px", fontSize: 13, minWidth: 0 } as const;

  return (
    <div className="card" style={{ padding: 16, marginBottom: 24 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>⚡ Jahr mit festen Zeiten füllen</div>
      <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5, margin: "0 0 12px" }}>
        Trägt alle freien Tage ab heute mit diesen Zeiten ein (ohne Feiertage und Urlaub).
        Schon automatisch gefüllte Tage werden aktualisiert (abgewählte Tage entfernt), selbst eingetragene bleiben.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "52px 1fr 1fr 64px", gap: 6, alignItems: "center", marginBottom: 12 }}>
        <span />
        <span style={{ fontSize: 11, color: "var(--muted)" }}>Beginn</span>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>Ende</span>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>Pause</span>
        {WEEKDAYS.map(({ dow, label }) => {
          const r = rows[dow];
          return (
            <div key={dow} style={{ display: "contents" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                <input type="checkbox" checked={r.on} onChange={(e) => set(dow, { on: e.target.checked })}
                  aria-label={`${label} arbeitet`} style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
                {label}
              </label>
              <input className="input" type="time" aria-label={`${label} Beginn`} value={r.start} disabled={!r.on}
                onChange={(e) => set(dow, { start: e.target.value })} style={{ ...cell, opacity: r.on ? 1 : 0.4 }} />
              <input className="input" type="time" aria-label={`${label} Ende`} value={r.end} disabled={!r.on}
                onChange={(e) => set(dow, { end: e.target.value })} style={{ ...cell, opacity: r.on ? 1 : 0.4 }} />
              <input className="input" type="number" inputMode="numeric" min={0} max={240} aria-label={`${label} Pause in Minuten`}
                value={r.pause} disabled={!r.on} onChange={(e) => set(dow, { pause: e.target.value })}
                style={{ ...cell, opacity: r.on ? 1 : 0.4 }} />
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 12px" }}>Pause in Minuten. Sonntag bleibt immer frei.</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select className="input" aria-label="Jahr" value={year} onChange={(e) => setYear(Number(e.target.value))}
          style={{ width: 110 }}>
          {calendarYears(thisYear).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button type="button" className="btn btn-primary" onClick={() => void fill()} disabled={busy}
          style={{ flex: 1, minWidth: 160 }}>
          {busy ? "Bitte warten…" : `${year} füllen`}
        </button>
      </div>
      <button type="button" onClick={() => void removeYear()} disabled={busy}
        style={{
          width: "100%", marginTop: 8, padding: 10, background: "transparent", borderRadius: 10, cursor: "pointer",
          border: "1px solid color-mix(in srgb, var(--red) 40%, transparent)", color: "var(--red)", fontSize: 13, fontWeight: 700,
        }}>
        🗑 Automatisch gefüllte Tage in {year} löschen
      </button>
      {msg && (
        <div role={msg.ok ? "status" : "alert"} style={{ marginTop: 10, fontSize: 12, color: msg.ok ? "var(--green)" : "var(--red)" }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
