/**
 * Kalender-Jahre der App (Nutzerwunsch 19.11.2026: überall bis 2035 wählbar) — eine Stelle für alle
 * Jahresauswahlen (Tracker, Gehalt, Berichte, Jahres-Befüllung, Vorlagen).
 */
export const CALENDAR_FIRST_YEAR = 2025;
export const CALENDAR_LAST_YEAR = 2035;

/** [from … CALENDAR_LAST_YEAR] */
export function calendarYears(from: number = CALENDAR_FIRST_YEAR): number[] {
  const out: number[] = [];
  for (let y = from; y <= CALENDAR_LAST_YEAR; y++) out.push(y);
  return out;
}
