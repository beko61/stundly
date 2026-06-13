import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Preise",
  description: "Stundly Preispläne — Einzelperson €5,99 · Team €19,99 · Unternehmen €49,99 / Monat. Während Beta 3 Monate komplett kostenlos.",
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
