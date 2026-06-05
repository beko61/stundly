"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/tracker",  label: "Tracker",  icon: "⏱" },
  { href: "/calendar", label: "Kalender", icon: "📅" },
  { href: "/salary",   label: "Gehalt",   icon: "💰" },
  { href: "/vacation", label: "Urlaub",   icon: "🏖" },
  { href: "/settings", label: "Profil",   icon: "⚙️" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav style={{
      position:      "fixed",
      bottom:        0,
      left:          0,
      right:         0,
      background:    "rgba(15,15,19,0.95)",
      backdropFilter:"blur(12px)",
      borderTop:     "1px solid var(--border)",
      display:       "flex",
      padding:       "10px 8px 20px",
      gap:           6,
      paddingBottom: "max(20px, env(safe-area-inset-bottom))",
      zIndex:        100,
    }}>
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              flex:           1,
              display:        "flex",
              flexDirection:  "column",
              alignItems:     "center",
              justifyContent: "center",
              padding:        "8px 4px",
              gap:            3,
              textDecoration: "none",
              color:          active ? "white" : "var(--muted)",
              background:     active ? "var(--accent)" : "var(--surface)",
              border:         `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
              borderRadius:   12,
              transition:     "all 0.2s",
              textTransform:  "uppercase",
              letterSpacing:  "0.05em",
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>{item.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 700 }}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
