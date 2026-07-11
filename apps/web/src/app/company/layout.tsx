import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const navItems = [
  { href: "/company/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/company/employees", label: "Mitarbeiter", icon: "👥" },
  { href: "/company/reports", label: "Berichte", icon: "📋" },
  { href: "/company/audit", label: "Audit-Log", icon: "🔒" },
  { href: "/company/billing", label: "Abonnement", icon: "💳" },
];

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, company_id, is_active, deleted_at, must_change_password")
    .eq("user_id", user.id)
    .single();

  // Soft-delete / deaktiviert / must_change_password gate
  if (profile?.deleted_at) {
    await supabase.auth.signOut();
    redirect("/login?blocked=deleted");
  }
  if (profile?.is_active === false) {
    await supabase.auth.signOut();
    redirect("/login?blocked=inactive");
  }
  if (profile?.must_change_password) {
    redirect("/password-change");
  }

  if (profile?.role !== "company_admin" && profile?.role !== "super_admin") {
    redirect("/tracker");
  }

  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", profile.company_id)
    .single();

  return (
    <div style={{ display: "flex", minHeight: "100dvh", background: "var(--bg)" }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: "var(--surface)", borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", padding: "20px 0",
        position: "sticky", top: 0, height: "100dvh",
      }}>
        <div style={{ padding: "0 20px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ color: "var(--accent2)", fontWeight: 800, fontSize: 14, letterSpacing: 2 }}>STUNDLY</div>
          <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>Admin-Panel</div>
          {company && (
            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: "var(--text)", wordBreak: "break-word" }}>
              {company.name}
            </div>
          )}
        </div>

        <nav style={{ flex: 1, padding: "16px 12px" }}>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 10, marginBottom: 4,
              fontSize: 13, fontWeight: 600, color: "var(--muted)",
              textDecoration: "none",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--surface2)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--text)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--muted)"; }}
            >
              <span>{item.icon}</span> {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ padding: "16px 12px", borderTop: "1px solid var(--border)" }}>
          <Link href="/tracker" style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", borderRadius: 10,
            fontSize: 12, color: "var(--muted)", textDecoration: "none",
          }}>
            ← Zur App
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: "32px 28px", overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
}
