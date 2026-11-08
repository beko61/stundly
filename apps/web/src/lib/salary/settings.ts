/**
 * Gehaltseinstellungen + Notdienst-Abrechnungsmonat — gemeinsam für Gehalt und Dashboard,
 * damit beide denselben Brutto-Betrag zeigen (calculateMonthlySalary aus @workly/shared).
 */
import type { SalarySettings, Steuerklasse, KirchensteuerRate, TaxMode } from "@workly/shared";

/** DB-Zeile (numeric kommt teils als String) → typisierte Einstellungen */
export function salarySettingsFromRow(row: SalarySettings): SalarySettings {
  return {
    id:                       row.id,
    user_id:                  row.user_id,
    valid_from:               row.valid_from,
    hourly_rate:              Number(row.hourly_rate),
    overtime_rate_multiplier: Number(row.overtime_rate_multiplier),
    night_shift_bonus:        Number(row.night_shift_bonus),
    notdienst_bonus:          Number(row.notdienst_bonus),
    monthly_target_hours:     Number(row.monthly_target_hours),
    steuerklasse:             (row.steuerklasse as Steuerklasse | null) ?? "I",
    kirchensteuer:            (Number(row.kirchensteuer ?? 0) as KirchensteuerRate),
    hat_kinder:               Boolean(row.hat_kinder ?? false),
    tax_mode:                 (row.tax_mode as TaxMode | null) ?? "auto",
    manuell_abzug:            Number(row.manuell_abzug ?? 0),
    urlaub_anspruch:          Number(row.urlaub_anspruch ?? 30),
    sfn_enabled:              Boolean(row.sfn_enabled ?? false),
    employment_start_date:    row.employment_start_date ?? null,
    employment_end_date:      row.employment_end_date   ?? null,
    urlaub_carry_over:        Number(row.urlaub_carry_over ?? 0),
  };
}

/** Stundenlohn wirklich eingetragen? (sonst kein geschätztes Brutto mit Platzhalter-Lohn) */
export function hasHourlyRate(row: SalarySettings | null | undefined): boolean {
  return !!row && Number(row.hourly_rate) > 0;
}

/** Notdienste im Brutto eines Monats = die des VORMONATS (Januar: Dezember des Vorjahres) */
export function notdienstDaysForBilling(ndDates: readonly string[], billingYear: number, billingMonth: number): number {
  const prevMonth = billingMonth === 1 ? 12 : billingMonth - 1;
  const prevYear  = billingMonth === 1 ? billingYear - 1 : billingYear;
  const prefix    = `${prevYear}-${String(prevMonth).padStart(2, "0")}-`;
  return ndDates.filter(d => d.startsWith(prefix)).length;
}
