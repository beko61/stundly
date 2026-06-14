import { redirect } from "next/navigation";
import Link from "next/link";
import { getCompanyAdminContext, netMinutesForEntry, formatMinutes } from "@/lib/company/admin";

export default async function CompanyDashboardPage() {
  const ctx = await getCompanyAdminContext();
  if (!ctx) redirect("/onboarding/type");

  const { admin, companyId, profile } = ctx;

  // Şirket bilgisi
  const { data: company } = await admin
    .from("companies")
    .select("name, bundesland, max_employees")
    .eq("id", companyId)
    .single();

  // Abonelik (son satır)
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("plan, status, current_period_end, trial_end")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Çalışanlar
  const { data: employees } = await admin
    .from("profiles")
    .select("user_id, is_active")
    .eq("company_id", companyId);

  const activeEmployees = (employees ?? []).filter((e) => e.is_active);
  const userIds = activeEmployees.map((e) => e.user_id);

  // Bu ayın time_entries kayıtları — team toplam
  const now = new Date();
  const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const { data: timeEntries } = userIds.length > 0
    ? await admin
        .from("time_entries")
        .select("user_id, date, start_time, end_time, break_minutes, day_type")
        .in("user_id", userIds)
        .gte("date", firstDay)
        .lte("date", lastDay)
    : { data: [] };

  const teamTotalMin = (timeEntries ?? []).reduce((sum, e) => sum + netMinutesForEntry(e), 0);

  // Pending davetler
  const { count: pendingInvites } = await admin
    .from("invitations")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "pending");

  // Pending Urlaubsanträge
  const { data: pendingVacations } = userIds.length > 0
    ? await admin
        .from("vacation_requests")
        .select("id, user_id, start_date, end_date, days_count, created_at")
        .in("user_id", userIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: [] };

  // Pending vacations için isim eşle
  const { data: empNames } = userIds.length > 0
    ? await admin.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
    : { data: [] };
  const nameMap = new Map((empNames ?? []).map((e) => [e.user_id, e.full_name ?? e.email ?? "—"]));

  const planLabels: Record<string, string> = {
    trial:      "Kostenlose Testphase",
    individual: "Einzelperson",
    team:       "Team",
    business:   "Unternehmen",
  };

  const trialEnd = subscription?.trial_end ? new Date(subscription.trial_end) : null;
  const trialDaysLeft = trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const monthName = now.toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
          Willkommen, {profile.full_name ?? "Admin"}
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          Unternehmensübersicht · {company?.name}
        </p>
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

      {/* Stats — primary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Aktive Mitarbeiter",   value: activeEmployees.length, icon: "👥", color: "var(--blue)" },
          { label: `Team-Stunden · ${monthName}`, value: formatMinutes(teamTotalMin), icon: "⏱", color: "var(--accent2)" },
          { label: "Offene Einladungen",   value: pendingInvites ?? 0,    icon: "✉️", color: "var(--yellow)" },
          { label: "Offene Urlaubsanträge", value: pendingVacations?.length ?? 0, icon: "🏖", color: "var(--orange)" },
        ].map((stat) => (
          <div key={stat.label} className="card" style={{ padding: "20px" }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>{stat.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: stat.color, marginBottom: 4 }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Plan info row */}
      <div style={{ marginBottom: 32, fontSize: 12, color: "var(--muted)" }}>
        Plan: <span style={{ color: "var(--text)", fontWeight: 700 }}>{planLabels[subscription?.plan ?? "trial"] ?? "–"}</span>
        {" · "}Max. Mitarbeiter: <span style={{ color: "var(--text)", fontWeight: 700 }}>{company?.max_employees ?? "–"}</span>
      </div>

      {/* Pending Urlaubsanträge listesi */}
      {(pendingVacations?.length ?? 0) > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
            Offene Urlaubsanträge
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(pendingVacations ?? []).map((v) => (
              <Link
                key={v.id}
                href={`/company/employees/${v.user_id}`}
                className="card"
                style={{
                  padding: "14px 18px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  textDecoration: "none", color: "var(--text)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {nameMap.get(v.user_id) ?? "—"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    {new Date(v.start_date).toLocaleDateString("de-DE")} – {new Date(v.end_date).toLocaleDateString("de-DE")}
                    {" · "}{v.days_count} Tage
                  </div>
                </div>
                <span style={{ fontSize: 18, color: "var(--muted)" }}>›</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Schnellaktionen</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {[
          { href: "/company/employees", icon: "➕", label: "Mitarbeiter einladen", desc: "Neues Teammitglied per E-Mail einladen" },
          { href: "/company/reports",   icon: "📋", label: "Berichte anzeigen",   desc: "Arbeitszeitauswertung aller Mitarbeiter" },
          { href: "/company/billing",   icon: "💳", label: "Abonnement verwalten", desc: "Plan ändern, Rechnungen herunterladen" },
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
