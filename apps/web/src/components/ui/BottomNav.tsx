"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Mobile BottomNav — gleiche Tab-Leiste wie im Firmen-Panel (sa-bottom-nav):
 * alle Bereiche direkt erreichbar, keine Untermenüs.
 */
const ITEMS = [
  { href: "/dashboard", label: "Start",    icon: "🏠" },
  { href: "/tracker",   label: "Zeit",     icon: "⏱" },
  { href: "/vacation",  label: "Urlaub",   icon: "🏖" },
  { href: "/salary",    label: "Gehalt",   icon: "💰" },
  { href: "/reports",   label: "Berichte", icon: "📊" },
  { href: "/settings",  label: "Profil",   icon: "⚙️" },
];

function isRouteActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

export function BottomNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="sa-bottom-nav" aria-label="Navigation" style={{ zIndex: 100 }}>
      {ITEMS.map((it) => {
        const active = isRouteActive(pathname, it.href);
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined} className={active ? "active" : undefined}>
            <span aria-hidden="true">{it.icon}</span>
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
