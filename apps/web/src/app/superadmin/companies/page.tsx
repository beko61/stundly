import { createClient as createAdmin } from "@supabase/supabase-js";

export default async function SuperAdminCompaniesPage() {
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: companies } = await admin
    .from("companies")
    .select("id, name, country_code, bundesland, city, vat_id, max_employees, created_at, owner_id")
    .order("created_at", { ascending: false });

  const { data: subscriptions } = await admin
    .from("subscriptions")
    .select("company_id, plan, status");

  const subMap = new Map(subscriptions?.map(s => [s.company_id, s]) ?? []);

  const planLabels: Record<string, string> = { trial: "Testphase", individual: "Einzelperson", team: "Team", business: "Unternehmen" };
  const statusColors: Record<string, string> = { active: "var(--green)", trialing: "var(--yellow)", canceled: "var(--red)", past_due: "var(--orange)" };

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Alle Unternehmen</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>{companies?.length ?? 0} Unternehmen registriert</p>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Unternehmen", "Stadt", "Land", "USt-IdNr.", "Plan", "Status", "Max. MA", "Seit"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: "var(--muted)", fontWeight: 600, fontSize: 10, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(companies ?? []).map((c, i) => {
              const sub = subMap.get(c.id);
              return (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700 }}>{c.name}</td>
                  <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{c.city ?? "–"}</td>
                  <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{c.country_code}</td>
                  <td style={{ padding: "10px 12px", color: "var(--muted)", fontFamily: "monospace", fontSize: 11 }}>{c.vat_id ?? "–"}</td>
                  <td style={{ padding: "10px 12px" }}>{planLabels[sub?.plan ?? "trial"]}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ color: statusColors[sub?.status ?? "trialing"] ?? "var(--muted)", fontWeight: 700, fontSize: 11 }}>
                      {sub?.status ?? "–"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>{c.max_employees}</td>
                  <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{new Date(c.created_at).toLocaleDateString("de-DE")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
