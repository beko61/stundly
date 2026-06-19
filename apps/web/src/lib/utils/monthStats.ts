/**
 * Tek doğruluk kaynağı: aylık / yıllık zaman & istatistik hesabı.
 *
 * Bu helper tracker (MonthlySummary), dashboard, calendar, reports tarafından
 * paylaşılır. Her dosyada kendi versiyonu olduğunda "Calendar Tracker ile
 * uymuyor" gibi sorunlar çıkıyordu — bu modül o sorunu çözer.
 *
 * Kurallar (07.06.2026 itibariyle sabit):
 *   - Mo-Fr = 8h Sollstunden  (08:00–17:00 / 1h Pause)
 *   - Sa/So = 0 Sollstunden
 *   - Urlaub / Krank / Feiertag entry'leri her Werktag için 8h sayılır
 *   - DB'de entry'si olmayan ama feiertage[date] var olan günler için
 *     de 8h "Auto-Feiertag" eklenir (örn. Neujahr) — workedMin'e dahil
 *   - Notdienst: kullanıcı entry'leri toplanır, Differenz'e dahil
 */

import { calculateWorkDuration, DAY_TYPES } from "@workly/shared";
import type { TimeEntry } from "@workly/shared";

export interface NdEntry {
  date: string;
  start_time: string | null;
  end_time: string | null;
  erledigt?: boolean | null;
}

export interface MonthStatsInput {
  entries: TimeEntry[];
  ndEntries?: NdEntry[];
  /** Tüm yıl feiertage'ı: `{ "2026-01-01": "Neujahr", ... }` */
  feiertage?: Record<string, string>;
  /** Hesabın hangi periyoda ait olduğunu söyler. month=null → tüm yıl */
  year: number;
  month: number | null;
  /** Aylık Sollstunden (kullanıcının salary_settings.monthly_target_hours) */
  targetHoursPerMonth: number;
  /**
   * Sadece year mode (month=null) için: YTD (Year-To-Date) sınırı.
   * Bu tarihten sonraki entry/feiertag hesaba katılmaz, hedef de bu tarihe
   * kadar olan iş günleri × 8h olarak ölçeklenir. month != null ise yok sayılır.
   * Verilmezse tüm yıl davranışı (yıl sonu raporu için kullanılır).
   */
  todayISO?: string;
}

export interface MonthStatsResult {
  /** Echte gearbeitete + bezahlte Abwesenheit (Urlaub/Krank/Feiertag), Notdienst HARİÇ */
  workedMin: number;
  /** SADECE day_type=arbeiten entry'lerinin net dakikası (Urlaub/Krank/Feiertag HARİÇ) */
  workedMinPure: number;
  /** Urlaub + Krank + Feiertag (entry + auto) Sollstunden toplamı */
  paidAbsenceMin: number;
  /** Notdienst dakika toplamı (ayrı, Differenz hesabında eklenir) */
  ndMin: number;
  /** Notdienst entry sayısı */
  ndCount: number;
  /** Bezahlt (erledigt=true) sayısı */
  ndPaid: number;
  /** Urlaub gün sayısı (entry day_type=urlaub) */
  urlaubDays: number;
  /** Urlaub dakikası (Sollstunden toplamı — UI breakdown için ayrı tutulur) */
  urlaubMin: number;
  /** Krank gün sayısı */
  krankDays: number;
  /** Krank dakikası (Sollstunden toplamı) */
  krankMin: number;
  /** Feiertag gün sayısı — entry feiertag + auto-feiertag */
  feiertagDays: number;
  /** day_type=arbeiten entry sayısı */
  arbeitenEntries: number;
  /** Periyottaki Mo-Fr (Feiertag hariç) gün sayısı — "Arbeitstage verfügbar" */
  workDaysInPeriod: number;
  /** workedMin + ndMin − targetMin */
  diffMin: number;
  /** targetHoursPerMonth × ay sayısı (month null → 12) × 60 */
  targetMin: number;
}

/** Tarih → 0 (Pazar) ... 6 (Cumartesi). UTC sorunu çıkmasın diye lokal kullanıyoruz. */
function dowOf(year: number, monthIdx0: number, day: number): number {
  return new Date(year, monthIdx0, day).getDay();
}

function pad2(n: number): string { return String(n).padStart(2, "0"); }

/** Mo-Fr 8h, Sa/So 0. */
function getDayStdMins(year: number, monthIdx0: number, day: number): number {
  const d = dowOf(year, monthIdx0, day);
  return d === 0 || d === 6 ? 0 : 8 * 60;
}

