/**
 * Notdienst-Zentrale (Firmen-Panel): Wochenplan, automatische Verteilung,
 * Ruhezeit nach Einsätzen, CSV "Einsätze abrechnen". Reine Funktionen.
 */

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoUTC = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
const parseUTC = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
};

/** Aktuelle deutsche Wanduhrzeit "YYYY-MM-DDTHH:MM" (Server läuft in UTC). */
export function berlinNowLocal(at: Date = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(at).map((x) => [x.type, x.value]),
  );
  return `${p["year"]}-${p["month"]}-${p["day"]}T${p["hour"]}:${p["minute"]}`;
}

/** Montag der Woche (ISO) */
export function mondayOf(iso: string): string {
  const d = parseUTC(iso);
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (dow - 1));
  return isoUTC(d);
}

export function addDays(iso: string, days: number): string {
  const d = parseUTC(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return isoUTC(d);
}

/** n Wochen-Montage ab der Woche von `fromISO` */
export function upcomingWeeks(fromISO: string, n: number): string[] {
  const start = mondayOf(fromISO);
  return Array.from({ length: n }, (_, i) => addDays(start, i * 7));
}

/**
 * Freie Wochen reihum verteilen: jeweils die nächste Person nach der zuletzt
 * eingeteilten (auch aus einer Woche vor dem Zeitraum: `previous`).
 * Vorhandene Einteilungen bleiben unverändert.
 */
export function autoDistribute(
  weeks: string[],
  userIds: string[],
  existing: Record<string, string | undefined>,
  previous?: string,
): { week_start: string; user_id: string }[] {
  if (userIds.length === 0) return [];
  const out: { week_start: string; user_id: string }[] = [];
  let last = previous;
  for (const w of weeks) {
    if (existing[w]) { last = existing[w]; continue; }
    const pos = last ? userIds.indexOf(last) : -1;
    const uid = userIds[(pos + 1) % userIds.length]!;
    out.push({ week_start: w, user_id: uid });
    last = uid;
  }
  return out;
}

/**
 * §5 ArbZG: nach einem Einsatz 11 h Ruhe. Liefert pro Mitarbeiter den spätesten
 * Zeitpunkt, bis zu dem Ruhe gilt — nur wenn er noch in der Zukunft liegt.
 * Zeiten sind lokale Wanduhrzeit (Europe/Berlin), `nowLocal` ebenso als "YYYY-MM-DDTHH:MM".
 */
export function restUntil(
  nd: { user_id: string; date: string; start_time: string | null; end_time: string | null }[],
  nowLocal: string,
): Map<string, string> {
  const toAbs = (date: string, time: string, plusDay: boolean) =>
    parseUTC(date).getTime() / 60000 + Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) + (plusDay ? 1440 : 0);
  const now = toAbs(nowLocal.slice(0, 10), nowLocal.slice(11, 16), false);
  const out = new Map<string, number>();
  for (const e of nd) {
    if (!e.start_time || !e.end_time) continue;
    const overnight = e.end_time.slice(0, 5) < e.start_time.slice(0, 5);
    const end = toAbs(e.date, e.end_time, overnight);
    if (end > now) continue;                       // Einsatz läuft noch / Zukunft
    const until = end + 11 * 60;
    if (until <= now) continue;
    if (until > (out.get(e.user_id) ?? 0)) out.set(e.user_id, until);
  }
  const res = new Map<string, string>();
  for (const [uid, m] of out) {
    const d = new Date(m * 60000);
    res.set(uid, `${isoUTC(d)}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`);
  }
  return res;
}

export interface CsvEinsatz {
  date: string; name: string; start_time: string; end_time: string; minutes: number;
  kunde: string | null; kunde_telefon: string | null; adresse: string | null;
  problem: string | null; ergebnis: string | null; erledigt: boolean;
}

/** CSV für Rechnungsprogramme/Excel (Semikolon, deutsche Zahlen, BOM für Umlaute). */
export function einsaetzeCsv(rows: CsvEinsatz[], pauschale: number | null): string {
  const esc = (v: string | null | undefined) => {
    const s = (v ?? "").replace(/\r?\n/g, " / ");
    return /[;"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const dateDE = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
  const hours = (m: number) => (m / 60).toFixed(2).replace(".", ",");
  const head = ["Datum", "Mitarbeiter", "Beginn", "Ende", "Stunden", "Kunde", "Telefon", "Adresse", "Problem", "Ergebnis", "Bezahlt", "Pauschale €"];
  const lines = rows.map((r) => [
    dateDE(r.date), esc(r.name), r.start_time.slice(0, 5), r.end_time.slice(0, 5), hours(r.minutes),
    esc(r.kunde), esc(r.kunde_telefon), esc(r.adresse), esc(r.problem), esc(r.ergebnis),
    r.erledigt ? "ja" : "nein", pauschale != null ? pauschale.toFixed(2).replace(".", ",") : "",
  ].join(";"));
  return "﻿" + [head.join(";"), ...lines].join("\r\n") + "\r\n";
}
