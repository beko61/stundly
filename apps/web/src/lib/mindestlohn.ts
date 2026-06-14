/**
 * Almanya gesetzlicher Mindestlohn (€/Stunde).
 *
 * Quelle: Mindestlohnkommission Beschluss vom 27. Juni 2025
 *   2026: 13,90 €/Stunde (1. Januar 2026)
 *   2027: 14,60 €/Stunde (1. Januar 2027)
 *
 * Wird verwendet als:
 *   - Default-Wert für neue Stundenlohn-Eingaben (statt willkürlich 15 €)
 *   - Hint-Label unter dem Stundenlohn-Feld
 *   - Validation-Untergrenze (geplant: ArbZG-Warnung wenn Eingabe < Mindestlohn)
 */

const MINDESTLOHN_BY_YEAR: Record<number, number> = {
  2024: 12.41,
  2025: 12.82,
  2026: 13.90,
  2027: 14.60,
};

/** Aktuelles Jahr → Mindestlohn. Fallback auf neuestes bekanntes Jahr. */
export function currentMindestlohn(now: Date = new Date()): number {
  const year = now.getFullYear();
  if (MINDESTLOHN_BY_YEAR[year] != null) return MINDESTLOHN_BY_YEAR[year]!;
  // Bilinmeyen yıl: en son bilinen yılı kullan
  const years = Object.keys(MINDESTLOHN_BY_YEAR).map(Number).sort((a, b) => b - a);
  return MINDESTLOHN_BY_YEAR[years[0]!]!;
}

/** Label gösterimi: "13,90 €" (DE locale, virgüllü). */
export function formatMindestlohn(value: number = currentMindestlohn()): string {
  return value.toFixed(2).replace(".", ",") + " €";
}

export const MINDESTLOHN_CURRENT = currentMindestlohn();
