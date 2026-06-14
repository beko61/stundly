"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect, type CSSProperties } from "react";

/**
 * Mobile BottomNav — 4 slot:
 *   1. Start              → /dashboard
 *   2. Zeit (grup)        → tıklayınca açılır: Zeit, Urlaub, Kalender
 *   3. Berichte (grup)    → tıklayınca açılır: Berichte, Gehalt
 *   4. Profil             → /settings
 *
 * Grup butonu açıkken: alt seçenekler buton üstünden yukarı doğru bir popover olarak gösterilir.
 * Outside-click / ESC / route değişimi popover'ı kapatır.
 */

type NavLink  = { type: "link"; href: string; label: string; icon: string };
type NavChild = { href: string; label: string; icon: string };
type NavGroup = { type: "group"; id: string; label: string; icon: string; children: NavChild[] };
type NavItem  = NavLink | NavGroup;

const NAV_ITEMS: NavItem[] = [
  { type: "link", href: "/dashboard", label: "Start", icon: "🏠" },
  {
    type: "group",
    id: "zeit",
    label: "Zeit",
    icon: "⏱",
    children: [
      { href: "/tracker",  label: "Zeit",     icon: "⏱"  },
      { href: "/vacation", label: "Urlaub",   icon: "🏖" },
      { href: "/calendar", label: "Kalender", icon: "📅" },
    ],
  },
  {
    type: "group",
    id: "berichte",
    label: "Berichte",
    icon: "📊",
    children: [
      { href: "/reports", label: "Berichte", icon: "📊" },
      { href: "/salary",  label: "Gehalt",   icon: "💰" },
    ],
  },
  { type: "link", href: "/settings", label: "Profil", icon: "⚙️" },
];

function isRouteActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

function buttonStyle(active: boolean): CSSProperties {
  return {
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
    cursor:         "pointer",
    fontFamily:     "inherit",
    width:          "100%",
  };
}

export function BottomNav() {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const wrapRef = useRef<HTMLElement>(null);

  // Outside click + ESC kapanış
  useEffect(() => {
    if (!openGroup) return;
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenGroup(null);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [openGroup]);

  // Route değişince popover'ı kapat
  useEffect(() => { setOpenGroup(null); }, [pathname]);

  return (
    <nav ref={wrapRef} style={{
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
        if (item.type === "link") {
          const active = isRouteActive(pathname, item.href);
          return (
            <div key={item.href} style={{ flex: 1 }}>
              <Link href={item.href} style={buttonStyle(active)}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>{item.label}</span>
              </Link>
            </div>
          );
        }

        // Group
        const childActive = item.children.some((c) => isRouteActive(pathname, c.href));
        const isOpen      = openGroup === item.id;

        return (
          <div key={item.id} style={{ flex: 1, position: "relative" }}>
            <button
              type="button"
              onClick={() => setOpenGroup(isOpen ? null : item.id)}
              aria-expanded={isOpen}
              aria-haspopup="menu"
              style={buttonStyle(childActive || isOpen)}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>{item.label}</span>
            </button>

            {isOpen && (
              <div
                role="menu"
                style={{
                  position:       "absolute",
                  bottom:         "calc(100% + 8px)",
                  left:           "50%",
                  transform:      "translateX(-50%)",
                  minWidth:       150,
                  background:     "var(--surface)",
                  border:         "1px solid var(--border)",
                  borderRadius:   12,
                  padding:        6,
                  display:        "flex",
                  flexDirection:  "column",
                  gap:            4,
                  boxShadow:      "0 -8px 32px rgba(0,0,0,0.5)",
                  zIndex:         101,
                }}
              >
                {item.children.map((c) => {
                  const active = isRouteActive(pathname, c.href);
                  return (
                    <Link
                      key={c.href}
                      href={c.href}
                      role="menuitem"
                      onClick={() => setOpenGroup(null)}
                      style={{
                        display:        "flex",
                        alignItems:     "center",
                        gap:            10,
                        padding:        "10px 12px",
                        borderRadius:   8,
                        textDecoration: "none",
                        color:          active ? "white" : "var(--text)",
                        background:     active ? "var(--accent)" : "transparent",
                        fontSize:       13,
                        fontWeight:     700,
                        whiteSpace:     "nowrap",
                      }}
                    >
                      <span style={{ fontSize: 16, lineHeight: 1 }}>{c.icon}</span>
                      <span>{c.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
