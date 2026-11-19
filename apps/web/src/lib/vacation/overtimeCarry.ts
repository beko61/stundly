/**
 * Überstunden-Übertrag ins neue Jahr (Nutzerwunsch 19.11.2026: "automatisch + korrigierbar").
 *
 * Je Jahr kann in den Lohn-Einstellungen (Zeile dieses Jahres, lib/salary/byYear) ein Übertrag in
 * Stunden stehen (Migration 044, salary_settings.ueberstunden_uebertrag):
 *   - gesetzt  → dieser Wert gilt (z. B. Firma hat einen Teil ausgezahlt)
 *   - leer     → automatisch: Saldo des Vorjahres + dessen eigener (gesetzter) Übertrag
 * Eine Stelle für Urlaub ("aus Überstunden"), Berichte ("Gesamt Überstunden") und Gehalt (Vorschlag).
 */
import { ownRowForYear, type VersionedRow } from "@/lib/salary/byYear";

export interface CarryRow extends VersionedRow {
  ueberstunden_uebertrag?: number | string | null;
}

/** Vom Nutzer gesetzter Übertrag für genau dieses Jahr (Stunden) — sonst null */
export function manualCarryHours(rows: readonly CarryRow[] | null | undefined, year: number): number | null {
  const v = ownRowForYear(rows, year)?.ueberstunden_uebertrag;
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export interface OvertimeCarry {
  /** gilt für das Jahr (Minuten) */
  carryMin: number;
  /** automatischer Vorschlag (Minuten) */
  autoMin: number;
  /** Nutzer hat den Wert selbst gesetzt */
  manual: boolean;
}

/** prevYearDiffMin = Saldo des Vorjahres (calcOvertimeToDate über das ganze Vorjahr) */
export function overtimeCarry(rows: readonly CarryRow[] | null | undefined, year: number, prevYearDiffMin: number): OvertimeCarry {
  const prevManual = manualCarryHours(rows, year - 1);
  const autoMin = Math.round(prevYearDiffMin + (prevManual ?? 0) * 60);
  const own = manualCarryHours(rows, year);
  return own !== null
    ? { carryMin: Math.round(own * 60), autoMin, manual: true }
    : { carryMin: autoMin, autoMin, manual: false };
}
