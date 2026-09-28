import type { Metadata } from "next";
import { BETA_END_DATE_LABEL } from "@/lib/beta";

export const metadata: Metadata = {
  title: "Kostenlos starten",
  description: `Erstelle dein Stundly-Konto. Während der Beta bis ${BETA_END_DATE_LABEL} komplett kostenlos — keine Kreditkarte erforderlich.`,
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
