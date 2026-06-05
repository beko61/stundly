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
 * Calculate full salary breakdown for a list of time entries in a month.
 */
export function calculateMonthlySalary(
  entries: TimeEntry[],
  settings: SalarySettings
): SalaryBreakdown {
  const targetMinutes = settings.monthly_target_hours * 60;
  let regularMinutes = 0;
  let overtimeMinutes = 0;
  let nightShiftMinutes = 0;
  let notdienstDays = 0;

  for (const entry of entries) {
    if (entry.day_type === DAY_TYPES.NOTDIENST) {
      notdienstDays++;
    }

    if (!entry.start_time || !entry.end_time) {
      // Paid absence days count as 8h toward target (German labor law).
      // Urlaub is managed via vacation_requests, not time_entries, so excluded here.
      if (
        entry.day_type === DAY_TYPES.KRANK ||
        entry.day_type === DAY_TYPES.FEIERTAG
      ) {
        regularMinutes += 8 * 60;
      }
      continue;
    }

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
  const normalMinutes      = totalWorkedMinutes - overWorkedMinutes;

  const workedHours   = minutesToHours(totalWorkedMinutes);
  const normalHours   = minutesToHours(normalMinutes);
  const overtimeHours = minutesToHours(overWorkedMinutes);
  const nightHours    = minutesToHours(nightShiftMinutes);

  const base_pay        = normalHours * settings.hourly_rate;
  const overtime_pay    = overtimeHours * settings.hourly_rate * settings.overtime_rate_multiplier;
  const night_bonus     = nightHours * settings.night_shift_bonus;
  const notdienst_bonus = notdienstDays * settings.notdienst_bonus;

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
