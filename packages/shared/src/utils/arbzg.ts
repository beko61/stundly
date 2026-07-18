/**
 * §3 ArbZG (Arbeitszeitgesetz) — werktägliche Arbeitszeit
 *
 * Grundregel: Arbeitszeit Mo-Sa max 8h. Verlängerbar auf 10h, wenn innerhalb
 * von 6 Kalendermonaten (oder 24 Wochen) im Durchschnitt 8h nicht überschritten
 * werden. "Arbeitszeit" = netto (ohne Ruhepausen).
 *
 * Selbstständige sind nicht betroffen — die Prüfungen sind warn-only (kein Block).
 * Nutzer im Team-Modus (Arbeitnehmer) bekommen die Warnung als
 * Betriebsprüfung-Frühwarnung.
 */

import type { TimeEntry } from "../types";
import { DAY_TYPES } from "../constants/dayTypes";
import { calculateWorkDuration, parseTimeToMinutes } from "./timeCalc";

export const ARBZG_MAX_DAILY_MINUTES     = 10 * 60; // §3 Satz 2: Höchstgrenze
export const ARBZG_STANDARD_MINUTES      = 8  * 60; // §3 Satz 1: Regel & Ø-Grenze
export const ARBZG_ROLLING_WINDOW_MONTHS = 6;       // Ausgleichszeitraum
export const ARBZG_RUHEZEIT_MIN_MINUTES  = 11 * 60; // §5 Abs. 1: min. 11h zwischen zwei Schichten
export const ARBZG_WEEKLY_MAX_MINUTES    = 48 * 60; // §3 türev: 8h × 6 Werktage haftalık cap
// §4 Ruhepausen — mola gerekliliği
export const ARBZG_PAUSE_6H_THRESHOLD_MIN  = 6 * 60;   // >6h çalışma → 30 min mola
export const ARBZG_PAUSE_9H_THRESHOLD_MIN  = 9 * 60;   // >9h çalışma → 45 min mola
export const ARBZG_PAUSE_6H_MIN_MINUTES    = 30;
export const ARBZG_PAUSE_9H_MIN_MINUTES    = 45;

/** Bir gün için 10h netto Arbeitszeit aşıldı mı? */
export function isDailyCapViolation(netMinutes: number): boolean {
  return netMinutes > ARBZG_MAX_DAILY_MINUTES;
}

/** 6-ay-Ø 8h/Werktag aşıldı mı? */
export function isRollingAvgViolation(avgNetMinutes: number): boolean {
  return avgNetMinutes > ARBZG_STANDARD_MINUTES;
}

export interface DailyCapEntry {
  date:          string; // YYYY-MM-DD
  netMinutes:    number;
}

/**
 * Verilen entry listesinde 10h-cap aşan günleri döndürür.
 * Sadece day_type = ARBEITEN entry'leri hesaba katılır.
 */
export function findDailyCapViolations(
  entries: Array<Pick<TimeEntry, "date" | "day_type" | "start_time" | "end_time" | "break_minutes">>,
): DailyCapEntry[] {
  const out: DailyCapEntry[] = [];
  for (const e of entries) {
    if (e.day_type !== DAY_TYPES.ARBEITEN) continue;
    if (!e.start_time || !e.end_time) continue;
    const { net_minutes } = calculateWorkDuration(e.start_time, e.end_time, e.break_minutes ?? 0);
    if (isDailyCapViolation(net_minutes)) {
      out.push({ date: e.date, netMinutes: net_minutes });
    }
  }
  return out;
}

