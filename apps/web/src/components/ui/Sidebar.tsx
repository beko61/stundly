"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { STUNDLY_VERSION_LABEL } from "@/lib/version";

type NavItem = { href: string; label: string; icon: string };
type NavGroup = { title: string; items: NavItem[] };

const BASE_GROUPS: NavGroup[] = [
  {
    title: "Übersicht",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "🏠" },
    ],
  },
  {
    title: "Erfassung",
    items: [
      { href: "/tracker",  label: "Zeiterfassung", icon: "⏱" },
      { href: "/calendar", label: "Kalender",      icon: "📅" },
      { href: "/vacation", label: "Urlaub",        icon: "🏖" },
    ],
  },
  {
    title: "Auswertung",
    items: [
      { href: "/salary",  label: "Gehalt",   icon: "💰" },
      { href: "/reports", label: "Berichte", icon: "📊" },
    ],
  },
  {
    title: "Konto",
    items: [
      { href: "/settings", label: "Profil & Settings", icon: "⚙️" },
    ],
  },
];

const TEAM_NAV: NavItem = { href: "/team", label: "Mein Team", icon: "👥" };

type Role = "individual" | "employee" | "company_admin" | "super_admin" | null;

export function Sidebar() {
  const pathname = usePathname();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [role, setRole] = useState<Role>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const name = session.user.user_metadata?.["full_name"] as string | undefined;
      setUserName(name ?? session.user.email ?? "");
      setUserEmail(session.user.email ?? "");

      const { data: profile } = await supabase
        .from("profiles").select("role, vorname").eq("user_id", session.user.id).single();
      setRole((profile?.role as Role) ?? "individual");
      if (profile?.vorname) setUserName(profile.vorname as string);
    }
    void load();
  }, []);

  async function handleLogout() {
    await createClient().auth.signOut();
    window.location.href = "/login";
  }

  // Insert Team into Auswertung group if company_admin
  const groups: NavGroup[] = BASE_GROUPS.map(g => {
    if (g.title === "Auswertung" && role === "company_admin") {
      return { ...g, items: [...g.items, TEAM_NAV] };
    }
    return g;
  });

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <span className="sidebar-logo">S</span>
        <span className="sidebar-title">STUNDLY</span>
      </div>

      {/* Super admin badge */}
      {role === "super_admin" && (
        <div style={{ padding: "10px 12px 0" }}>
          <Link
            href="/superadmin"
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 12px", borderRadius: 8, textDecoration: "none",
              background: "color-mix(in srgb, var(--red) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--red) 25%, transparent)",
              color: "var(--red)", fontSize: 12, fontWeight: 700,
            }}
          >
            <span>🛡</span> Admin Panel
          </Link>
        </div>
      )}

      {/* Navigation */}
      <nav className="sidebar-nav">
        {groups.map((group) => (
          <div key={group.title} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div className="sidebar-group-label">{group.title}</div>
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link ${active ? "active" : ""}`}
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  <span className="sidebar-label">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {userName && (
          <div className="sidebar-user">
            <div className="sidebar-avatar">{userName.charAt(0).toUpperCase()}</div>
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", flex: 1 }}>
              <span className="sidebar-user-name">{userName}</span>
              {userEmail && (
                <span style={{ fontSize: 10, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {userEmail}
                </span>
              )}
            </div>
          </div>
        )}
        {role && role !== "individual" && role !== "employee" && (
          <div style={{ padding: "0 2px" }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1,
              color: role === "super_admin" ? "var(--red)" : "var(--accent2)",
              textTransform: "uppercase",
            }}>
              {role === "super_admin" ? "Super Admin" : "Firma Admin"}
            </span>
          </div>
        )}
        <button onClick={handleLogout} className="sidebar-logout">
          🚪 Abmelden
        </button>
        <div className="sidebar-version">{STUNDLY_VERSION_LABEL}</div>
      </div>
    </aside>
  );
}
