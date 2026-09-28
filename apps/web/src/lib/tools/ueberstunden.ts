/**
 * Überstundenrechner (öffentliche SEO-Seite /ueberstundenrechner) — reine Rechenlogik.
 */

/** Durchschnittliche Wochen pro Monat (52 / 12) */
export const WEEKS_PER_MONTH = 52 / 12;

/** §3 ArbZG: 6 Werktage × 8 h im Durchschnitt = 48 h/Woche */
export const ARBZG_WEEK_AVG_MAX_MIN = 48 * 60;
/** §3 ArbZG: höchstens 10 h pro Tag */
export const ARBZG_DAY_MAX_MIN = 10 * 60;

/**
 * Stunden-Eingabe → Minuten. Akzeptiert "38", "38,5", "38.5", "38:30".
 * Ungültig/leer → null.
 */
export function parseHours(input: string): number | null {
  const v = input.trim();
  if (!v) return null;
  const hm = /^(\d{1,4}):([0-5]?\d)$/.exec(v);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  if (!/^\d{1,4}([.,]\d{1,2})?$/.test(v)) return null;
  return Math.round(Number(v.replace(",", ".")) * 60);
}

/** "HH:MM" → Minuten seit Mitternacht; ungültig → null */
function clock(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** Netto-Arbeitszeit eines Tages (Ende < Beginn = über Mitternacht). Unvollständig → 0. */
export function dayMinutes(start: string, end: string, pauseMin: number): number {
  const s = clock(start), e = clock(end);
  if (s === null || e === null || s === e) return 0;
  const brutto = e > s ? e - s : 24 * 60 - s + e;
  return Math.max(0, brutto - Math.max(0, pauseMin || 0));
}

export type Zeitraum = "woche" | "monat";

export interface UeberstundenInput {
  istMin:        number;
  wochenStunden: number;   // vertragliche Wochenarbeitszeit
  zeitraum:      Zeitraum;
  stundenlohn?:  number | null;
  zuschlagPct?:  number;   // Überstundenzuschlag laut Vertrag/Tarif, z. B. 25
}

export interface UeberstundenResult {
  sollMin:    number;
  diffMin:    number;      // + Überstunden / − Minusstunden
  tage:       number;      // diffMin in Arbeitstagen (Wochenstunden / 5)
  wertEuro:   number | null; // nur bei Stundenlohn und positiver Differenz
}

export function calcUeberstunden(i: UeberstundenInput): UeberstundenResult {
  const wochenMin = Math.max(0, i.wochenStunden) * 60;
  const sollMin = Math.round(i.zeitraum === "woche" ? wochenMin : wochenMin * WEEKS_PER_MONTH);
  const diffMin = i.istMin - sollMin;
  const tagMin = wochenMin / 5;
  const tage = tagMin > 0 ? diffMin / tagMin : 0;
  const wertEuro = i.stundenlohn && i.stundenlohn > 0 && diffMin > 0
    ? Math.round((diffMin / 60) * i.stundenlohn * (1 + (i.zuschlagPct ?? 0) / 100) * 100) / 100
    : null;
  return { sollMin, diffMin, tage, wertEuro };
}
