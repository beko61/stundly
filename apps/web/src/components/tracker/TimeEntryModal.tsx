"use client";

import { useState, useMemo } from "react";
import {
  DAY_TYPES,
  DAY_TYPE_LABELS,
  ARBZG_MAX_DAILY_MINUTES,
  ARBZG_RUHEZEIT_MIN_MINUTES,
  calcRuhezeitMinutes,
  isRuhezeitViolation,
} from "@workly/shared";
import type { TimeEntry, DayType } from "@workly/shared";
import { getStandardTimes, getDefaultForDow } from "@/lib/utils/standardTimes";
import { useModalA11y } from "@/hooks/useModalA11y";

/**
 * §4 ArbZG — Pausenregelung. Brutto Arbeitszeit bazlı (konservatif):
 *   >6h → 30 min, >9h → 45 min. Shared `getMinRequiredBreak` netto bekliyor,
 *   burada UX için brutto kullanılıyor (biraz daha erken uyarı verir).
 */
function requiredPauseMinutes(bruttoMinutes: number): number {
  if (bruttoMinutes > 9 * 60) return 45;
  if (bruttoMinutes > 6 * 60) return 30;
  return 0;
}

function calcBruttoMinutes(start: string, end: string, isOvernight: boolean): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (sh === undefined || sm === undefined || eh === undefined || em === undefined) return 0;
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  if (isOvernight || e < s) return 24 * 60 - s + e;
  return e - s;
}

interface Props {
  date: string;
  dayOfWeek: number;
  feiertag?: string | undefined;
  entry?: TimeEntry | null | undefined;
  /** Vortag-Eintrag für §5 ArbZG Ruhezeit-Check (nur ARBEITEN Einträge relevant). */
  previousEntry?: TimeEntry | null | undefined;
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

export function TimeEntryModal({ date, dayOfWeek, feiertag, entry, previousEntry, onCreate, onUpdate, onClose }: Props) {
  const modalRef = useModalA11y<HTMLDivElement>({ onClose });
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

  // §4 ArbZG uyarısı — brutto süreye göre gerekli pause
  const pauseCheck = useMemo(() => {
    if (!needsTime) return null;
    const brutto = calcBruttoMinutes(startTime, endTime, isNightShift);
    const required = requiredPauseMinutes(brutto);
    if (required === 0) return null;
    if (breakMinutes >= required) return null;
    return { required, brutto };
  }, [needsTime, startTime, endTime, isNightShift, breakMinutes]);

  // §3 ArbZG uyarısı — netto (brutto - pause) > 10h ise kırmızı warn
  const dailyCapCheck = useMemo(() => {
    if (!needsTime) return null;
    const brutto = calcBruttoMinutes(startTime, endTime, isNightShift);
    const netto = Math.max(0, brutto - breakMinutes);
    if (netto <= ARBZG_MAX_DAILY_MINUTES) return null;
    return { netto };
  }, [needsTime, startTime, endTime, isNightShift, breakMinutes]);

  // §5 ArbZG Ruhezeit — Vortag end → heute start arası < 11h ise turuncu warn
  const ruhezeitCheck = useMemo(() => {
    if (!needsTime) return null;
    if (!previousEntry) return null;
    if (previousEntry.day_type !== DAY_TYPES.ARBEITEN) return null;
    if (!previousEntry.end_time) return null;
    const ruhezeit = calcRuhezeitMinutes(
      previousEntry.end_time,
      previousEntry.is_night_shift,
      startTime,
    );
    if (!isRuhezeitViolation(ruhezeit)) return null;
    return { ruhezeit };
  }, [needsTime, previousEntry, startTime]);

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
      <div
        ref={modalRef}
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="time-entry-modal-title"
        tabIndex={-1}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 id="time-entry-modal-title" style={{ fontSize: 18, fontWeight: 800 }}>
              {entry ? "Eintrag bearbeiten" : "Eintrag hinzufügen"}
            </h2>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{date}</p>
          </div>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            aria-label="Schließen"
            style={{ padding: "6px 10px" }}
          >✕</button>
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
                <input className="input" type="number" min={0} max={240} inputMode="numeric"
                  value={breakMinutes} onChange={(e) => setBreakMinutes(parseInt(e.target.value, 10) || 0)} />
                {pauseCheck && (
                  <div
                    role="alert"
                    style={{
                      marginTop: 6,
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "color-mix(in srgb, var(--orange, #f59e0b) 12%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--orange, #f59e0b) 35%, transparent)",
                      fontSize: 11,
                      color: "var(--orange, #f59e0b)",
                      lineHeight: 1.4,
                    }}
                  >
                    ⚠️ §4 ArbZG: Bei über {pauseCheck.brutto > 9 * 60 ? "9 h" : "6 h"} Arbeit sind
                    mindestens <strong>{pauseCheck.required} Min. Pause</strong> Pflicht (für Arbeitnehmer).
                  </div>
                )}
                {dailyCapCheck && (
                  <div
                    role="alert"
                    style={{
                      marginTop: 6,
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "color-mix(in srgb, var(--red, #ef4444) 12%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--red, #ef4444) 40%, transparent)",
                      fontSize: 11,
                      color: "var(--red, #ef4444)",
                      lineHeight: 1.4,
                    }}
                  >
                    🚫 §3 ArbZG: Werktägliche Arbeitszeit von <strong>10 h</strong> überschritten
                    ({Math.floor(dailyCapCheck.netto / 60)}h {dailyCapCheck.netto % 60}m netto).
                    Nur zulässig, wenn Ø innerhalb 6 Monaten ≤ 8h/Werktag.
                  </div>
                )}
                {ruhezeitCheck && (
                  <div
                    role="alert"
                    style={{
                      marginTop: 6,
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "color-mix(in srgb, var(--orange, #f59e0b) 12%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--orange, #f59e0b) 35%, transparent)",
                      fontSize: 11,
                      color: "var(--orange, #f59e0b)",
                      lineHeight: 1.4,
                    }}
                  >
                    ⚠️ §5 ArbZG: Nur{" "}
                    <strong>
                      {Math.floor(ruhezeitCheck.ruhezeit / 60)}h {ruhezeitCheck.ruhezeit % 60}m
                    </strong>{" "}
                    Ruhezeit zwischen Vorschicht und Schichtbeginn — mindestens{" "}
                    <strong>{ARBZG_RUHEZEIT_MIN_MINUTES / 60} h</strong> Pflicht (Ausnahmen §5 II).
                  </div>
                )}
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
            <textarea
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Kurze Notiz... (Enter = neue Zeile)"
              rows={2}
              style={{ resize: "vertical", minHeight: 44, fontFamily: "'Syne', sans-serif" }}
            />
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
