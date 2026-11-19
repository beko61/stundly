import type { StandardTimes } from "./standardTimes";
import { AUTOFILL_TAG } from "@/lib/company/monthCheck";

/**
 * Jahres-Befüllung — eine Stelle für Mitarbeiter-Einstellungen (AutoFillReports) und
 * Firma (Chef füllt das Jahr eines Mitarbeiters, /api/company/employees/[userId]/year-fill).
 * Mo–Fr mit Standardzeiten; Wochenende, Feiertage und alles, was `skip` meldet, bleibt leer.
 * Markierung "autofill": die Firma sieht, dass die Tage automatisch eingetragen wurden.
 */
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
  std: StandardTimes;
  skip?: (date: string) => boolean;
}): YearFillRow[] {
  const { year, feiertage, std, skip } = opts;
  const rows: YearFillRow[] = [];
  for (let m = 1; m <= 12; m++) {
    const daysInMonth = new Date(year, m, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dow = new Date(year, m - 1, d).getDay();
      if (dow === 0 || dow === 6) continue;
      if (feiertage[date]) continue;
      if (skip?.(date)) continue;
      const fri = dow === 5;
      rows.push({
        date,
        day_type: "arbeiten",
        start_time:    fri ? std.friStart : std.monThuStart,
        end_time:      fri ? std.friEnd   : std.monThuEnd,
        break_minutes: fri ? std.friPause : std.monThuPause,
        is_night_shift: false,
        note: null,
        tags: [AUTOFILL_TAG],
      });
    }
  }
  return rows;
}
