import type { Metadata } from "next";
import { FREE_UNTIL_TEXT } from "@/lib/beta";

export const metadata: Metadata = {
  title: "Kostenlos starten",
  description: `Erstelle dein Stundly-Konto. ${FREE_UNTIL_TEXT} — keine Kreditkarte erforderlich.`,
  alternates: { canonical: "/register" },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
