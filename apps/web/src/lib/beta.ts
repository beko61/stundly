/**
 * Beta-Phase Konfiguration.
 *
 * Während BETA_MODE = true:
 *   - Pricing-Seite zeigt nur eine "Kostenlos starten" CTA, keine Pläne.
 *   - /api/stripe/checkout liefert 403.
 *   - Landing-Banner: "3 Monate 100% kostenlos – alle Funktionen".
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

/** 3 Monate Beta-Phase: Stundly Live 07.06.2026 → Beta endet 07.09.2026 */
export const BETA_END_DATE = "2026-09-07";

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
