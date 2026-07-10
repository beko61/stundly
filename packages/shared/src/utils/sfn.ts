/**
 * §3b EStG — Steuerfreie Zuschläge für Sonntags-, Feiertags- und Nachtarbeit
 *
 * Zuschläge sind zusätzlich zum Grundlohn und gehören zum Brutto. Sie sind
 * jedoch bis zu einem Grundlohn-Cap steuerfrei (§3b EStG) und bis zu einem
 * niedrigeren Cap sozialversicherungsfrei (§1 SvEV).
 *
 * VEREINFACHUNG:
 *  - "Nacht" pauschal 20:00–06:00 = 25% (die 40%-Kernnacht 00–04
 *    "wenn Nachtarbeit vor 0 Uhr begonnen wurde" ist nicht abgebildet)
 *  - Sonntag/Feiertag jeweils 00:00–24:00 des Kalendertages (die
 *    "Erweiterung bis 04:00 des Folgetages" nach §3b II Nr. 1 ist
 *    nicht abgebildet)
 *  - Feiertag pauschal 125% (die 150% für 1. Weihnachten / Neujahr /
 *    1. Mai sind nicht separat behandelt)
 *  - Overlap: Sonntag+Nacht = 75%, Feiertag+Nacht = 150% (additiv)
 *
 * Diese Vereinfachungen liegen an der sicheren Seite (Nutzer bekommt
 * eher weniger Steuerfrei ausgewiesen als tatsächlich). Für exakte
 * Lohnabrechnung Steuerberater konsultieren.
 */

import type { TimeEntry } from "../types";
import { DAY_TYPES } from "../constants/dayTypes";
import { parseTimeToMinutes } from "./timeCalc";

// §3b Grundlohn-Deckelung (Cap je Stunde)
export const SFN_LST_CAP_PER_HOUR = 50; // EUR/Std steuerfrei-Cap
export const SFN_SV_CAP_PER_HOUR  = 25; // EUR/Std sv-frei-Cap (§1 SvEV)

// §3b Zuschlag-Sätze (Prozent auf Grundlohn)
export const SFN_NIGHT_PERCENT    = 25;
export const SFN_SONNTAG_PERCENT  = 50;
export const SFN_FEIERTAG_PERCENT = 125;

// Nacht: 20:00–06:00 (in Minuten seit Mitternacht)
const NIGHT_START_MIN = 20 * 60;
const NIGHT_END_MIN   =  6 * 60;

/** Minute-of-day 0..1439 fällt in die Nachtzeit (20:00-06:00) */
function isNightMinute(m: number): boolean {
  return m >= NIGHT_START_MIN || m < NIGHT_END_MIN;
}

export interface SfnMinutes {
  night:         number;
  sonntag:       number;
  feiertag:      number;
  sonntagNight:  number;
  feiertagNight: number;
}

/**
 * Entry'yi dakika-dakika sınıflandırır.
 *
 * Overlap kuralı: bir dakika "Sonntag+Nacht" ise sadece `sonntagNight`'a sayılır
 * (`night` ve `sonntag`'a değil), aynı şekilde Feiertag+Nacht `feiertagNight`'a.
 * Feiertag ve Sonntag aynı gün asla olmaz (bir dakika ya Feiertag'sa ya Sonntag'sa).
 */
export function classifyEntryMinutes(
  date: string,               // YYYY-MM-DD
  startTime: string,          // HH:mm
  endTime: string,            // HH:mm
  isNightShift: boolean,      // end < start → next day
  isFeiertag: boolean,        // date bugün Feiertag mi
): SfnMinutes {
  const start = parseTimeToMinutes(startTime);
  const end   = parseTimeToMinutes(endTime);
  const isOvernight = isNightShift || end < start;

  const [yStr, mStr, dStr] = date.split("-");
  const y = Number(yStr); const mo = Number(mStr); const d = Number(dStr);
  const day1Date = new Date(y, mo - 1, d);
  const day1Dow = day1Date.getDay(); // 0=Sun
  const day2Date = new Date(y, mo - 1, d + 1);
  const day2Dow = day2Date.getDay();

  // Toplam dakika (brutto — pauses subtract sonra proporsiyonel yapılır)
  const totalBrutto = isOvernight ? (24 * 60 - start) + end : end - start;

  const out: SfnMinutes = {
    night: 0, sonntag: 0, feiertag: 0,
    sonntagNight: 0, feiertagNight: 0,
  };

  for (let i = 0; i < totalBrutto; i++) {
    const absMin = start + i;
    const onDay1 = absMin < 24 * 60;
    const clockMin = absMin % (24 * 60); // 0..1439

    const inFeiertag = onDay1 ? isFeiertag : false;
    // day2 Feiertag ihtimali: sonraki gün Feiertag mı? Bilmiyoruz burada
    // (feiertage map gerekir). Şimdilik yalnızca day1 Feiertag'ı hesaba katıyoruz.
    // Overnight shift'lerde day2 Feiertag'ı için ayrı bir helper (aşağıda).
    const inSonntag  = onDay1 ? (day1Dow === 0) : (day2Dow === 0);

    const nightM = isNightMinute(clockMin);

    if (inFeiertag && nightM)      out.feiertagNight++;
    else if (inFeiertag)           out.feiertag++;
    else if (inSonntag && nightM)  out.sonntagNight++;
    else if (inSonntag)            out.sonntag++;
    else if (nightM)               out.night++;
  }
  return out;
}

