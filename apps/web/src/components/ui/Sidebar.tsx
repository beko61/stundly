"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const BASE_NAV = [
  { href: "/tracker",  label: "Tracker",  icon: "⏱" },
  { href: "/calendar", label: "Kalender", icon: "📅" },
  { href: "/salary",   label: "Gehalt",   icon: "💰" },
  { href: "/vacation", label: "Urlaub",   icon: "🏖" },
  { href: "/reports",  label: "Berichte", icon: "📊" },
  { href: "/settings", label: "Profil",   icon: "⚙️" },
];

const TEAM_NAV   = { href: "/team",       label: "Mein Team",    icon: "👥" };
const ADMIN_NAV  = { href: "/superadmin", label: "Admin Panel",  icon: "🛡" };

type Role = "individual" | "employee" | "company_admin" | "super_admin" | null;

export function Sidebar() {
  const pathname  = usePathname();
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState<Role>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const name = session.user.user_metadata?.["full_name"] as string | undefined;
      setUserName(name ?? session.user.email ?? "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();
      setRole((profile?.role as Role) ?? "individual");
    }
    void load();
  }, []);

  async function handleLogout() {
    await createClient().auth.signOut();
    window.location.href = "/login";
  }

  // Role-aware nav
  const navItems = [
    ...BASE_NAV,
    ...(role === "company_admin" ? [TEAM_NAV] : []),
  ];

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <span className="sidebar-logo">W</span>
        <span className="sidebar-title">WORKLY</span>
      </div>

      {/* Super admin badge */}
      {role === "super_admin" && (
        <div style={{ padding: "0 12px 8px" }}>
          <Link
            href="/superadmin"
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 12px", borderRadius: 10, textDecoration: "none",
              background: "color-mix(in srgb, var(--red) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--red) 25%, transparent)",
              color: "var(--red)", fontSize: 12, fontWeight: 700,
            }}
          >
            <span>{ADMIN_NAV.icon}</span> {ADMIN_NAV.label}
          </Link>
        </div>
      )}

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const isTeam = item.href === "/team";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${active ? "active" : ""}`}
              style={isTeam ? {
                borderTop: "1px solid var(--border)",
                marginTop: 8,
                paddingTop: 14,
              } : undefined}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {userName && (
          <div className="sidebar-user">
            <div className="sidebar-avatar">{userName.charAt(0).toUpperCase()}</div>
            <span className="sidebar-user-name">{userName}</span>
          </div>
        )}
        {role && role !== "individual" && role !== "employee" && (
          <div style={{ padding: "4px 12px 0", marginBottom: 4 }}>
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
        <div className="sidebar-version">Workly v0.1.0</div>
      </div>
    </aside>
  );
}
