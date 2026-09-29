"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  userId: string;
  date:   string;
  entry:  { day_type: string | null; start_time: string | null; end_time: string | null; break_minutes: number | null } | null;
}

const TYPES = [
  { v: "arbeiten", l: "Arbeit" }, { v: "urlaub", l: "Urlaub" }, { v: "krank", l: "Krank" },
  { v: "feiertag", l: "Feiertag" }, { v: "frei", l: "Frei" }, { v: "__delete", l: "Eintrag löschen" },
];

/**
 * ✎ in der Tagestabelle → Korrektur mit Pflicht-Begründung. Der Mitarbeiter sieht
 * Vorher/Nachher + Grund in seiner App.
 */
export function CorrectionButton({ userId, date, entry }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(entry?.day_type ?? "arbeiten");
  const [start, setStart] = useState(entry?.start_time?.slice(0, 5) ?? "07:00");
  const [end, setEnd] = useState(entry?.end_time?.slice(0, 5) ?? "16:00");
  const [pause, setPause] = useState(String(entry?.break_minutes ?? 30));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [, m, d] = date.split("-");

  async function save() {
    if (reason.trim().length < 3) { setError("Bitte einen Grund angeben (mind. 3 Zeichen)."); return; }
    if (type === "arbeiten" && (!start || !end || start === end)) { setError("Beginn und Ende angeben."); return; }
    if (type === "__delete" && !entry) { setError("Es gibt keinen Eintrag zum Löschen."); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/company/corrections", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId, date, reason: reason.trim(),
          entry: type === "__delete" ? null : {
            day_type: type,
            start_time: type === "arbeiten" ? start : null,
            end_time: type === "arbeiten" ? end : null,
            break_minutes: type === "arbeiten" ? Math.max(0, parseInt(pause, 10) || 0) : 0,
          },
        }),
      });
      const json = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setError(json.error ?? "Speichern fehlgeschlagen"); return; }
      setOpen(false); setReason("");
      router.refresh();
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`${d}.${m}. korrigieren`} title="Korrigieren"
        style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--muted)", cursor: "pointer", padding: "4px 9px", fontSize: 13 }}>
        ✎
      </button>
      {open && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && !busy && setOpen(false)}>
          <div className="modal-sheet" role="dialog" aria-modal="true" aria-labelledby={`corr-${date}`} style={{ maxWidth: 440 }}>
            <h2 id={`corr-${date}`} style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{d}.{m}. korrigieren</h2>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14, lineHeight: 1.5 }}>
              Der Mitarbeiter sieht die Änderung und deinen Grund in seiner App.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label className="label" htmlFor={`ct-${date}`}>Status</label>
                <select id={`ct-${date}`} className="input" value={type} onChange={(e) => setType(e.target.value)}>
                  {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>
              {type === "arbeiten" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div><label className="label">Beginn</label><input className="input" type="time" aria-label="Beginn" value={start} onChange={(e) => setStart(e.target.value)} /></div>
                  <div><label className="label">Ende</label><input className="input" type="time" aria-label="Ende" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
                  <div><label className="label">Pause (min)</label><input className="input" inputMode="numeric" aria-label="Pause" value={pause} onChange={(e) => setPause(e.target.value.replace(/\D/g, ""))} /></div>
                </div>
              )}
              <div>
                <label className="label" htmlFor={`cr-${date}`}>Grund (Pflicht)</label>
                <input id={`cr-${date}`} className="input" value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="z. B. Pause vergessen" maxLength={500} />
              </div>
              {error && <div role="alert" style={{ fontSize: 12, color: "var(--red)" }}>⚠️ {error}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setOpen(false)} disabled={busy}>Abbrechen</button>
                <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => void save()} disabled={busy}>
                  {busy ? "Speichert…" : "Korrektur speichern"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