/** Variant: entry aynı gün Feiertag OR sonraki gün Feiertag olabilir. */
export function classifyEntryMinutesWithFeiertagMap(
  date: string,
  startTime: string,
  endTime: string,
  isNightShift: boolean,
  feiertage: Record<string, string>,
): SfnMinutes {
  const [yStr, mStr, dStr] = date.split("-");
  const y = Number(yStr); const mo = Number(mStr); const d = Number(dStr);
  const day2 = new Date(y, mo - 1, d + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const day1ISO = date;
  const day2ISO = `${day2.getFullYear()}-${pad(day2.getMonth() + 1)}-${pad(day2.getDate())}`;

  const start = parseTimeToMinutes(startTime);
  const end   = parseTimeToMinutes(endTime);
  const isOvernight = isNightShift || end < start;
  const day1Dow = new Date(y, mo - 1, d).getDay();
  const day2Dow = day2.getDay();

  const isFeiertagDay1 = !!feiertage[day1ISO];
  const isFeiertagDay2 = !!feiertage[day2ISO];

  const totalBrutto = isOvernight ? (24 * 60 - start) + end : end - start;
  const out: SfnMinutes = {
    night: 0, sonntag: 0, feiertag: 0,
    sonntagNight: 0, feiertagNight: 0,
  };

  for (let i = 0; i < totalBrutto; i++) {
    const absMin = start + i;
    const onDay1 = absMin < 24 * 60;
    const clockMin = absMin % (24 * 60);

    const inFeiertag = onDay1 ? isFeiertagDay1 : isFeiertagDay2;
    const inSonntag  = onDay1 ? (day1Dow === 0) : (day2Dow === 0);
    const nightM = isNightMinute(clockMin);

    if (inFeiertag && nightM)      out.feiertagNight++;
    else if (inFeiertag)           out.feiertag++;
    else if (inSonntag && nightM)  out.sonntagNight++;
    else if (inSonntag)            out.sonntag++;
    else if (nightM)               out.night++;
  }
  return out;
}

export interface SfnBreakdown {
  /** Brutto Zuschlag (in Gehalt enthalten) */
  totalZuschlag: number;
  /** Steuerfreier Anteil (§3b EStG) */
  lstFrei: number;
  /** SV-freier Anteil (§1 SvEV) */
  svFrei: number;
  /** Ausgewiesene Prozente pro Kategorie */
  minutes: SfnMinutes;
}

/**
 * SFN-Zuschläge berechnen. Grundlohn = vertraglicher Stundenlohn (settings.hourly_rate).
 *
 * Für jede Zuschlag-Minute wird:
 *   - Zuschlag = grundlohnPerHour × %
 *   - Steuerfrei = min(grundlohn, LST_CAP) × %
 *   - SV-frei    = min(grundlohn, SV_CAP)  × %
 */
export function calcSfnZuschlag(mins: SfnMinutes, grundlohnPerHour: number): SfnBreakdown {
  const gpm = grundlohnPerHour / 60;                          // €/Minute Grundlohn
  const lstCapPerMin = SFN_LST_CAP_PER_HOUR / 60;
  const svCapPerMin  = SFN_SV_CAP_PER_HOUR / 60;
  const gpmLstBase = Math.min(gpm, lstCapPerMin);
  const gpmSvBase  = Math.min(gpm, svCapPerMin);

  const parts = [
    { min: mins.night,         pct: SFN_NIGHT_PERCENT },
    { min: mins.sonntag,       pct: SFN_SONNTAG_PERCENT },
    { min: mins.feiertag,      pct: SFN_FEIERTAG_PERCENT },
    { min: mins.sonntagNight,  pct: SFN_SONNTAG_PERCENT + SFN_NIGHT_PERCENT },
    { min: mins.feiertagNight, pct: SFN_FEIERTAG_PERCENT + SFN_NIGHT_PERCENT },
  ];

  let totalZuschlag = 0, lstFrei = 0, svFrei = 0;
  for (const p of parts) {
    const f = p.pct / 100;
    totalZuschlag += p.min * gpm         * f;
    lstFrei       += p.min * gpmLstBase  * f;
    svFrei        += p.min * gpmSvBase   * f;
  }
  return { totalZuschlag, lstFrei, svFrei, minutes: mins };
}

/**
 * Aylık SFN toplamı — arbeiten entries üzerinden dakikaları toplayıp hesaplar.
 * feiertage map: `{ "2026-01-01": "Neujahr", ... }`
 */
export function calcMonthlySfn(
  entries: Array<Pick<TimeEntry, "date" | "day_type" | "start_time" | "end_time" | "is_night_shift">>,
  feiertage: Record<string, string>,
  grundlohnPerHour: number,
): SfnBreakdown {
  const total: SfnMinutes = {
    night: 0, sonntag: 0, feiertag: 0, sonntagNight: 0, feiertagNight: 0,
  };
  for (const e of entries) {
    if (e.day_type !== DAY_TYPES.ARBEITEN) continue;
    if (!e.start_time || !e.end_time) continue;
    const m = classifyEntryMinutesWithFeiertagMap(
      e.date, e.start_time, e.end_time,
      e.is_night_shift, feiertage,
    );
    total.night         += m.night;
    total.sonntag       += m.sonntag;
    total.feiertag      += m.feiertag;
    total.sonntagNight  += m.sonntagNight;
    total.feiertagNight += m.feiertagNight;
  }
  return calcSfnZuschlag(total, grundlohnPerHour);
}
