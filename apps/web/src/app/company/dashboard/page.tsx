import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function CompanyDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, full_name")
    .eq("user_id", user.id)
    .single();

  const companyId = profile?.company_id;
  if (!companyId) redirect("/onboarding/type");

  // Şirket bilgisi
  const { data: company } = await supabase
    .from("companies")
    .select("name, bundesland, max_employees")
    .eq("id", companyId)
    .single();

  // Abonelik
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, trial_end")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Çalışan sayısı
  const { count: employeeCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("is_active", true);

  // Bekleyen davetler
  const { count: pendingInvites } = await supabase
    .from("invitations")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "pending");

  const planLabels: Record<string, string> = {
    trial: "Kostenlose Testphase",
    individual: "Einzelperson",
    team: "Team",
    business: "Unternehmen",
  };

  const trialEnd = subscription?.trial_end ? new Date(subscription.trial_end) : null;
  const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Willkommen, {profile?.full_name ?? "Admin"}</h1>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Unternehmensübersicht · {company?.name}</p>
      </div>

      {/* Trial Banner */}
      {subscription?.status === "trialing" && trialDaysLeft > 0 && (
        <div style={{
          background: "color-mix(in srgb, var(--accent2) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--accent2) 30%, transparent)",
          borderRadius: 12, padding: "14px 18px", marginBottom: 24,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 13, color: "var(--accent2)", fontWeight: 600 }}>
            🎁 Testphase: noch {trialDaysLeft} Tage kostenlos
          </span>
          <Link href="/company/billing" style={{ fontSize: 12, color: "var(--accent2)", fontWeight: 700, textDecoration: "none" }}>
            Jetzt upgraden →
          </Link>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        {[
          { label: "Aktive Mitarbeiter", value: employeeCount ?? 0, icon: "👥", color: "var(--blue)" },
          { label: "Offene Einladungen", value: pendingInvites ?? 0, icon: "✉️", color: "var(--yellow)" },
          { label: "Aktueller Plan", value: planLabels[subscription?.plan ?? "trial"] ?? "–", icon: "💳", color: "var(--accent2)" },
          { label: "Max. Mitarbeiter", value: company?.max_employees ?? "–", icon: "📊", color: "var(--green)" },
        ].map((stat) => (
          <div key={stat.label} className="card" style={{ padding: "20px" }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>{stat.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: stat.color, marginBottom: 4 }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Schnellaktionen</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {[
          { href: "/company/employees", icon: "➕", label: "Mitarbeiter einladen", desc: "Neues Teammitglied per E-Mail einladen" },
          { href: "/company/reports", icon: "📋", label: "Berichte anzeigen", desc: "Arbeitszeitauswertung aller Mitarbeiter" },
          { href: "/company/billing", icon: "💳", label: "Abonnement verwalten", desc: "Plan ändern, Rechnungen herunterladen" },
        ].map((action) => (
          <Link key={action.href} href={action.href} style={{ textDecoration: "none" }}>
            <div className="card" style={{ padding: "20px", cursor: "pointer" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{action.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{action.label}</div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>{action.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
