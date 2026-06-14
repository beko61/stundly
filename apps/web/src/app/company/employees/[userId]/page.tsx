import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCompanyAdminContext, netMinutesForEntry, formatMinutes } from "@/lib/company/admin";

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const WEEKDAYS_SHORT = ["So","Mo","Di","Mi","Do","Fr","Sa"];

const STATUS_LABEL: Record<string, string> = {
  arbeiten:  "Arbeit",
  urlaub:    "Urlaub",
  krank:     "Krank",
  feiertag:  "Feiertag",
  notdienst: "Notdienst",
  frei:      "Frei",
};
const STATUS_ICON: Record<string, string> = {
  arbeiten:"✓", urlaub:"🏖", krank:"🤒", notdienst:"🚨", feiertag:"🎉", frei:"—",
};
const STATUS_COLOR: Record<string, string> = {
  arbeiten:  "var(--green)",
  urlaub:    "var(--blue)",
  krank:     "var(--red)",
  feiertag:  "var(--yellow)",
  notdienst: "var(--orange)",
  frei:      "var(--muted)",
};
const VACATION_STATUS: Record<string, { label: string; color: string }> = {
  pending:  { label: "Wartend",   color: "var(--yellow)" },
  approved: { label: "Genehmigt", color: "var(--green)" },
  rejected: { label: "Abgelehnt", color: "var(--red)" },
};

interface Props {
  params:       Promise<{ userId: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function EmployeeDetailPage({ params, searchParams }: Props) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) redirect("/onboarding/type");

  const { admin, companyId } = ctx;
  const { userId } = await params;
  const sp = await searchParams;

  // 1) Çalışan profili — güvenlik: aynı company'de mi?
  const { data: employee } = await admin
    .from("profiles")
    .select("user_id, full_name, email, role, is_active, last_seen_at, company_id, created_at")
    .eq("user_id", userId)
    .single();

  if (!employee || employee.company_id !== companyId) notFound();

  // 2) Ay seçimi
  const now = new Date();
  const year  = parseInt(sp.year  ?? String(now.getFullYear()), 10);
  const month = parseInt(sp.month ?? String(now.getMonth() + 1), 10);
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const lastDay  = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  // 3) Time entries (bu ay)
  const { data: entries } = await admin
    .from("time_entries")
    .select("id, date, start_time, end_time, break_minutes, day_type, note, is_night_shift")
    .eq("user_id", userId)
    .gte("date", firstDay)
    .lte("date", lastDay)
    .order("date", { ascending: true });

