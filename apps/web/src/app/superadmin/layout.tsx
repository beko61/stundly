import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const navItems = [
  { href: "/superadmin",         label: "Dashboard",       icon: "📊" },
  { href: "/superadmin/companies", label: "Unternehmen",   icon: "🏢" },
  { href: "/superadmin/users",   label: "Benutzer",        icon: "👥" },
  { href: "/superadmin/create",  label: "Hesap Oluştur",   icon: "➕" },
];

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("user_id", user.id).single();

  if (profile?.role !== "super_admin") redirect("/tracker");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <aside style={{
        width: 220, flexShrink: 0,
        background: "var(--surface)", borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", padding: "20px 0",
        position: "sticky", top: 0, height: "100vh",
      }}>
        <div style={{ padding: "0 20px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ color: "var(--accent2)", fontWeight: 800, fontSize: 14, letterSpacing: 2 }}>WORKLY</div>
          <div style={{
            marginTop: 8, fontSize: 10, fontWeight: 700, letterSpacing: 1,
            background: "color-mix(in srgb, var(--red) 15%, transparent)",
            color: "var(--red)", padding: "3px 8px", borderRadius: 6, display: "inline-block",
          }}>SUPER ADMIN</div>
        </div>
        <nav style={{ flex: 1, padding: "16px 12px" }}>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 10, marginBottom: 4,
              fontSize: 13, fontWeight: 600, color: "var(--muted)", textDecoration: "none",
            }}>
              <span>{item.icon}</span> {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ padding: "16px 12px", borderTop: "1px solid var(--border)" }}>
          <Link href="/tracker" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", fontSize: 12, color: "var(--muted)", textDecoration: "none" }}>
            ← Zur App
          </Link>
        </div>
      </aside>
      <main style={{ flex: 1, padding: "32px 28px", overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
}
