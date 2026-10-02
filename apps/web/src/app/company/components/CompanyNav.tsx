"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/company/dashboard", label: "Übersicht",   short: "Start",    icon: "📊", mobile: true },
  { href: "/company/employees", label: "Mitarbeiter", short: "Team",     icon: "👥", mobile: true },
  { href: "/company/notdienst", label: "Notdienst",   short: "Notdienst", icon: "🚨", mobile: true },
  { href: "/company/lohn",      label: "Lohn",        short: "Lohn",     icon: "💶", mobile: true },
  { href: "/company/reports",   label: "Berichte",    short: "Berichte", icon: "📋", mobile: true },
  { href: "/company/firmendaten", label: "Firmendaten", short: "Firma",  icon: "🏢", mobile: false },
  { href: "/company/billing",   label: "Abonnement",  short: "Abo",      icon: "💳", mobile: false },
  { href: "/company/audit",     label: "Audit-Log",   short: "Log",      icon: "🔒", mobile: false },
];

/**
 * Client-Komponente: Hover/aktiv per CSS (sa-*-Klassen). Event-Handler in der
 * Server-Layout-Datei führten zu einem Render-Fehler ("Event handlers cannot be
 * passed to Client Component props").
 * Desktop: Sidebar-Links · Mobil: feste Tab-Leiste unten (Audit-Log über die Übersicht)
 */
export function CompanyNav({ variant }: { variant: "side" | "bottom" }) {
  const path = usePathname() ?? "";
  const items = variant === "side" ? ITEMS : ITEMS.filter((it) => it.mobile);
  return (
    <nav className={variant === "side" ? "sa-side-nav" : "sa-bottom-nav"} aria-label="Firmen-Navigation">
      {items.map((it) => {
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