  // 4) Tüm Urlaubsanträge (zaman sınırı yok)
  const { data: vacations } = await admin
    .from("vacation_requests")
    .select("id, start_date, end_date, days_count, reason, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  // 5) Aggregate
  const entryMap = new Map((entries ?? []).map((e) => [e.date, e]));
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    const dow = new Date(year, month - 1, dayNum).getDay();
    return { dateStr, dayNum, dow, entry: entryMap.get(dateStr) ?? null };
  });

  const totalMin = (entries ?? []).reduce((s, e) => s + netMinutesForEntry(e), 0);
  const workDays      = (entries ?? []).filter((e) => e.day_type === "arbeiten").length;
  const vacationDays  = (entries ?? []).filter((e) => e.day_type === "urlaub").length;
  const sickDays      = (entries ?? []).filter((e) => e.day_type === "krank").length;
  const targetMin = 174 * 60;
  const diffMin = totalMin - targetMin;

  // Prev/Next ay linkleri
  const prevMonth = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <div>
      {/* Geri link */}
      <Link
        href="/company/employees"
        style={{
          fontSize: 12, color: "var(--muted)", textDecoration: "none",
          display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12,
        }}
      >
        ← Zurück zur Mitarbeiterliste
      </Link>

      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        marginBottom: 28, gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>
            {employee.full_name ?? employee.email ?? "–"}
          </h1>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            {employee.email}
            {" · "}{employee.role === "company_admin" ? "Admin" : "Mitarbeiter"}
            {" · "}<span style={{ color: employee.is_active ? "var(--green)" : "var(--red)" }}>
              {employee.is_active ? "Aktiv" : "Deaktiviert"}
            </span>
            {employee.last_seen_at && (
              <> · Zuletzt aktiv: {new Date(employee.last_seen_at).toLocaleDateString("de-DE")}</>
            )}
          </div>
        </div>

        {/* Ay nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link href={`/company/employees/${userId}?year=${prevMonth.y}&month=${prevMonth.m}`}
                className="btn" style={{ padding: "6px 10px", fontSize: 12 }}>
            ‹
          </Link>
          <div style={{ fontSize: 14, fontWeight: 700, minWidth: 130, textAlign: "center" }}>
            {MONTHS[month - 1]} {year}
          </div>
          <Link href={`/company/employees/${userId}?year=${nextMonth.y}&month=${nextMonth.m}`}
                className="btn" style={{ padding: "6px 10px", fontSize: 12 }}>
            ›
          </Link>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Gesamt",     value: formatMinutes(totalMin),   color: "var(--accent2)" },
          { label: "Soll",       value: formatMinutes(targetMin),  color: "var(--text)" },
          { label: "Differenz",  value: `${diffMin >= 0 ? "+" : "−"}${formatMinutes(Math.abs(diffMin))}`,
            color: diffMin >= 0 ? "var(--green)" : "var(--red)" },
          { label: "Arbeitstage", value: workDays,     color: "var(--text)" },
          { label: "Urlaub",      value: vacationDays, color: "var(--blue)" },
          { label: "Krank",       value: sickDays,     color: "var(--red)" },
        ].map((stat) => (
          <div key={stat.label} className="card" style={{ padding: "14px" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Tage Tabelle (read-only) */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
        Arbeitszeit · {MONTHS[month - 1]} {year}
      </h2>
      <div className="card" style={{ padding: 0, marginBottom: 32, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
                {["Datum","Tag","Status","Start","Ende","Pause","Stunden"].map((h) => (
                  <th key={h} style={{
                    textAlign: "left", padding: "10px 14px",
                    fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const e = d.entry;
                const dt = e?.day_type ?? null;
                const isWeekend = d.dow === 0 || d.dow === 6;
                const nm = e ? netMinutesForEntry(e) : 0;

                return (
                  <tr key={d.dateStr} style={{
                    borderBottom: "1px solid var(--border)",
                    background: isWeekend && !e ? "rgba(255,255,255,0.015)" : "transparent",
                    opacity: isWeekend && !e ? 0.55 : 1,
                  }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700 }}>
                      {String(d.dayNum).padStart(2, "0")}.{String(month).padStart(2, "0")}.
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--muted)" }}>{WEEKDAYS_SHORT[d.dow]}</td>
                    <td style={{ padding: "10px 14px" }}>
                      {dt ? (
                        <span style={{ color: STATUS_COLOR[dt] ?? "var(--muted)", fontWeight: 700 }}>
                          {STATUS_ICON[dt] ?? "?"} {STATUS_LABEL[dt] ?? dt}
                        </span>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px" }}>{e?.start_time?.slice(0, 5) ?? "—"}</td>
                    <td style={{ padding: "10px 14px" }}>{e?.end_time?.slice(0, 5) ?? "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      {e?.break_minutes != null && e.break_minutes > 0
                        ? `${e.break_minutes}m`
                        : "—"}
                    </td>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: nm > 0 ? "var(--accent2)" : "var(--muted)" }}>
                      {nm > 0 ? formatMinutes(nm) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Urlaubsanträge */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
        Urlaubsanträge
      </h2>
      {(vacations?.length ?? 0) === 0 ? (
        <div className="card" style={{ padding: 24, color: "var(--muted)", fontSize: 13 }}>
          Noch keine Urlaubsanträge.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(vacations ?? []).map((v) => {
            const st = VACATION_STATUS[v.status] ?? { label: v.status, color: "var(--muted)" };
            return (
              <div key={v.id} className="card" style={{
                padding: "14px 18px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                gap: 12, flexWrap: "wrap",
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    {new Date(v.start_date).toLocaleDateString("de-DE")} – {new Date(v.end_date).toLocaleDateString("de-DE")}
                    {" · "}{v.days_count} Tage
                  </div>
                  {v.reason && (
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                      „{v.reason}"
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                    Eingereicht: {new Date(v.created_at).toLocaleDateString("de-DE")}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 8,
                  background: `color-mix(in srgb, ${st.color} 14%, transparent)`,
                  color: st.color,
                  border: `1px solid color-mix(in srgb, ${st.color} 30%, transparent)`,
                }}>
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
