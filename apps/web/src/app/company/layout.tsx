import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { CompanyNav } from "./components/CompanyNav";

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
    <div className="sa-shell">
      <aside className="sa-side">
        <div style={{ padding: "0 20px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ color: "var(--accent2)", fontWeight: 800, fontSize: 14, letterSpacing: 2 }}>STUNDLY</div>
          <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>Admin-Panel</div>
          {company && (
            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: "var(--text)", wordBreak: "break-word" }}>
              {company.name}
            </div>
          )}
        </div>
        <CompanyNav variant="side" />
        <div style={{ padding: "16px 12px", borderTop: "1px solid var(--border)" }}>
          <Link href="/tracker" className="sa-back">← Zur App</Link>
        </div>
      </aside>

      <div className="sa-topbar">
        <span style={{ color: "var(--accent2)", fontWeight: 800, letterSpacing: 2, fontSize: 13 }}>STUNDLY</span>
        {company && (
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
            {company.name}
          </span>
        )}
        <Link href="/tracker" className="sa-back" style={{ marginLeft: "auto", padding: 0, flexShrink: 0 }}>Zur App →</Link>
      </div>

      <main className="sa-main">{children}</main>

      <CompanyNav variant="bottom" />
    </div>
  );
}
