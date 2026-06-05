import { createClient as createAdmin } from "@supabase/supabase-js";
import UsersTable from "./UsersTable";

export default async function SuperAdminUsersPage() {
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: users } = await admin
    .from("profiles")
    .select("user_id, full_name, email, role, plan, is_active, company_id, created_at, last_seen_at")
    .order("created_at", { ascending: false })
    .limit(500);

  const roleCounts = (users ?? []).reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  const stats = [
    { label: "Toplam", value: users?.length ?? 0, color: "var(--text)" },
    { label: "Super Admin", value: roleCounts["super_admin"] ?? 0, color: "var(--red)" },
    { label: "Company Admin", value: roleCounts["company_admin"] ?? 0, color: "var(--accent2)" },
    { label: "Employee", value: roleCounts["employee"] ?? 0, color: "var(--blue)" },
    { label: "Individual", value: roleCounts["individual"] ?? 0, color: "var(--green)" },
    { label: "Aktif", value: (users ?? []).filter(u => u.is_active).length, color: "var(--green)" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Kullanıcı Yönetimi</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
        Rol değiştir, aktif/pasif yap, kullanıcı sil
      </p>

      {/* Özet kartlar */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
        {stats.map(s => (
          <div key={s.label} className="card" style={{ padding: "14px 18px", minWidth: 110 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, fontWeight: 600, textTransform: "uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <UsersTable initialUsers={users ?? []} />
    </div>
  );
}
