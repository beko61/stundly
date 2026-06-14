import type { SalarySettings, TimeEntry, MonthSummary } from "../types";
import { DAY_TYPES } from "../constants/dayTypes";
import { calculateWorkDuration, minutesToHours, sumWorkedMinutes } from "./timeCalc";

export interface SalaryBreakdown {
  base_pay: number;
  overtime_pay: number;
  night_shift_bonus: number;
  notdienst_bonus: number;
  total_gross: number;
  worked_hours: number;
  overtime_hours: number;
}

/**
 * Günün gerçek Sollstunden (dakika cinsinden).
 *
 * VEREINFACHTES MODELL (07.06.2026):
 *   Urlaub / Krank / Feiertag werden auf jedem Werktag (Mo-Fr) wie ein
 *   Standard-Arbeitstag 08:00–17:00 mit 1h Pause = 8h netto gezählt.
 *   Sa/So zählen 0. Damit ist die Differenz für den Nutzer leicht
 *   nachvollziehbar (jeder Urlaub-Tag = 8h, kein Mo-Do/Fr-Sonderfall).
 */
function getDayStdMinutes(dateStr: string): number {
  const dow = new Date(dateStr).getDay();
  if (dow === 0 || dow === 6) return 0;
  return 8 * 60;
}

/**
 * Calculate full salary breakdown for a list of time entries in a month.
 *
 * options.notdienstDaysOverride: dışarıdan Notdienst gün sayısı (notdienst_entries
 *   tablosundan sayılmış olarak). Verilirse entries içindeki day_type=NOTDIENST
 *   sayımı yerine bu değer kullanılır.
 *   Önemli: Notdienst genelde bir ay sonra ödendiği için Salary page bunu
 *   ÖNCEKI ay'dan yüklemeli (Ocak Notdienst → Şubat Brutto).
 */
export function calculateMonthlySalary(
  entries: TimeEntry[],
  settings: SalarySettings,
  options?: { notdienstDaysOverride?: number }
): SalaryBreakdown {
  const targetMinutes = settings.monthly_target_hours * 60;
  void targetMinutes; // ileride hour-bazlı kullanım için, şimdilik sadece base_pay = targetHours × rate
  let regularMinutes = 0;
  let overtimeMinutes = 0;
  let nightShiftMinutes = 0;
  let notdienstDays = 0;

  for (const entry of entries) {
    if (entry.day_type === DAY_TYPES.NOTDIENST) {
      notdienstDays++;
      continue;
    }

    // Bezahlte Abwesenheit: IMMER Sollstunden, auch wenn Zeiten gespeichert sind
    // (Fr = 6:15h, Mo-Do = 8:15h). Bisheriger Bug: 8h konstant.
    if (
      entry.day_type === DAY_TYPES.KRANK    ||
      entry.day_type === DAY_TYPES.FEIERTAG ||
      entry.day_type === DAY_TYPES.URLAUB
    ) {
      regularMinutes += getDayStdMinutes(entry.date);
      continue;
    }

    if (entry.day_type === DAY_TYPES.FREI) continue;
    if (!entry.start_time || !entry.end_time) continue;

    // Sadece ARBEITEN gerçek saatler kullanır
    const { net_minutes } = calculateWorkDuration(
      entry.start_time,
      entry.end_time,
      entry.break_minutes
    );

    if (entry.is_night_shift) {
      nightShiftMinutes += net_minutes;
    } else {
      regularMinutes += net_minutes;
    }
  }

  const totalWorkedMinutes = regularMinutes + nightShiftMinutes;
  const overWorkedMinutes  = Math.max(0, totalWorkedMinutes - targetMinutes);

  // Festgehalt-Logik (Almanya KOBİ standardı):
  // - Aylık brutto = Sollstunden × Stundenlohn (sözleşmedeki sabit maaş)
  // - Eğer Mehrarbeit yapılırsa (worked > soll): zuschlag eklenir
  // - Eğer worked < soll: yine tam maaş ödenir (ay tamamlanacak varsayım, Urlaub/Krank Sollstunden'i karşılar)
  const targetHours   = settings.monthly_target_hours;
  const workedHours   = minutesToHours(totalWorkedMinutes);
  const overtimeHours = minutesToHours(overWorkedMinutes);
  const nightHours    = minutesToHours(nightShiftMinutes);

  // Base pay: garantili Festgehalt (Soll-Stunden × Rate)
  const base_pay        = targetHours * settings.hourly_rate;
  // Mehrarbeit ek tutar (multiplier - 1, çünkü baz zaten ödendi)
  const overtime_pay    = overtimeHours * settings.hourly_rate * (settings.overtime_rate_multiplier - 1);
  const night_bonus     = nightHours * settings.night_shift_bonus;
  const effectiveNotdienstDays = options?.notdienstDaysOverride ?? notdienstDays;
  const notdienst_bonus = effectiveNotdienstDays * settings.notdienst_bonus;

  const total_gross = base_pay + overtime_pay + night_bonus + notdienst_bonus;

  return {
    base_pay,
    overtime_pay,
    night_shift_bonus: night_bonus,
    notdienst_bonus,
    total_gross,
    worked_hours:   workedHours,
    overtime_hours: overtimeHours,
  };
}

/**
 * Quick estimate: hourly rate × worked hours (no overtime/bonus breakdown).
 */
export function estimateSalary(workedMinutes: number, hourlyRate: number): number {
  return minutesToHours(workedMinutes) * hourlyRate;
}

/**
 * Build a MonthSummary from a list of time entries.
 */
export function buildMonthSummary(
  year: number,
  month: number,
  entries: TimeEntry[],
  settings: SalarySettings
): MonthSummary {
  const workedMinutes = sumWorkedMinutes(
    entries.filter((e) => e.start_time && e.end_time)
  );
  const targetMinutes = settings.monthly_target_hours * 60;
  const overtimeMinutes = workedMinutes - targetMinutes;

  const countType = (type: string) =>
    entries.filter((e) => e.day_type === type).length;

  const { total_gross } = calculateMonthlySalary(entries, settings);

  return {
    year,
    month,
    total_hours:    minutesToHours(workedMinutes),
    target_hours:   settings.monthly_target_hours,
    overtime_hours: minutesToHours(overtimeMinutes),
    arbeiten_days:  countType(DAY_TYPES.ARBEITEN),
    urlaub_days:    countType(DAY_TYPES.URLAUB),
    krank_days:     countType(DAY_TYPES.KRANK),
    notdienst_days: countType(DAY_TYPES.NOTDIENST),
    feiertag_days:  countType(DAY_TYPES.FEIERTAG),
    frei_days:      countType(DAY_TYPES.FREI),
    estimated_salary: total_gross,
  };
}
