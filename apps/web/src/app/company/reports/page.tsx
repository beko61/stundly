import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function CompanyReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("company_id").eq("user_id", user.id).single();

  if (!profile?.company_id) redirect("/company/dashboard");

  // Bu ay çalışan verilerini çek
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const { data: employees } = await supabase
    .from("profiles")
    .select("user_id, full_name, email")
    .eq("company_id", profile.company_id)
    .eq("is_active", true);

  const employeeIds = employees?.map(e => e.user_id) ?? [];

  const { data: timeEntries } = employeeIds.length > 0
    ? await supabase
      .from("time_entries")
      .select("user_id, date, start_time, end_time, break_minutes, day_type")
      .in("user_id", employeeIds)
      .gte("date", firstDay)
      .lte("date", lastDay)
    : { data: [] };

  // Her çalışan için toplam saat hesapla
  const summaries = employees?.map((emp) => {
    const entries = (timeEntries ?? []).filter(e => e.user_id === emp.user_id);
    const totalMinutes = entries.reduce((sum, e) => {
      if (!e.start_time || !e.end_time) return sum;
      const [sh, sm] = e.start_time.split(":").map(Number);
      const [eh, em] = e.end_time.split(":").map(Number);
      let mins = (eh * 60 + em) - (sh * 60 + sm);
      if (mins < 0) mins += 24 * 60; // gece vardiyası
      return sum + Math.max(0, mins - (e.break_minutes ?? 0));
    }, 0);

    return {
      ...emp,
      totalHours: (totalMinutes / 60).toFixed(1),
      workDays: entries.filter(e => e.day_type === "arbeiten").length,
      vacationDays: entries.filter(e => e.day_type === "urlaub").length,
      sickDays: entries.filter(e => e.day_type === "krank").length,
    };
  }) ?? [];

  const monthName = now.toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Berichte</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 28 }}>
        Arbeitszeitauswertung aller Mitarbeiter – {monthName}
      </p>

      {summaries.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
          Keine Mitarbeiter gefunden.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Mitarbeiter", "Arbeitsstunden", "Arbeitstage", "Urlaub", "Krank"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: "var(--muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaries.map((emp, i) => (
                <tr key={emp.user_id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontWeight: 700 }}>{emp.full_name ?? "–"}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{emp.email}</div>
                  </td>
                  <td style={{ padding: "12px 14px", fontWeight: 700, color: "var(--accent2)" }}>{emp.totalHours}h</td>
                  <td style={{ padding: "12px 14px" }}>{emp.workDays}</td>
                  <td style={{ padding: "12px 14px", color: "var(--blue)" }}>{emp.vacationDays}</td>
                  <td style={{ padding: "12px 14px", color: "var(--red)" }}>{emp.sickDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
