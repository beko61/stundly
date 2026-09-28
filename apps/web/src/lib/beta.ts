/**
 * Beta-Phase Konfiguration.
 *
 * Während BETA_MODE = true:
 *   - Pricing-Seite zeigt nur eine "Kostenlos starten" CTA, keine Pläne.
 *   - /api/stripe/checkout liefert 403.
 *   - Landing-Banner: "komplett kostenlos bis <BETA_END_DATE_LABEL>".
 *
 * Texte nennen KEINE feste Dauer ("3 Monate"), sondern immer BETA_END_DATE_LABEL —
 * eine Verlängerung ist damit nur diese eine Datumszeile.
 *   - Welcome-E-Mail erwähnt Beta-Tester-Vorteile.
 *
 * Wenn BETA_MODE = false oder BETA_END_DATE in der Vergangenheit:
 *   - Normale Stripe-Pricing-Seite ist sichtbar, Checkout funktioniert.
 *
 * Wechsel:
 *   - Einfach BETA_MODE auf false setzen (1 Zeile) und alle Beta-Wege
 *     fallen automatisch auf den normalen Flow zurück.
 */

export const BETA_MODE = true;

/** Beta: Live 07.06.2026; ursprünglich bis 07.09.2026, am 28.09.2026 verlängert bis 31.03.2027. */
export const BETA_END_DATE = "2027-03-31";

/** Lokal formatiertes Datum für die UI ("07. September 2026") */
export const BETA_END_DATE_LABEL = new Date(BETA_END_DATE)
  .toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

/** True, wenn die Beta-Phase tatsächlich aktiv ist (Datum berücksichtigt). */
export function isBetaActive(): boolean {
  if (!BETA_MODE) return false;
  return new Date().toISOString().slice(0, 10) <= BETA_END_DATE;
}

/** Verbleibende Tage bis Beta-Ende (für Countdown-Anzeige). */
export function betaDaysRemaining(): number {
  const today = new Date();
  const end   = new Date(BETA_END_DATE);
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000));
}
