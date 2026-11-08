/**
 * Urlaubskonto — EINE Rechnung für alle Seiten (Tracker, Urlaub, Dashboard, Gehalt).
 * Früher rechnete jede Seite anders (mit/ohne Zwölftelung, Übertrag, Wochenenden,
 * Sonderurlaub) → "Urlaub übrig" zeigte vier verschiedene Zahlen.
 *
 *   Anspruch  = §5 BUrlG Zwölftelung (Eintritt/Austritt im Jahr) + Übertrag bis 31.03. (§7)
 *   Verbraucht = Erholungsurlaub-Tage Mo–Fr (Sonder-/Bildungsurlaub zählen nicht)
 */
import { calcAnnualEntitlement, calcUrlaubskonto } from "@workly/shared";
import { isWeekday } from "./overtime";
import { zaehltZumUrlaubskonto } from "./urlaubArt";

export const URLAUB_ANSPRUCH_DEFAULT = 30;

export interface UrlaubskontoSettings {
  urlaub_anspruch?: number | string | null;
  employment_start_date?: string | null;
  employment_end_date?: string | null;
  urlaub_carry_over?: number | string | null;
}

export function urlaubskontoFor(input: {
  settings: UrlaubskontoSettings | null | undefined;
  /** Einträge des Jahres (mindestens date, day_type, tags) */
  yearEntries: ReadonlyArray<{ date: string; day_type: string; tags?: string[] | null }>;
  year: number;
  todayISO?: string;
  /** Firmenvertrag hat Vorrang (Urlaubstage, Beschäftigt seit) — wie applyContract */
  contract?: { vacation_days?: number | null; start_date?: string | null } | null | undefined;
}) {
  const c = input.contract;
  const s: UrlaubskontoSettings = {
    ...input.settings,
    ...(c?.vacation_days != null && { urlaub_anspruch: c.vacation_days }),
    ...(c?.start_date != null && { employment_start_date: c.start_date }),
  };
  const entitlement = calcAnnualEntitlement({
    annualAnspruch:  Number(s.urlaub_anspruch) || URLAUB_ANSPRUCH_DEFAULT,
    employmentStart: s.employment_start_date ?? null,
    employmentEnd:   s.employment_end_date ?? null,
    year:            input.year,
  });
  const prefix = `${input.year}-`;
  const usedThisYear = input.yearEntries.filter(
    (e) => e.date.startsWith(prefix) && isWeekday(e.date) && zaehltZumUrlaubskonto(e),
  ).length;
  const konto = calcUrlaubskonto({
    thisYearEntitlement:   entitlement.anspruch,
    thisYearUsed:          usedThisYear,
    previousYearRemaining: Number(s.urlaub_carry_over) || 0,
    refDate:               input.todayISO ?? new Date().toISOString().slice(0, 10),
    year:                  input.year,
  });
  return { entitlement, usedThisYear, konto };
}
