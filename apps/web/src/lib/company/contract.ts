/**
 * Vertragsdaten eines Firmen-Mitarbeiters (profiles.contract_*, Migration 033).
 * Reine Funktionen — client- und serverseitig nutzbar.
 */

export interface Contract {
  weekly_hours:  number | null;
  vacation_days: number | null;
  start_date:    string | null;
}

/** Monatliche Soll-Stunden aus Wochenstunden: × 52 Wochen / 12 Monate, auf 2 Stellen. 40 h → 173,33 h. */
export function monthlyTargetFromWeekly(weekly: number): number {
  return Math.round((weekly * 52 / 12) * 100) / 100;
}

/** Hat die Firma überhaupt Vertragsdaten gesetzt? */
export function hasContract(c: Contract | null | undefined): c is Contract {
  return !!c && (c.weekly_hours != null || c.vacation_days != null || c.start_date != null);
}

/** Aus einer profiles-Zeile (Spalten evtl. noch nicht vorhanden → null). */
export function contractFromProfile(row: Record<string, unknown> | null | undefined): Contract | null {
  if (!row) return null;
  const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
  const c: Contract = {
    weekly_hours:  num(row["contract_weekly_hours"]),
    vacation_days: num(row["contract_vacation_days"]),
    start_date:    (row["contract_start"] as string | null | undefined) ?? null,
  };
  return hasContract(c) ? c : null;
}

/**
 * Lohn-Einstellungen mit den Vertragswerten überschreiben — die Firma hat Vorrang
 * (auch vor einem veralteten localStorage-Stand des Mitarbeiters).
 */
export function applyContract<T extends { monthly_target_hours: number; urlaub_anspruch?: number | null }>(
  settings: T,
  contract: Contract | null | undefined,
): T {
  if (!contract) return settings;
  const next = { ...settings };
  if (contract.weekly_hours != null)  next.monthly_target_hours = monthlyTargetFromWeekly(contract.weekly_hours);
  if (contract.vacation_days != null) next.urlaub_anspruch = contract.vacation_days;
  if (contract.start_date != null && "employment_start_date" in next) {
    (next as T & { employment_start_date: string | null }).employment_start_date = contract.start_date;
  }
  return next;
}