export interface RollingAvgResult {
  avgDailyMin:   number;
  workdayCount:  number;
  totalNetMin:   number;
  windowStart:   string; // YYYY-MM-DD
  windowEnd:     string; // YYYY-MM-DD
  isViolation:   boolean;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * §3 Ausgleichszeitraum kontrolü — 6 Kalendermonate geriye Ø günlük Arbeitszeit.
 *
 * Nazari:
 *   - Nenner = Zeitraumdaki Mo-Fr sayısı ÇIKARILAN Urlaub/Krank/Feiertag entry'leri
 *     (BAG 27.4.2000 içtihat: Ausfalltage Ø hesabına dahil edilmez)
 *   - Zähler = ARBEITEN entry'lerinin net_minutes toplamı
 *
 * `referenceISO` dahil, 6 ay öncesi başlangıç. Notdienst dahil değil
 * (ArbZG'de tanımlı normal Arbeitszeit'ten ayrı bir domain).
 */
export function calcRolling6MonthAvg(
  entries: Array<Pick<TimeEntry, "date" | "day_type" | "start_time" | "end_time" | "break_minutes">>,
  referenceISO: string,
): RollingAvgResult {
  const [yStr, mStr, dStr] = referenceISO.split("-");
  const refY = Number(yStr);
  const refM = Number(mStr);
  const refD = Number(dStr);

  const startDate = new Date(refY, refM - 1 - ARBZG_ROLLING_WINDOW_MONTHS, refD);
  const endDate   = new Date(refY, refM - 1, refD);
  const windowStart = `${startDate.getFullYear()}-${pad2(startDate.getMonth() + 1)}-${pad2(startDate.getDate())}`;
  const windowEnd   = referenceISO;

  // Ausfalltage (Urlaub/Krank/Feiertag) — bu entry tarihleri Werktag'sa Nenner'den düş
  const ausfallDates = new Set<string>();
  for (const e of entries) {
    if (e.date < windowStart || e.date > windowEnd) continue;
    if (
      e.day_type === DAY_TYPES.URLAUB ||
      e.day_type === DAY_TYPES.KRANK  ||
      e.day_type === DAY_TYPES.FEIERTAG
    ) {
      ausfallDates.add(e.date);
    }
  }

  // Werktag count in window (Mo-Fr), Ausfalltage hariç
  let workdayCount = 0;
  const cur = new Date(startDate);
  while (cur <= endDate) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) {
      const iso = `${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}-${pad2(cur.getDate())}`;
      if (!ausfallDates.has(iso)) workdayCount++;
    }
    cur.setDate(cur.getDate() + 1);
  }

  // ARBEITEN net_minutes toplamı
  let totalNetMin = 0;
  for (const e of entries) {
    if (e.date < windowStart || e.date > windowEnd) continue;
    if (e.day_type !== DAY_TYPES.ARBEITEN) continue;
    if (!e.start_time || !e.end_time) continue;
    const { net_minutes } = calculateWorkDuration(e.start_time, e.end_time, e.break_minutes ?? 0);
    totalNetMin += net_minutes;
  }

  const avgDailyMin = workdayCount > 0 ? totalNetMin / workdayCount : 0;
  return {
    avgDailyMin,
    workdayCount,
    totalNetMin,
    windowStart,
    windowEnd,
    isViolation: isRollingAvgViolation(avgDailyMin),
  };
}

/**
 * §5 ArbZG — Ruhezeit
 *
 * Zwischen Ende der Arbeitszeit an einem Tag und Beginn der Arbeitszeit
 * am nächsten Tag mindestens 11h ununterbrochene Ruhezeit.
 *
 * Ausnahmen §5 II (bestimmte Branchen: Krankenhaus, Gastronomie, Landwirtschaft
 * dürfen auf 10h verkürzen bei Ausgleich innerhalb 4 Wochen). Warn-only.
 *
 * `prevIsOvernight`: Wenn true, die Vorschicht endete AM HEUTIGEN Tag (Nacht­schicht).
 * Dann Ruhezeit = todayStart − prevEnd. Sonst: (24h − prevEnd) + todayStart.
 */
export function calcRuhezeitMinutes(
  prevEndTime: string,
  prevIsOvernight: boolean,
  todayStartTime: string,
): number {
  const prevEnd    = parseTimeToMinutes(prevEndTime);
  const todayStart = parseTimeToMinutes(todayStartTime);
  if (prevIsOvernight) {
    // Vorschicht endete heute (z.B. 06:00). Wenn Nutzer heute 08:00 startet → 2h.
    // Bei Überschneidung negativ → cap 0.
    return Math.max(0, todayStart - prevEnd);
  }
  // Vorschicht endete gestern. Reste des Vortags + heute bis Start.
  return (24 * 60 - prevEnd) + todayStart;
}

