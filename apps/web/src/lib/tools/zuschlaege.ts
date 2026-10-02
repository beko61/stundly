/**
 * Steuerfreie Zuschläge für Sonntags-, Feiertags- und Nachtarbeit (§ 3b EStG, R 3b LStR).
 *
 * - Nacht 20–6 Uhr: 25 %; 0–4 Uhr 40 %, wenn die Arbeit vor 0 Uhr begonnen hat
 * - Sonntag 50 %, gesetzlicher Feiertag 125 %, 31.12. ab 14 Uhr 125 %,
 *   24.12. ab 14 Uhr, 25./26.12. und 1. Mai 150 %
 * - Begonnen vor 0 Uhr: 0–4 Uhr des Folgetags zählt noch als Sonntag/Feiertag
 * - Nacht + Sonntag/Feiertag nebeneinander; Sonntag + Feiertag nicht (nur der höhere Satz)
 * - Grundlohn höchstens 50 €/h (Steuer), 25 €/h (Sozialversicherung, § 1 SvEV)
 *
 * Minutengenau über den Einsatz gerechnet (max. 24 h).
 */

import { getFeiertage } from "@/lib/utils/feiertage";

export const GRUNDLOHN_MAX_STEUER = 50;
export const GRUNDLOHN_MAX_SV = 25;

export type ZuschlagArt = "nacht25" | "nacht40" | "sonntag" | "feiertag" | "feiertag150";

export const ZUSCHLAG_INFO: Record<ZuschlagArt, { label: string; pct: number }> = {
  nacht25:     { label: "Nachtarbeit (20–6 Uhr)",                 pct: 25 },
  nacht40:     { label: "Nachtarbeit 0–4 Uhr (Beginn vor 0 Uhr)",  pct: 40 },
  sonntag:     { label: "Sonntagsarbeit",                         pct: 50 },
  feiertag:    { label: "Feiertag / Silvester ab 14 Uhr",          pct: 125 },
  feiertag150: { label: "Weihnachten, Heiligabend ab 14 Uhr, 1. Mai", pct: 150 },
};

export interface ZuschlagInput {
  date:        string;  // YYYY-MM-DD (Beginn)
  start:       string;  // HH:MM
  end:         string;  // HH:MM — kleiner/gleich Beginn = nächster Tag
  bundesland:  string;
  stundenlohn: number;
}

export interface ZuschlagRow {
  art:            ZuschlagArt;
  label:          string;
  pct:            number;
  minutes:        number;
  steuerfreiEuro: number;
  svFreiEuro:     number;
}

export interface ZuschlagResult {
  totalMin:       number;
  grundEuro:      number;
  rows:           ZuschlagRow[];
  steuerfreiEuro: number;
  svFreiEuro:     number;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const round2 = (v: number) => Math.round(v * 100) / 100;

function parseHM(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** Tagessatz (Sonntag/Feiertag) für einen Kalendertag ab einer Uhrzeit */
function dayArt(dateIso: string, hour: number, holidays: (y: number) => Record<string, string>): ZuschlagArt | null {
  const md = dateIso.slice(5);
  if (md === "12-25" || md === "12-26" || md === "05-01" || (md === "12-24" && hour >= 14)) return "feiertag150";
  const y = Number(dateIso.slice(0, 4));
  if (holidays(y)[dateIso] || (md === "12-31" && hour >= 14)) return "feiertag";
  if (new Date(`${dateIso}T00:00:00Z`).getUTCDay() === 0) return "sonntag";
  return null;
}

const RANK: Record<ZuschlagArt, number> = { nacht25: 0, nacht40: 0, sonntag: 1, feiertag: 2, feiertag150: 3 };
const higher = (a: ZuschlagArt | null, b: ZuschlagArt | null) => (!a ? b : !b ? a : RANK[b] > RANK[a] ? b : a);

export function calcZuschlaege(input: ZuschlagInput): ZuschlagResult | null {
  const s = parseHM(input.start), e = parseHM(input.end);
  if (s === null || e === null || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return null;
  if (!(input.stundenlohn >= 0)) return null;
  const totalMin = e > s ? e - s : e + 1440 - s;

  const cache = new Map<number, Record<string, string>>();
  const holidays = (y: number) => {
    if (!cache.has(y)) cache.set(y, getFeiertage(y, input.bundesland));
    return cache.get(y)!;
  };

  const minutes: Record<ZuschlagArt, number> = { nacht25: 0, nacht40: 0, sonntag: 0, feiertag: 0, feiertag150: 0 };
  const startMs = Date.parse(`${input.date}T00:00:00Z`) + s * 60_000;
  const startDay = input.date;

  for (let i = 0; i < totalMin; i++) {
    const t = new Date(startMs + i * 60_000);
    const day = iso(t);
    const h = t.getUTCHours();
    const begunBefore = day > startDay; // Arbeit hat vor 0 Uhr dieses Tages begonnen

    if (h >= 20 || h < 6) minutes[h < 4 && begunBefore ? "nacht40" : "nacht25"]++;

    let art = dayArt(day, h, holidays);
    if (h < 4 && begunBefore) {
      const prev = iso(new Date(t.getTime() - 86_400_000));
      art = higher(art, dayArt(prev, 23, holidays));
    }
    if (art) minutes[art]++;
  }

  const lohnSt = Math.min(input.stundenlohn, GRUNDLOHN_MAX_STEUER);
  const lohnSv = Math.min(input.stundenlohn, GRUNDLOHN_MAX_SV);
  const rows: ZuschlagRow[] = (Object.keys(ZUSCHLAG_INFO) as ZuschlagArt[])
    .filter((art) => minutes[art] > 0)
    .map((art) => {
      const { label, pct } = ZUSCHLAG_INFO[art];
      const hrs = minutes[art] / 60;
      return {
        art, label, pct, minutes: minutes[art],
        steuerfreiEuro: round2(hrs * lohnSt * pct / 100),
        svFreiEuro:     round2(hrs * lohnSv * pct / 100),
      };
    });

  return {
    totalMin,
    grundEuro: round2(totalMin / 60 * input.stundenlohn),
    rows,
    steuerfreiEuro: round2(rows.reduce((a, r) => a + r.steuerfreiEuro, 0)),
    svFreiEuro:     round2(rows.reduce((a, r) => a + r.svFreiEuro, 0)),
  };
}
