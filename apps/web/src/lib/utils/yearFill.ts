import type { StandardTimes } from "./standardTimes";
import { AUTOFILL_TAG } from "@/lib/company/monthCheck";

/**
 * Jahres-Befüllung — eine Stelle für Mitarbeiter-Einstellungen (AutoFillReports) und
 * Firma (Chef füllt das Jahr eines Mitarbeiters, /api/company/employees/[userId]/year-fill).
 * Wochenplan je Wochentag (1 = Mo … 6 = Sa; Sonntag nie); Feiertage und alles, was `skip` meldet, bleiben leer.
 * Markierung "autofill": die Firma sieht, dass die Tage automatisch eingetragen wurden.
 */
export interface DayTimes { start: string; end: string; pause: number }
/** Schlüssel = Wochentag wie Date.getDay() (1 = Mo … 6 = Sa); null/fehlend = frei */
export type WeekPlan = Partial<Record<1 | 2 | 3 | 4 | 5 | 6, DayTimes | null>>;

export const WEEKDAYS: { dow: 1 | 2 | 3 | 4 | 5 | 6; label: string }[] = [
  { dow: 1, label: "Mo" }, { dow: 2, label: "Di" }, { dow: 3, label: "Mi" },
  { dow: 4, label: "Do" }, { dow: 5, label: "Fr" }, { dow: 6, label: "Sa" },
];

/** Standardzeiten (Mo–Do / Fr) als Wochenplan, Samstag frei */
export function weekFromStandard(std: StandardTimes): WeekPlan {
  const monThu = { start: std.monThuStart, end: std.monThuEnd, pause: std.monThuPause };
  return { 1: monThu, 2: monThu, 3: monThu, 4: monThu, 5: { start: std.friStart, end: std.friEnd, pause: std.friPause }, 6: null };
}

export interface YearFillRow {
  date: string;
  day_type: "arbeiten";
  start_time: string;
  end_time: string;
  break_minutes: number;
  is_night_shift: false;
  note: null;
  tags: string[];
}

export function planYearFill(opts: {
  year: number;
  feiertage: Record<string, string>;
  week: WeekPlan;
  skip?: (date: string) => boolean;
}): YearFillRow[] {
  const { year, feiertage, week, skip } = opts;
  const rows: YearFillRow[] = [];
  for (let m = 1; m <= 12; m++) {
    const daysInMonth = new Date(year, m, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dow = new Date(year, m - 1, d).getDay();
      const t = dow === 0 ? null : week[dow as 1 | 2 | 3 | 4 | 5 | 6];
      if (!t) continue;
      if (feiertage[date]) continue;
      if (skip?.(date)) continue;
      rows.push({
        date, day_type: "arbeiten", start_time: t.start, end_time: t.end, break_minutes: t.pause,
        is_night_shift: false, note: null, tags: [AUTOFILL_TAG],
      });
    }
  }
  return rows;
}
