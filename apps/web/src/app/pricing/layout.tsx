import type { Metadata } from "next";
import { BETA_END_DATE_LABEL } from "@/lib/beta";
import { PLAN_PRICES, euro } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Preise",
  description: `Stundly Preispläne — Einzelperson ${euro(PLAN_PRICES.individual.monthly)} · Team ${euro(PLAN_PRICES.team.monthly)} · Unternehmen ${euro(PLAN_PRICES.business.monthly)} / Monat. Während der Beta bis ${BETA_END_DATE_LABEL} komplett kostenlos.`,
  alternates: { canonical: "/pricing" },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