export function isRuhezeitViolation(ruhezeitMinutes: number): boolean {
  return ruhezeitMinutes < ARBZG_RUHEZEIT_MIN_MINUTES;
}

/**
 * §3 haftalık cap: 48 Stunden / Woche. ISO-Woche bazlı gruplama.
 *
 * Nazari: 8h × 6 Werktage (Mo-Sa). ARBEITEN entry'lerinin net_minutes toplamı
 * ISO Kalenderwoche başına toplanır. Notdienst dahil değil.
 * Ruhezeit/Urlaub/Krank dakika saymaz (gerçekten çalışılan süre).
 */
export interface WeeklyMinutesEntry {
  /** ISO week format: "2026-W28" — cross-year safe */
  isoWeek:    string;
  netMinutes: number;
  isViolation: boolean;
}

/** ISO 8601 Kalenderwoche (year + week nr). d = date-string YYYY-MM-DD */
function isoWeekOf(dateStr: string): { year: number; week: number } {
  const d = new Date(dateStr);
  // ISO: Perşembe kural — hafta içinde Perşembe hangi yıla düşerse o yıl
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: t.getUTCFullYear(), week };
}

export function calcWeeklyMinutes(
  entries: Array<Pick<TimeEntry, "date" | "day_type" | "start_time" | "end_time" | "break_minutes">>,
): WeeklyMinutesEntry[] {
  const byWeek = new Map<string, number>();

  for (const e of entries) {
    if (e.day_type !== DAY_TYPES.ARBEITEN) continue;
    if (!e.start_time || !e.end_time) continue;
    const { net_minutes } = calculateWorkDuration(e.start_time, e.end_time, e.break_minutes ?? 0);
    const { year, week } = isoWeekOf(e.date);
    const key = `${year}-W${String(week).padStart(2, "0")}`;
    byWeek.set(key, (byWeek.get(key) ?? 0) + net_minutes);
  }

  return Array.from(byWeek.entries())
    .map(([isoWeek, netMinutes]) => ({
      isoWeek,
      netMinutes,
      isViolation: netMinutes > ARBZG_WEEKLY_MAX_MINUTES,
    }))
    .sort((a, b) => a.isoWeek.localeCompare(b.isoWeek));
}

/** Sadece 48h aşan haftalar. */
export function findWeeklyCapViolations(
  entries: Array<Pick<TimeEntry, "date" | "day_type" | "start_time" | "end_time" | "break_minutes">>,
): WeeklyMinutesEntry[] {
  return calcWeeklyMinutes(entries).filter(w => w.isViolation);
}

/**
 * §4 ArbZG — Ruhepausen (Kısa mola gereklilikleri).
 *   >6h → 30 min
 *   >9h → 45 min
 *   ≤6h → 0 min (mola zorunlu değil)
 *
 * Basit hesap: brutto çalışma süresine göre minimum mola dakikası.
 * Netto vs brutto: yasa "Arbeitszeit" ≥6h/9h derken brutto (mola dahil)
 * süreyi kastediyor değil, netto çalışma süresini. Bu yüzden burada
 * "workedMinutes" = netto (mola çıkarılmış) beklenir.
 */
export function getMinRequiredBreak(workedMinutes: number): number {
  if (workedMinutes > ARBZG_PAUSE_9H_THRESHOLD_MIN) return ARBZG_PAUSE_9H_MIN_MINUTES;
  if (workedMinutes > ARBZG_PAUSE_6H_THRESHOLD_MIN) return ARBZG_PAUSE_6H_MIN_MINUTES;
  return 0;
}

/**
 * Verilen çalışma & mola dakikalarında §4 ihlali var mı?
 * true = mola yetersiz, false = OK.
 */
export function isPauseInsufficient(workedMinutes: number, breakMinutes: number): boolean {
  return breakMinutes < getMinRequiredBreak(workedMinutes);
}
