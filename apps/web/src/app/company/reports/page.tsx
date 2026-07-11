import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCompanyAdminContext, netMinutesForEntry, formatMinutes } from "@/lib/company/admin";
import { EmployeeExportButtons, BulkCsvButton, DatevBulkButton } from "./ReportExportButtons";

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

interface Props {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function CompanyReportsPage({ searchParams }: Props) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) redirect("/onboarding/type");
  const { admin, companyId } = ctx;

  const sp = await searchParams;
  const now = new Date();
  const rawYear  = parseInt(sp.year  ?? "", 10);
  const rawMonth = parseInt(sp.month ?? "", 10);
  const year  = Number.isInteger(rawYear)  && rawYear  >= 2020 && rawYear  <= 2100 ? rawYear  : now.getFullYear();
  const month = Number.isInteger(rawMonth) && rawMonth >= 1    && rawMonth <= 12   ? rawMonth : now.getMonth() + 1;

  const daysIn = new Date(year, month, 0).getDate();
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay  = `${year}-${String(month).padStart(2, "0")}-${String(daysIn).padStart(2, "0")}`;

  const { data: employees } = await admin
    .from("profiles")
    .select("user_id, full_name, email, personal_nr")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("nachname", { ascending: true });

  if (!employees) notFound();
  const userIds = employees.map(e => e.user_id);

  const { data: timeEntries } = userIds.length > 0
    ? await admin
        .from("time_entries")
        .select("user_id, date, start_time, end_time, break_minutes, day_type")
        .in("user_id", userIds)
        .gte("date", firstDay).lte("date", lastDay)
    : { data: [] };

  const { data: ndEntries } = userIds.length > 0
    ? await admin
        .from("notdienst_entries")
        .select("user_id, date, start_time, end_time, erledigt")
        .in("user_id", userIds)
        .gte("date", firstDay).lte("date", lastDay)
    : { data: [] };

  const summaries = employees.map(emp => {
    const entries = (timeEntries ?? []).filter(e => e.user_id === emp.user_id);
    const nd      = (ndEntries  ?? []).filter(n => n.user_id === emp.user_id);
    const workMin = entries.reduce((s, e) =>
      s + netMinutesForEntry({
        date: e.date,
        start_time: e.start_time,
        end_time: e.end_time,
        break_minutes: e.break_minutes,
        day_type: e.day_type,
      }), 0);
    const ndMin = nd.reduce((s, n) => {
      if (!n.start_time || !n.end_time) return s;
      const [sh, sm] = n.start_time.split(":").map(Number);
      const [eh, em] = n.end_time.split(":").map(Number);
      let m = (eh * 60 + em) - (sh * 60 + sm);
      if (m < 0) m += 24 * 60;
      return s + Math.max(0, m);
    }, 0);
    return {
      ...emp,
      workMin, ndMin,
      arbeitstage: entries.filter(e => e.day_type === "arbeiten").length,
      urlaubstage: entries.filter(e => e.day_type === "urlaub").length,
      kranktage:   entries.filter(e => e.day_type === "krank").length,
      ndCount: nd.length,
      ndPaid:  nd.filter(n => n.erledigt).length,
    };
  });

  const totalWork = summaries.reduce((s, e) => s + e.workMin, 0);
  const totalNd   = summaries.reduce((s, e) => s + e.ndMin,   0);

  const prev = month === 1  ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1  } : { y: year, m: month + 1 };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 4px 60px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, gap: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, letterSpacing: "0.08em" }}>
            UNTERNEHMENSBERICHTE
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>Monatsauswertung</h1>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <DatevBulkButton year={year} month={month} />
          <BulkCsvButton year={year} month={month} />
        </div>
      </div>

      {/* Month nav */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        marginBottom: 22, padding: "10px 14px",
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 12,
      }}>
        <Link href={`/company/reports?year=${prev.y}&month=${prev.m}`}
          className="btn" style={{ padding: "6px 10px", fontSize: 12 }}>‹</Link>
        <div style={{ flex: 1, textAlign: "center", fontSize: 15, fontWeight: 700 }}>
          {MONTHS[month - 1]} {year}
        </div>
        <Link href={`/company/reports?year=${next.y}&month=${next.m}`}
          className="btn" style={{ padding: "6px 10px", fontSize: 12 }}>›</Link>
      </div>

      {/* Totals */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        <div style={kpiCard}>
          <div style={kpiLabel}>MITARBEITER</div>
          <div style={kpiValue("var(--text)")}>{employees.length}</div>
        </div>
        <div style={kpiCard}>
          <div style={kpiLabel}>GESAMT</div>
          <div style={kpiValue("var(--accent2)")}>{formatMinutes(totalWork)}</div>
        </div>
        <div style={kpiCard}>
          <div style={kpiLabel}>NOTDIENST</div>
          <div style={kpiValue("var(--blue)")}>{formatMinutes(totalNd)}</div>
        </div>
      </div>

      {/* Employee list */}
      {summaries.length === 0 ? (
        <div className="card" style={{ padding: 28, textAlign: "center", color: "var(--muted)" }}>
          Keine aktiven Mitarbeiter gefunden.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {summaries.map(emp => (
            <div key={emp.user_id} className="card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <Link href={`/company/employees/${emp.user_id}?year=${year}&month=${month}`}
                  style={{ textDecoration: "none", color: "inherit", flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                    {emp.full_name ?? "—"}
                    {emp.personal_nr && (
                      <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8, fontWeight: 500 }}>
                        Nr. {emp.personal_nr}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{emp.email}</div>
                </Link>
                <EmployeeExportButtons
                  userId={emp.user_id} fullName={emp.full_name ?? "Mitarbeiter"}
                  year={year} month={month}
                />
              </div>

              <div style={{
                display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8,
                marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)",
              }}>
                <Stat label="Arbeit"     value={formatMinutes(emp.workMin)} color="var(--accent2)" />
                <Stat label="Arbeitstage" value={emp.arbeitstage}             color="var(--text)" />
                <Stat label="Urlaub"     value={emp.urlaubstage}              color="var(--blue)" />
                <Stat label="Krank"      value={emp.kranktage}                color="var(--red)" />
                <Stat label="Notdienst"  value={emp.ndCount > 0 ? `${emp.ndCount} (${emp.ndPaid}b)` : "—"} color="var(--blue)" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* GoBD note */}
      <div style={{
        marginTop: 24, padding: "12px 14px",
        background: "color-mix(in srgb, var(--muted) 8%, transparent)",
        border: "1px solid var(--border)", borderRadius: 10,
        fontSize: 11, color: "var(--muted)", lineHeight: 1.6,
      }}>
        PDF und CSV enthalten Tagesdetails, Notdienst-Übersicht und Unterschriftfelder
        gemäß GoBD-Empfehlungen. Generierungszeitpunkt wird im Dokument vermerkt.
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, letterSpacing: "0.04em" }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color, marginTop: 2, fontFamily: "'DM Mono',monospace" }}>
        {value}
      </div>
    </div>
  );
}

const kpiCard: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 12, padding: "12px 14px",
};
const kpiLabel: React.CSSProperties = {
  fontSize: 10, color: "var(--muted)", fontWeight: 700, letterSpacing: "0.06em",
};
const kpiValue = (color: string): React.CSSProperties => ({
  fontSize: 18, fontWeight: 700, color, marginTop: 4, fontFamily: "'DM Mono',monospace",
});