/** Mo-Fr (Feiertag hariç) iş günü sayısı (periyot için). */
export function countWorkDays(
  year: number,
  month: number | null,
  feiertage: Record<string, string> = {},
  todayISO?: string,
): number {
  const months = month != null ? [month] : Array.from({ length: 12 }, (_, i) => i + 1);
  let count = 0;
  for (const m of months) {
    const daysIn = new Date(year, m, 0).getDate();
    for (let d = 1; d <= daysIn; d++) {
      const iso = `${year}-${pad2(m)}-${pad2(d)}`;
      if (month == null && todayISO && iso > todayISO) continue;
      const dow = dowOf(year, m - 1, d);
      if (dow === 0 || dow === 6) continue;
      if (feiertage[iso]) continue;
      count++;
    }
  }
  return count;
}

/**
 * Ana hesap fonksiyonu. Tüm sayfalar bunu çağırır.
 */
export function calcMonthStats(input: MonthStatsInput): MonthStatsResult {
  const { entries, ndEntries = [], feiertage = {}, year, month, targetHoursPerMonth, todayISO } = input;
  const ytdCutoff = month == null ? todayISO : undefined;
  const inWindow = (iso: string): boolean => !ytdCutoff || iso <= ytdCutoff;

  let workedMin = 0;
  let workedMinPure = 0;
  let paidAbsenceMin = 0;
  let urlaubMin = 0, krankMin = 0;
  let urlaubDays = 0, krankDays = 0, feiertagDays = 0, arbeitenEntries = 0;

  const entryDates = new Set(entries.map(e => e.date));

  for (const e of entries) {
    if (!inWindow(e.date)) continue;

    switch (e.day_type) {
      case DAY_TYPES.URLAUB:    urlaubDays++; break;
      case DAY_TYPES.KRANK:     krankDays++;  break;
      case DAY_TYPES.FEIERTAG:  feiertagDays++; break;
      case DAY_TYPES.ARBEITEN:  arbeitenEntries++; break;
    }

    // Urlaub / Krank / Feiertag → Sollstunden (8h Mo-Fr)
    if (
      e.day_type === DAY_TYPES.URLAUB ||
      e.day_type === DAY_TYPES.KRANK ||
      e.day_type === DAY_TYPES.FEIERTAG
    ) {
      const [yStr, mStr, dStr] = e.date.split("-");
      const y = Number(yStr); const m = Number(mStr); const d = Number(dStr);
      if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
        const std = getDayStdMins(y, m - 1, d);
        workedMin      += std;
        paidAbsenceMin += std;
        if (e.day_type === DAY_TYPES.URLAUB) urlaubMin += std;
        if (e.day_type === DAY_TYPES.KRANK)  krankMin  += std;
      }
      continue;
    }

    if (e.day_type === DAY_TYPES.NOTDIENST) continue;
    if (e.day_type === DAY_TYPES.FREI)      continue;
    if (!e.start_time || !e.end_time)       continue;

    // ARBEITEN — gerçek saatler
    const { net_minutes } = calculateWorkDuration(e.start_time, e.end_time, e.break_minutes);
    workedMin     += net_minutes;
    workedMinPure += net_minutes;
  }

  // Auto-Feiertag: feiertage map'inde olan ama DB'de entry'si olmayan günler
  const monthPrefix = month != null ? `${year}-${pad2(month)}-` : `${year}-`;
  for (const ftDate of Object.keys(feiertage)) {
    if (!ftDate.startsWith(monthPrefix)) continue;
    if (!inWindow(ftDate)) continue;
    if (entryDates.has(ftDate)) continue;
    const [yStr, mStr, dStr] = ftDate.split("-");
    const y = Number(yStr); const m = Number(mStr); const d = Number(dStr);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) continue;
    const std = getDayStdMins(y, m - 1, d);
    if (std > 0) {
      workedMin      += std;
      paidAbsenceMin += std;
      feiertagDays++;
    }
  }

  // Notdienst
  const ndMin = ndEntries.reduce((sum, nd) => {
    if (!inWindow(nd.date)) return sum;
    if (!nd.start_time || !nd.end_time) return sum;
    return sum + calculateWorkDuration(nd.start_time, nd.end_time, 0).net_minutes;
  }, 0);
  const ndCount = ndEntries.filter(nd => inWindow(nd.date)).length;
  const ndPaid  = ndEntries.filter(nd => inWindow(nd.date) && nd.erledigt).length;

  // YTD: target = (yıl başı .. todayISO arası Mo-Fr × 8h). Aksi halde aylık ortalama × periyot ay sayısı.
  const workDaysInPeriod = countWorkDays(year, month, feiertage, ytdCutoff);
  let targetMin: number;
  if (ytdCutoff) {
    targetMin = workDaysInPeriod * 8 * 60;
  } else {
    const monthsInPeriod = month != null ? 1 : 12;
    targetMin = targetHoursPerMonth * monthsInPeriod * 60;
  }
  const diffMin = workedMin + ndMin - targetMin;

  return {
    workedMin, workedMinPure, paidAbsenceMin,
    ndMin, ndCount, ndPaid,
    urlaubDays, urlaubMin, krankDays, krankMin,
    feiertagDays, arbeitenEntries,
    workDaysInPeriod,
    diffMin, targetMin,
  };
}
