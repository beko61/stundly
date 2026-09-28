import type { Metadata } from "next";
import { BETA_END_DATE_LABEL } from "@/lib/beta";

export const metadata: Metadata = {
  title: "Preise",
  description: `Stundly Preispläne — Einzelperson €5,99 · Team €19,99 · Unternehmen €49,99 / Monat. Während der Beta bis ${BETA_END_DATE_LABEL} komplett kostenlos.`,
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
