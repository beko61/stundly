import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demo · Stundly",
  description: "Stundly live ausprobieren — ohne Konto, ohne Anmeldung. Sieh, wie Zeiterfassung, Lohnberechnung und Urlaubsanträge funktionieren.",
  robots: { index: true, follow: true },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
