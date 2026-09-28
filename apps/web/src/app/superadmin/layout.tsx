import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SaNav } from "./components/SaNav";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role, must_change_password").eq("user_id", user.id).single();

  if (profile?.role !== "super_admin") redirect("/tracker");
  if (profile?.must_change_password) redirect("/password-change");

  return (
    <div className="sa-shell">
      <aside className="sa-side">
        <div style={{ padding: "0 20px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ color: "var(--accent2)", fontWeight: 800, fontSize: 14, letterSpacing: 2 }}>STUNDLY</div>
          <div className="sa-badge">SÜPER ADMIN</div>
        </div>
        <SaNav variant="side" />
        <div style={{ padding: "16px 12px", borderTop: "1px solid var(--border)" }}>
          <Link href="/tracker" className="sa-back">← Uygulamaya dön</Link>
        </div>
      </aside>

      <div className="sa-topbar">
        <span style={{ color: "var(--accent2)", fontWeight: 800, letterSpacing: 2, fontSize: 13 }}>STUNDLY</span>
        <span className="sa-badge" style={{ marginTop: 0 }}>SÜPER ADMIN</span>
        <Link href="/tracker" className="sa-back" style={{ marginLeft: "auto", padding: 0 }}>Uygulama →</Link>
      </div>

      <main className="sa-main">{children}</main>

      <SaNav variant="bottom" />
    </div>
  );
}
