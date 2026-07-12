import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { computeMrrTrend, type SubscriptionRow } from "@/lib/utils/mrrTrend";
import { RevenueChart } from "./components/RevenueChart";

export default async function SuperAdminDashboard() {
  const supabase = await createClient();

  // Service role ile tüm verilere eriş
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [
    { count: totalCompanies },
    { count: totalUsers },
    { data: subscriptions },
  ] = await Promise.all([
    admin.from("companies").select("*", { count: "exact", head: true }),
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("subscriptions").select("plan, status, currency, created_at, canceled_at"),
  ]);

  const activeSubs = subscriptions?.filter(s => s.status === "active") ?? [];
  const trialSubs = subscriptions?.filter(s => s.status === "trialing") ?? [];

  const planPrices: Record<string, number> = { individual: 9.99, team: 29.99, business: 79.99 };
  const mrr = activeSubs.reduce((sum, s) => sum + (planPrices[s.plan] ?? 0), 0);

  // MRR trend — son 12 ay
  const mrrTrend = computeMrrTrend((subscriptions ?? []) as SubscriptionRow[], 12);

  // Son 5 şirket
  const { data: recentCompanies } = await admin
    .from("companies")
    .select("id, name, country_code, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  const stats = [
    { label: "Unternehmen gesamt", value: totalCompanies ?? 0, icon: "🏢", color: "var(--blue)" },
    { label: "Benutzer gesamt", value: totalUsers ?? 0, icon: "👥", color: "var(--accent2)" },
    { label: "Aktive Abonnements", value: activeSubs.length, icon: "✅", color: "var(--green)" },
    { label: "In Testphase", value: trialSubs.length, icon: "🔄", color: "var(--yellow)" },
    { label: "MRR (netto)", value: `€${mrr.toFixed(2)}`, icon: "💶", color: "var(--green)" },
    { label: "ARR (netto)", value: `€${(mrr * 12).toFixed(2)}`, icon: "📈", color: "var(--accent2)" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Super Admin Dashboard</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 32 }}>Gesamtübersicht aller Kunden und Umsätze</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
        {stats.map(stat => (
          <div key={stat.label} className="card" style={{ padding: "20px" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{stat.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* MRR trend chart — son 12 ay */}
      <div style={{ marginBottom: 32 }}>
        <RevenueChart data={mrrTrend} />
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Neueste Unternehmen</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Unternehmen", "Land", "Registriert"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: "var(--muted)", fontWeight: 600, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(recentCompanies ?? []).map((c, i) => (
              <tr key={c.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                <td style={{ padding: "12px 14px", fontWeight: 600 }}>{c.name}</td>
                <td style={{ padding: "12px 14px", color: "var(--muted)" }}>{c.country_code}</td>
                <td style={{ padding: "12px 14px", color: "var(--muted)" }}>{new Date(c.created_at).toLocaleDateString("de-DE")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
