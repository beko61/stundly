import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Anmelden",
  description: "Melde dich in deinem Stundly-Konto an, um deine Arbeitszeit, Urlaub und Lohnberechnung zu verwalten.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
