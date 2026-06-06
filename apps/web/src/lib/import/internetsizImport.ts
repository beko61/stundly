/**
 * Internetsiz HTML (alter App) → Stundly veri import dönüştürme
 *
 * Beklenen JSON format (internetsiz exportData):
 * {
 *   "userData": { "2026-01-15": { "status": "Arbeiten", "start": "07:45", "end": "17:00", "pause": "01:00", "hours": "08:15" }, ... },
 *   "userTimes": { ... },
 *   "userNotes": { "2026-01-15": "Notiz..." },
 *   "userNotdienst": { "2026-01-15": [{ "start": "18:00", "end": "22:00", "hours": "04:00", "note": "...", "erledigt": true }, ...] },
 *   "exportDate": "2026-..."
 * }
 *
 * Stundly Tabellen:
 *   time_entries:      date, day_type, start_time, end_time, break_minutes, is_night_shift, note
 *   notdienst_entries: date, start_time, end_time, kunde, note, erledigt
 */

import type { DayType } from "@workly/shared";

// ───────────────────────────────────────────────────────────────
// Tipler
// ───────────────────────────────────────────────────────────────

export interface InternetsizDay {
  status?: string;
  start?:  string;
  end?:    string;
  pause?:  string;
  hours?:  string;
}

export interface InternetsizNd {
  start?:    string;
  end?:      string;
  hours?:    string;
  /** Old format: "Kunde — Adresse" combined with em-dash */
  note?:     string;
  /** Newer format: separate kunde field (rarely used) */
  kunde?:    string;
  problem?:  string;
  ergebnis?: string;
  erledigt?: boolean;
}

export interface InternetsizExport {
  userData?:      Record<string, InternetsizDay>;
  userNotdienst?: Record<string, InternetsizNd | InternetsizNd[]>;
  userNotes?:     Record<string, string>;
  userTimes?:     Record<string, unknown>;
  exportDate?:    string;
}

export interface StundlyTimeEntryInsert {
  date:           string;
  day_type:       DayType;
  start_time:     string | null;
  end_time:       string | null;
  break_minutes:  number;
  is_night_shift: boolean;
  note:           string | null;
  tags:           string[];
}

export interface StundlyNotdienstInsert {
  date:        string;
  start_time:  string;
  end_time:    string;
  kunde:       string | null;
  adresse:     string | null;
  note:        string | null;
  problem:     string | null;
  ergebnis:    string | null;
  erledigt:    boolean;
}

export interface ImportPreview {
  format:       "internetsiz" | "unknown";
  totalDays:    number;
  byDayType:    Record<DayType, number>;
  totalNd:      number;
  earliestDate: string | null;
  latestDate:   string | null;
}

export interface ImportPayload {
  timeEntries:    StundlyTimeEntryInsert[];
  notdienst:      StundlyNotdienstInsert[];
  preview:        ImportPreview;
}

// ───────────────────────────────────────────────────────────────
// Yardımcılar
// ───────────────────────────────────────────────────────────────

function timeToMins(t?: string | null): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map((x) => Number(x));
  return (h || 0) * 60 + (m || 0);
}

function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

const STATUS_MAP: Record<string, DayType> = {
  "arbeiten":  "arbeiten",
  "urlaub":    "urlaub",
  "krank":     "krank",
  "feiertag":  "feiertag",
  "frei":      "frei",
  "notdienst": "notdienst",
  // Almanca büyük harf varyasyonları
  "Arbeiten":  "arbeiten",
  "Urlaub":    "urlaub",
  "Krank":     "krank",
  "Feiertag":  "feiertag",
  "Frei":      "frei",
  "Notdienst": "notdienst",
  // Boş/Wochenende → frei
  "":          "frei",
  "Wochenende":"frei",
};

// ───────────────────────────────────────────────────────────────
// Format detect + parse
// ───────────────────────────────────────────────────────────────

export function detectFormat(parsed: unknown): "internetsiz" | "unknown" {
  if (typeof parsed !== "object" || parsed === null) return "unknown";
  const p = parsed as Record<string, unknown>;
  // Internetsiz HTML signature: userData, optional userNotdienst/userNotes, exportDate
  if ("userData" in p && typeof p.userData === "object") return "internetsiz";
  return "unknown";
}

