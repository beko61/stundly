import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kostenlos starten",
  description: "Erstelle dein Stundly-Konto. Während Beta 3 Monate komplett kostenlos — keine Kreditkarte erforderlich.",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
