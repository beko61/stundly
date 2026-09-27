/**
 * Kalender-Helfer für die Urlaubsseite.
 * Überstunden werden NICHT mehr hier berechnet — siehe calcOvertimeToDate in
 * lib/utils/monthStats.ts (einzige Quelle für Urlaub + Berichte).
 */

function isoToUTC(iso: string): Date {
  const parts = iso.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  return new Date(Date.UTC(y, m - 1, d));
}

export function isWeekday(iso: string): boolean {
  const d = isoToUTC(iso).getUTCDay();
  return d !== 0 && d !== 6;
}

export function workdaysBetween(startISO: string, endISO: string): number {
  if (startISO > endISO) return 0;
  const start = isoToUTC(startISO);
  const end   = isoToUTC(endISO);
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const d = cur.getUTCDay();
    if (d !== 0 && d !== 6) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}