export function parseInternetsizExport(raw: string): ImportPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Datei ist kein gültiges JSON.");
  }
  const format = detectFormat(parsed);
  if (format !== "internetsiz") {
    throw new Error("Format wird nicht erkannt — erwartet wird eine Sicherung aus der alten App (userData-Feld).");
  }

  const data = parsed as InternetsizExport;
  const timeEntries: StundlyTimeEntryInsert[] = [];
  const notdienst:   StundlyNotdienstInsert[] = [];

  // ── time_entries (userData) ──
  for (const [date, day] of Object.entries(data.userData ?? {})) {
    if (!isValidDate(date)) continue;
    const status = day?.status ?? "";
    const dayType = STATUS_MAP[status] ?? "frei";
    const note = data.userNotes?.[date] ?? null;

    const entry: StundlyTimeEntryInsert = {
      date,
      day_type:       dayType,
      start_time:     null,
      end_time:       null,
      break_minutes:  0,
      is_night_shift: false,
      note:           note && note.trim() ? note : null,
      tags:           [],
    };

    if (dayType === "arbeiten" && day?.start && day.end) {
      entry.start_time    = day.start;
      entry.end_time      = day.end;
      entry.break_minutes = timeToMins(day.pause);
      // Night shift detect: end < start = overnight
      entry.is_night_shift = timeToMins(day.end) < timeToMins(day.start);
    }

    timeEntries.push(entry);
  }

  // ── notdienst_entries (userNotdienst) ──
  // Internetsiz HTML format: nd.note = "Kunde — Adresse" (em-dash separator)
  // We split this back into separate kunde + adresse fields for Stundly schema.
  for (const [date, raw] of Object.entries(data.userNotdienst ?? {})) {
    if (!isValidDate(date)) continue;
    const arr = Array.isArray(raw) ? raw : [raw];
    for (const nd of arr) {
      if (!nd?.start || !nd?.end) continue;

      // Split note "Kunde — Adresse" → kunde + adresse
      let kunde:   string | null = nd.kunde?.trim() || null;
      let adresse: string | null = null;
      let plainNote: string | null = null;

      const noteStr = (nd.note || "").trim();
      if (noteStr) {
        // Try multiple separators (em-dash variants used by internetsiz HTML)
        const seps = [" — ", " – ", " - "];
        let split: string[] | null = null;
        for (const sep of seps) {
          const idx = noteStr.indexOf(sep);
          if (idx > 0) {
            split = [noteStr.substring(0, idx).trim(), noteStr.substring(idx + sep.length).trim()];
            break;
          }
        }
        if (split && split.length === 2 && split[0] && split[1]) {
          if (!kunde) kunde = split[0]!;
          adresse = split[1]!;
        } else {
          // No separator → entire note goes to kunde (if empty) or note field
          if (!kunde) kunde = noteStr;
          else plainNote = noteStr;
        }
      }

      notdienst.push({
        date,
        start_time: nd.start,
        end_time:   nd.end,
        kunde,
        adresse,
        note:       plainNote,
        problem:    nd.problem?.trim() || null,
        ergebnis:   nd.ergebnis?.trim() || null,
        erledigt:   Boolean(nd.erledigt),
      });
    }
  }

  // ── Preview ──
  const byDayType: Record<DayType, number> = {
    arbeiten: 0, urlaub: 0, krank: 0, notdienst: 0, feiertag: 0, frei: 0,
  };
  let earliest: string | null = null;
  let latest:   string | null = null;
  for (const e of timeEntries) {
    byDayType[e.day_type]++;
    if (!earliest || e.date < earliest) earliest = e.date;
    if (!latest   || e.date > latest)   latest = e.date;
  }

  return {
    timeEntries,
    notdienst,
    preview: {
      format,
      totalDays:    timeEntries.length,
      byDayType,
      totalNd:      notdienst.length,
      earliestDate: earliest,
      latestDate:   latest,
    },
  };
}
