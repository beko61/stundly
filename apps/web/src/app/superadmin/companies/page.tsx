import { adminClient } from "@/lib/superadmin/auth";
import CompaniesTable, { type CompanyRow } from "./CompaniesTable";

export default async function SuperAdminCompaniesPage() {
  const admin = adminClient();

  const [{ data: companies }, { data: subscriptions }, { data: members }] = await Promise.all([
    admin.from("companies")
      .select("id, name, country_code, city, vat_id, max_employees, created_at, owner_id")
      .order("created_at", { ascending: false }),
    admin.from("subscriptions").select("company_id, plan, status, stripe_subscription_id"),
    admin.from("profiles").select("user_id, email, full_name, role, company_id").not("company_id", "is", null),
  ]);

  const subMap = new Map((subscriptions ?? []).map((s) => [s.company_id as string, s]));
  const byCompany = new Map<string, NonNullable<typeof members>>();
  for (const m of members ?? []) {
    const k = m.company_id as string;
    byCompany.set(k, [...(byCompany.get(k) ?? []), m]);
  }

  const rows: CompanyRow[] = (companies ?? []).map((c) => {
    const list = byCompany.get(c.id as string) ?? [];
    const owner = list.find((m) => m.user_id === c.owner_id) ?? list.find((m) => m.role === "company_admin");
    const sub = subMap.get(c.id as string);
    return {
      id:            c.id as string,
      name:          c.name as string,
      city:          (c.city as string | null) ?? null,
      country:       (c.country_code as string | null) ?? null,
      vatId:         (c.vat_id as string | null) ?? null,
      maxEmployees:  (c.max_employees as number | null) ?? null,
      createdAt:     c.created_at as string,
      plan:          (sub?.plan as string | undefined) ?? "trial",
      status:        (sub?.status as string | undefined) ?? null,
      paidStripe:    !!sub?.stripe_subscription_id && ["active", "past_due", "trialing"].includes(String(sub?.status)),
      ownerEmail:    (owner?.email as string | null | undefined) ?? null,
      memberCount:   list.length,
      superAdminMembers: list.filter((m) => m.role === "super_admin").length,
    };
  });

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Alle Unternehmen</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>{rows.length} Unternehmen registriert</p>
      <CompaniesTable initialRows={rows} />
    </div>
  );
}
