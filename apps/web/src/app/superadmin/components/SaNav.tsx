"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/superadmin",           label: "Kokpit",        short: "Kokpit",   icon: "📊" },
  { href: "/superadmin/users",     label: "Kullanıcılar",  short: "Kişiler",  icon: "👥" },
  { href: "/superadmin/companies", label: "Firmalar",      short: "Firmalar", icon: "🏢" },
  { href: "/superadmin/audit",     label: "İşlem geçmişi", short: "Geçmiş",   icon: "🧾" },
  { href: "/superadmin/create",    label: "Hesap oluştur", short: "Yeni",     icon: "➕" },
];

function isActive(path: string, href: string) {
  return href === "/superadmin" ? path === href : path.startsWith(href);
}

/** Desktop: Sidebar-Links · Mobil: feste Tab-Leiste unten */
export function SaNav({ variant }: { variant: "side" | "bottom" }) {
  const path = usePathname() ?? "";
  return (
    <nav className={variant === "side" ? "sa-side-nav" : "sa-bottom-nav"} aria-label="Admin-Navigation">
      {ITEMS.map((it) => {
        const active = isActive(path, it.href);
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
