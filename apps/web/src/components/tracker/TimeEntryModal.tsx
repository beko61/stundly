"use client";

import { useState } from "react";
import { DAY_TYPES, DAY_TYPE_LABELS } from "@workly/shared";
import type { TimeEntry, DayType } from "@workly/shared";
import { getStandardTimes, getDefaultForDow } from "@/lib/utils/standardTimes";

interface Props {
  date: string;
  dayOfWeek: number;
  feiertag?: string | undefined;
  entry?: TimeEntry | null | undefined;
  onCreate: (entry: Omit<TimeEntry, "id" | "user_id" | "created_at" | "updated_at" | "synced_at">) => Promise<{ error: string | null } | undefined>;
  onUpdate: (id: string, patch: Partial<TimeEntry>) => Promise<{ error: string | null }>;
  onClose: () => void;
}

// Wählbare Tagestypen: Arbeiten / Urlaub / Krank / Notdienst / Feiertag
// 'Frei' ist absichtlich ausgeblendet — leere Tage sind automatisch frei,
// daraus muss kein DB-Eintrag erstellt werden.
const DAY_TYPE_OPTIONS = (Object.entries(DAY_TYPE_LABELS) as [DayType, string][])
  .filter(([value]) => value !== DAY_TYPES.FREI);

/**
 * Default Zeitwerte für ein neues Eintrag.
 *
 * - Bestehende Einträge → vorhandene Werte beibehalten.
 * - Neue Einträge → aus Standardzeiten (Settings → Standardzeiten),
 *   abhängig vom Wochentag.
 * - Sa/So: kein Default — fallback auf Mo-Do Werte (Nutzer kann editieren).
 */
function getDefaults(dayOfWeek: number, existing?: TimeEntry | null, feiertag?: string) {
  if (existing) {
    return {
      dayType:      existing.day_type,
      startTime:    existing.start_time  ?? "08:00",
      endTime:      existing.end_time    ?? "17:00",
      breakMinutes: existing.break_minutes,
      isNightShift: existing.is_night_shift,
      note:         existing.note ?? "",
    };
  }

  const std    = getStandardTimes();
  const dayStd = getDefaultForDow(dayOfWeek, std);
  // Sa/So için fallback: Mo-Do
  const fallback = { start: std.monThuStart, end: std.monThuEnd, pause: std.monThuPause };
  const { start, end, pause } = dayStd ?? fallback;

  return {
    dayType:      feiertag ? DAY_TYPES.FEIERTAG : DAY_TYPES.ARBEITEN as DayType,
    startTime:    start,
    endTime:      end,
    breakMinutes: pause,
    isNightShift: false,
    note:         "",
  };
}

export function TimeEntryModal({ date, dayOfWeek, feiertag, entry, onCreate, onUpdate, onClose }: Props) {
  const defaults = getDefaults(dayOfWeek, entry, feiertag);

  const [dayType,      setDayType]      = useState<DayType>(defaults.dayType);
  const [startTime,    setStartTime]    = useState(defaults.startTime);
  const [endTime,      setEndTime]      = useState(defaults.endTime);
  const [breakMinutes, setBreakMinutes] = useState(defaults.breakMinutes);
  const [isNightShift, setIsNightShift] = useState(defaults.isNightShift);
  const [note,         setNote]         = useState(defaults.note);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const needsTime  = dayType === DAY_TYPES.ARBEITEN || dayType === DAY_TYPES.NOTDIENST;

  async function handleSave() {
    setSaving(true);
    setError(null);

    // Urlaub/Krank/Feiertag: keine Zeiten in DB (Sollstunden = 8h flat Mo-Fr)
    const payload = {
      date,
      day_type:       dayType,
      start_time:     needsTime ? startTime : null,
      end_time:       needsTime ? endTime   : null,
      break_minutes:  needsTime ? breakMinutes : 0,
      is_night_shift: isNightShift,
      note:           note || null,
      tags:           [] as string[],
    };

    const result = entry
      ? await onUpdate(entry.id, payload)
      : await onCreate(payload);

    if (result?.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>
              {entry ? "Eintrag bearbeiten" : "Eintrag hinzufügen"}
            </h2>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{date}</p>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: "6px 10px" }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Day type */}
          <div>
            <label className="label">Typ</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {DAY_TYPE_OPTIONS.map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setDayType(value)}
                  style={{
                    padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                    border:      `1px solid ${dayType === value ? "var(--accent)" : "var(--border)"}`,
                    background:  dayType === value ? "color-mix(in srgb, var(--accent) 20%, transparent)" : "var(--surface2)",
                    color:       dayType === value ? "var(--accent2)" : "var(--muted)",
                    fontFamily: "'Syne', sans-serif", fontSize: 12, fontWeight: 700,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Time inputs */}
          {needsTime && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="label">Beginn</label>
                  <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div>
                  <label className="label">Ende</label>
                  <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="label">Pause (Minuten)</label>
                <input className="input" type="number" min={0} max={240}
                  value={breakMinutes} onChange={(e) => setBreakMinutes(parseInt(e.target.value, 10) || 0)} />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={isNightShift} onChange={(e) => setIsNightShift(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
                <span style={{ fontSize: 13 }}>Nachtschicht</span>
              </label>
            </>
          )}

          <div>
            <label className="label">Notiz (optional)</label>
            <input className="input" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kurze Notiz..." />
          </div>

          {error && (
            <p style={{ color: "var(--red)", fontSize: 13, background: "color-mix(in srgb, var(--red) 10%, transparent)", padding: "10px 12px", borderRadius: 8 }}>
              {error}
            </p>
          )}

          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ width: "100%" }}>
            {saving ? "Speichern..." : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
