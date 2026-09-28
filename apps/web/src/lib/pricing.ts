/**
 * Preise — EINE Quelle für Landing, /pricing, SEO-Seiten und E-Mails.
 *
 * Regulär ab Beta-Ende (Tag nach BETA_END_DATE). Beta-Tester (Registrierung bis
 * BETA_END_DATE) zahlen dauerhaft 50 % weniger — Entscheidung des Inhabers 28.09.2026.
 * Keine Streichpreise verwenden: die regulären Preise wurden noch nie verlangt
 * (UWG § 5 / PAngV § 11) — immer als Text "regulär X €, für Beta-Tester Y €".
 * Kleinunternehmer (§ 19 UStG): Endpreise, keine Umsatzsteuer.
 */

import { BETA_END_DATE } from "./beta";

export type PaidPlanId = "individual" | "team" | "business";

export const BETA_DISCOUNT_PCT = 50;

export const PLAN_PRICES: Record<PaidPlanId, { name: string; monthly: number; yearly: number; beta: number }> = {
  individual: { name: "Einzelperson", monthly: 5.99,  yearly: 59,  beta: 2.99 },
  team:       { name: "Team",         monthly: 19.99, yearly: 199, beta: 9.99 },
  business:   { name: "Unternehmen",  monthly: 49.99, yearly: 499, beta: 24.99 },
};

/** "5,99 €" */
export function euro(v: number): string {
  return `${v.toFixed(2).replace(".", ",")} €`;
}

/** Erster Tag mit regulären Preisen, z. B. "01.04.2027" */
export const PAID_START_LABEL = (() => {
  const d = new Date(`${BETA_END_DATE}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
})();

/** Einheitlicher Satz für alle Seiten */
export const BETA_PRICE_LINE =
  `Danach für Beta-Tester dauerhaft ${BETA_DISCOUNT_PCT} % günstiger: ab ${euro(PLAN_PRICES.individual.beta)}/Monat ` +
  `(regulär ab ${euro(PLAN_PRICES.individual.monthly)})`;
