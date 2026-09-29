"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/company/dashboard", label: "Dashboard",   short: "Start",    icon: "📊" },
  { href: "/company/employees", label: "Mitarbeiter", short: "Team",     icon: "👥" },
  { href: "/company/reports",   label: "Berichte",    short: "Berichte", icon: "📋" },
  { href: "/company/audit",     label: "Audit-Log",   short: "Log",      icon: "🔒" },
  { href: "/company/billing",   label: "Abonnement",  short: "Abo",      icon: "💳" },
];

/**
 * Client-Komponente: Hover/aktiv per CSS (sa-*-Klassen). Event-Handler in der
 * Server-Layout-Datei führten zu einem Render-Fehler ("Event handlers cannot be
 * passed to Client Component props").
 * Desktop: Sidebar-Links · Mobil: feste Tab-Leiste unten
 */
export function CompanyNav({ variant }: { variant: "side" | "bottom" }) {
  const path = usePathname() ?? "";
  return (
    <nav className={variant === "side" ? "sa-side-nav" : "sa-bottom-nav"} aria-label="Firmen-Navigation">
      {ITEMS.map((it) => {
        const active = path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined} className={active ? "active" : undefined}>
            <span aria-hidden="true">{it.icon}</span>
            <span>{variant === "side" ? it.label : it.short}</span>
          </Link>
        );
      })}
    </nav>
  );
}
