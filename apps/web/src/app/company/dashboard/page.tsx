import { redirect } from "next/navigation";
import Link from "next/link";
import { getCompanyAdminContext, netMinutesForEntry, formatMinutes } from "@/lib/company/admin";
import {
  findDailyCapViolations,
  calcKrankheitEpisodes,
  ENTGFG_KRANKHEIT_LIMIT_DAYS,
  calcAnnualEntitlement,
  calcUrlaubskonto,
} from "@workly/shared";
import type { TimeEntry } from "@workly/shared";

// v0.33.0: dashboard komple redesign — patronun günlük iş akışına odaklı.
// HEUTE-Ansicht + Compliance-Warnings + Mitarbeiter-Übersicht eklendi.

const DAY_TYPE_LABEL: Record<string, string> = {
  arbeiten:  "Arbeitet",
  urlaub:    "Urlaub",
  krank:     "Krank",
  feiertag:  "Feiertag",
  notdienst: "Notdienst",
  frei:      "Frei",
};
const DAY_TYPE_ICON: Record<string, string> = {
  arbeiten: "🟢", urlaub: "🏖", krank: "🤒", feiertag: "🎉", notdienst: "🚨", frei: "⚪",
};
const DAY_TYPE_COLOR: Record<string, string> = {
  arbeiten:  "var(--green)",
  urlaub:    "var(--blue)",
  krank:     "var(--red)",
  feiertag:  "var(--yellow)",
  notdienst: "var(--orange)",
  frei:      "var(--muted)",
};

export default async function CompanyDashboardPage() {
  const ctx = await getCompanyAdminContext();
  if (!ctx) redirect("/onboarding/type");

  const { admin, companyId, profile } = ctx;

  const { data: company } = await admin
    .from("companies")
    .select("name, bundesland, max_employees")
    .eq("id", companyId)
    .single();

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
    .select("user_id, full_name, email, is_active")
    .eq("company_id", companyId)
    .is("deleted_at", null);

  const activeEmployees = (employees ?? []).filter((e) => e.is_active);
  const userIds = activeEmployees.map((e) => e.user_id);

  // Zaman aralıkları
  const now       = new Date();
  const todayISO  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const firstDay  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]!;
  const yearStart = `${now.getFullYear()}-01-01`;
  const yearEnd   = `${now.getFullYear()}-12-31`;

  // Bu ayın time_entries kayıtları (team)
  const { data: monthEntries } = userIds.length > 0
    ? await admin
        .from("time_entries")
        .select("id, user_id, date, start_time, end_time, break_minutes, day_type, is_night_shift, note")
        .in("user_id", userIds)
        .gte("date", firstDay)
        .lte("date", lastDay)
    : { data: [] as TimeEntry[] };

  // Yılın time_entries — compliance ve Urlaub sayacı için
  const { data: yearEntries } = userIds.length > 0
    ? await admin
        .from("time_entries")
        .select("id, user_id, date, start_time, end_time, break_minutes, day_type, is_night_shift")
        .in("user_id", userIds)
        .gte("date", yearStart)
        .lte("date", yearEnd)
    : { data: [] as TimeEntry[] };

  // Notdienst bu ay (bonus + Übersicht için)
  const { data: monthNdEntries } = userIds.length > 0
    ? await admin
        .from("notdienst_entries")
        .select("user_id, date")
        .in("user_id", userIds)
        .gte("date", firstDay)
        .lte("date", lastDay)
    : { data: [] };

  // Salary settings — Urlaubsanspruch/Zwölftelung/Verfall için
  const { data: salarySettings } = userIds.length > 0
    ? await admin
        .from("salary_settings")
        .select("user_id, urlaub_anspruch, employment_start_date, employment_end_date, urlaub_carry_over")
        .in("user_id", userIds)
    : { data: [] };

  // Her user için en son salary_settings (multi-satır → user_id başına ilk)
  const salaryMap = new Map<string, {
    urlaub_anspruch: number;
    employment_start_date: string | null;
    employment_end_date: string | null;
    urlaub_carry_over: number;
  }>();
  for (const s of salarySettings ?? []) {
    if (!salaryMap.has(s.user_id)) {
      salaryMap.set(s.user_id, {
        urlaub_anspruch:        Number(s.urlaub_anspruch ?? 30),
        employment_start_date:  (s.employment_start_date as string | null) ?? null,
        employment_end_date:    (s.employment_end_date   as string | null) ?? null,
        urlaub_carry_over:      Number(s.urlaub_carry_over ?? 0),
      });
    }
  }

  // İsim map + pending Urlaub map
  const nameMap = new Map<string, string>();
  for (const e of employees ?? []) {
    nameMap.set(e.user_id, e.full_name ?? e.email ?? "—");
  }

  // Pending Urlaub sayacı per user
  const { data: pendingVacationsAll } = userIds.length > 0
    ? await admin
        .from("vacation_requests")
        .select("id, user_id, start_date, end_date, days_count, created_at")
        .in("user_id", userIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
    : { data: [] };
  const pendingByUser = new Map<string, number>();
  for (const v of pendingVacationsAll ?? []) {
    pendingByUser.set(v.user_id, (pendingByUser.get(v.user_id) ?? 0) + 1);
  }

  // Pending davetler
  const { count: pendingInvites } = await admin
    .from("invitations")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "pending");

  // Team month totals
  const teamTotalMin = (monthEntries ?? []).reduce((sum, e) => sum + netMinutesForEntry(e), 0);

  // ─────────────────────────────────────────────────────────────
  // Per-employee aggregates
  // ─────────────────────────────────────────────────────────────
  type MonthEntry = {
    id: string; user_id: string; date: string;
    start_time: string | null; end_time: string | null;
    break_minutes: number | null;
    day_type: string | null; is_night_shift: boolean | null;
    note: string | null;
  };

  interface EmployeeStats {
    userId:                string;
    name:                  string;
    todayEntry:            MonthEntry | null;
    monthWorkedMin:        number;
    monthUrlaubDays:       number;
    monthKrankDays:        number;
    monthNotdienstDays:    number;
    pendingUrlaub:         number;
    // Compliance
    dailyCapViolations:    string[];
    krankheitOverLimitDays: number;
    urlaubRemaining:       number;
    verfallWarning:        boolean;
    verfallDaysUntil:      number;
    verfallCarryOver:      number;
  }

  const stats: EmployeeStats[] = activeEmployees.map((emp) => {
    const uid = emp.user_id;
    const monthE = (monthEntries ?? []).filter((e) => e.user_id === uid);
    const yearE  = (yearEntries  ?? []).filter((e) => e.user_id === uid);
    const ndE    = (monthNdEntries ?? []).filter((n) => n.user_id === uid);

    const today = monthE.find((e) => e.date === todayISO) ?? null;
    const monthWorkedMin = monthE.reduce((s, e) => s + netMinutesForEntry(e), 0);
    const monthUrlaub    = monthE.filter((e) => e.day_type === "urlaub").length;
    const monthKrank     = monthE.filter((e) => e.day_type === "krank").length;
    const monthNd        = ndE.length;
    const pending        = pendingByUser.get(uid) ?? 0;

    // §3 ArbZG 10h cap
    const capViolations = findDailyCapViolations(monthE).map((v) => v.date);

    // §3 EntgFG 6 Wochen (yıllık entries)
    const episodes = calcKrankheitEpisodes(yearE);
    const krankheitOverLimit = episodes
      .filter((ep) => ep.days > ENTGFG_KRANKHEIT_LIMIT_DAYS)
      .reduce((s, ep) => s + ep.excessDates.length, 0);

    // Urlaubskonto (Zwölftelung + Verfall)
    const settings = salaryMap.get(uid) ?? {
      urlaub_anspruch: 30,
      employment_start_date: null,
      employment_end_date: null,
      urlaub_carry_over: 0,
    };
    const entitlement = calcAnnualEntitlement({
      annualAnspruch:  settings.urlaub_anspruch,
      employmentStart: settings.employment_start_date,
      employmentEnd:   settings.employment_end_date,
      year:            now.getFullYear(),
    });
    const usedThisYear = yearE.filter((e) => e.day_type === "urlaub").length;
    const konto = calcUrlaubskonto({
      thisYearEntitlement:   entitlement.anspruch,
      thisYearUsed:          usedThisYear,
      previousYearRemaining: settings.urlaub_carry_over,
      refDate:               todayISO,
      year:                  now.getFullYear(),
    });

    return {
      userId:                 uid,
      name:                   nameMap.get(uid) ?? "—",
      todayEntry:             today,
      monthWorkedMin,
      monthUrlaubDays:        monthUrlaub,
      monthKrankDays:         monthKrank,
      monthNotdienstDays:     monthNd,
      pendingUrlaub:          pending,
      dailyCapViolations:     capViolations,
      krankheitOverLimitDays: krankheitOverLimit,
      urlaubRemaining:        konto.remaining,
      verfallWarning:         konto.verfallWarning,
      verfallDaysUntil:       konto.daysUntilVerfall,
      verfallCarryOver:       konto.carryOverAvailable,
    };
  });

  // Sırala: bugün ARBEITEN önce, sonra alfabetik
  stats.sort((a, b) => {
    const aWorking = a.todayEntry?.day_type === "arbeiten" ? 0 : 1;
    const bWorking = b.todayEntry?.day_type === "arbeiten" ? 0 : 1;
    if (aWorking !== bWorking) return aWorking - bWorking;
    return a.name.localeCompare(b.name, "de");
  });

  // Compliance flat lists
  const capViolatorEmployees   = stats.filter((s) => s.dailyCapViolations.length > 0);
  const krankLimitEmployees    = stats.filter((s) => s.krankheitOverLimitDays > 0);
  const verfallEmployees       = stats.filter((s) => s.verfallWarning);
  const complianceCount        = capViolatorEmployees.length + krankLimitEmployees.length + verfallEmployees.length;

  // ─────────────────────────────────────────────────────────────
  // Meta
  // ─────────────────────────────────────────────────────────────
  const planLabels: Record<string, string> = {
    trial:      "Kostenlose Testphase",
    individual: "Einzelperson",
    team:       "Team",
    business:   "Unternehmen",
  };
  const trialEnd      = subscription?.trial_end ? new Date(subscription.trial_end) : null;
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

      {/* KPI kartları */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Aktive Mitarbeiter",         value: activeEmployees.length,            icon: "👥", color: "var(--blue)" },
          { label: `Team-Stunden · ${monthName}`, value: formatMinutes(teamTotalMin),      icon: "⏱",  color: "var(--accent2)" },
          { label: "Offene Einladungen",         value: pendingInvites ?? 0,               icon: "✉️", color: "var(--yellow)" },
          { label: "Offene Urlaubsanträge",      value: pendingByUser.size,                icon: "🏖", color: "var(--orange)" },
        ].map((stat) => (
          <div key={stat.label} className="card" style={{ padding: "20px" }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>{stat.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: stat.color, marginBottom: 4 }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────
          HEUTE-Ansicht
          ───────────────────────────────────────────────────────── */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
        Heute · {now.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" })}
      </h2>
      {stats.length === 0 ? (
        <div className="card" style={{ padding: "18px 22px", color: "var(--muted)", fontSize: 13, marginBottom: 32 }}>
          Noch keine aktiven Mitarbeiter — <Link href="/company/employees" style={{ color: "var(--accent2)" }}>Mitarbeiter hinzufügen →</Link>
        </div>
      ) : (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 10, marginBottom: 32,
        }}>
          {stats.map((s) => {
            const t = s.todayEntry;
            const dt = t?.day_type ?? "frei";
            const color = DAY_TYPE_COLOR[dt] ?? "var(--muted)";
            const icon  = DAY_TYPE_ICON[dt]  ?? "⚪";
            const label = t ? (DAY_TYPE_LABEL[dt] ?? dt) : "Kein Eintrag";
            const timeRange = t && t.day_type === "arbeiten" && t.start_time && t.end_time
              ? `${t.start_time.slice(0, 5)} – ${t.end_time.slice(0, 5)}`
              : null;
            return (
              <Link
                key={s.userId}
                href={`/company/employees/${s.userId}`}
                className="card"
                style={{
                  padding: "14px 16px",
                  borderLeft: `3px solid ${color}`,
                  textDecoration: "none", color: "var(--text)",
                  display: "flex", flexDirection: "column", gap: 4,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.name}
                  </span>
                </div>
                <div style={{ fontSize: 12, color, fontWeight: 600 }}>{label}</div>
                {timeRange && (
                  <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "'DM Mono',monospace" }}>{timeRange}</div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          Compliance-Warnings
          ───────────────────────────────────────────────────────── */}
      {complianceCount > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
            ⚠️ Compliance-Hinweise
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {capViolatorEmployees.length > 0 && (
              <div
                className="card"
                style={{
                  padding: "14px 18px",
                  background: "color-mix(in srgb, var(--red) 8%, var(--surface))",
                  border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--red)", marginBottom: 6 }}>
                  🚫 §3 ArbZG — 10h/Tag überschritten
                </div>
                {capViolatorEmployees.map((s) => (
                  <div key={s.userId} style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
                    <Link href={`/company/employees/${s.userId}`} style={{ color: "var(--text)", fontWeight: 600 }}>
                      {s.name}
                    </Link>
                    {" · "}{s.dailyCapViolations.length} Tag{s.dailyCapViolations.length === 1 ? "" : "e"} ({monthName})
                    {" — "}{s.dailyCapViolations.slice(0, 3).map((d) => d.slice(8)).join(", ")}
                    {s.dailyCapViolations.length > 3 && ` +${s.dailyCapViolations.length - 3}`}
                  </div>
                ))}
              </div>
            )}
            {krankLimitEmployees.length > 0 && (
              <div
                className="card"
                style={{
                  padding: "14px 18px",
                  background: "color-mix(in srgb, var(--red) 8%, var(--surface))",
                  border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--red)", marginBottom: 6 }}>
                  🩺 §3 EntgFG — Lohnfortzahlung endet (6 Wochen)
                </div>
                {krankLimitEmployees.map((s) => (
                  <div key={s.userId} style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
                    <Link href={`/company/employees/${s.userId}`} style={{ color: "var(--text)", fontWeight: 600 }}>
                      {s.name}
                    </Link>
                    {" · "}{s.krankheitOverLimitDays} Tag{s.krankheitOverLimitDays === 1 ? "" : "e"} über Limit — Krankengeld
                  </div>
                ))}
              </div>
            )}
            {verfallEmployees.length > 0 && (
              <div
                className="card"
                style={{
                  padding: "14px 18px",
                  background: "color-mix(in srgb, var(--orange) 8%, var(--surface))",
                  border: "1px solid color-mix(in srgb, var(--orange) 30%, transparent)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--orange)", marginBottom: 6 }}>
                  ⏳ §7 III BUrlG — Urlaubs­übertrag verfällt bald
                </div>
                {verfallEmployees.map((s) => (
                  <div key={s.userId} style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
                    <Link href={`/company/employees/${s.userId}`} style={{ color: "var(--text)", fontWeight: 600 }}>
                      {s.name}
                    </Link>
                    {" · "}{s.verfallCarryOver} Tag{s.verfallCarryOver === 1 ? "" : "e"} verfallen in {s.verfallDaysUntil} Tagen (31.03.)
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          Mitarbeiter-Übersicht tablosu
          ───────────────────────────────────────────────────────── */}
      {stats.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
            Mitarbeiter-Übersicht · {monthName}
          </h2>
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left",  padding: "12px 14px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Mitarbeiter</th>
                  <th style={{ textAlign: "right", padding: "12px 14px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Arbeitszeit</th>
                  <th style={{ textAlign: "right", padding: "12px 14px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Urlaub übrig</th>
                  <th style={{ textAlign: "right", padding: "12px 14px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Krank</th>
                  <th style={{ textAlign: "right", padding: "12px 14px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Notdienst</th>
                  <th style={{ textAlign: "right", padding: "12px 14px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pending</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s, idx) => (
                  <tr
                    key={s.userId}
                    style={{ borderBottom: idx === stats.length - 1 ? "none" : "1px solid var(--border)" }}
                  >
                    <td style={{ padding: "12px 14px" }}>
                      <Link
                        href={`/company/employees/${s.userId}`}
                        style={{ color: "var(--text)", fontWeight: 600, textDecoration: "none" }}
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "'DM Mono',monospace" }}>
                      {formatMinutes(s.monthWorkedMin)}
                    </td>
                    <td style={{
                      padding: "12px 14px", textAlign: "right", fontFamily: "'DM Mono',monospace",
                      color: s.urlaubRemaining < 0 ? "var(--red)" : "inherit",
                    }}>
                      {s.urlaubRemaining} T
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "'DM Mono',monospace" }}>
                      {s.monthKrankDays > 0
                        ? <span style={{ color: "var(--red)" }}>{s.monthKrankDays} T</span>
                        : <span style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "'DM Mono',monospace" }}>
                      {s.monthNotdienstDays > 0
                        ? <span style={{ color: "var(--orange)" }}>{s.monthNotdienstDays}×</span>
                        : <span style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      {s.pendingUrlaub > 0 ? (
                        <span style={{
                          display: "inline-block", padding: "2px 8px", borderRadius: 999,
                          background: "color-mix(in srgb, var(--yellow) 20%, transparent)",
                          color: "var(--yellow)", fontSize: 11, fontWeight: 700,
                        }}>
                          {s.pendingUrlaub}
                        </span>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Plan info + Quick Actions */}
      <div style={{ marginBottom: 20, fontSize: 12, color: "var(--muted)" }}>
        Plan: <span style={{ color: "var(--text)", fontWeight: 700 }}>{planLabels[subscription?.plan ?? "trial"] ?? "–"}</span>
        {" · "}Max. Mitarbeiter: <span style={{ color: "var(--text)", fontWeight: 700 }}>{company?.max_employees ?? "–"}</span>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Schnellaktionen</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {[
          { href: "/company/employees", icon: "➕", label: "Mitarbeiter verwalten", desc: "Neue anlegen, deaktivieren, löschen" },
          { href: "/company/reports",   icon: "📋", label: "Berichte anzeigen",     desc: "Monatsauswertung + PDF/CSV" },
          { href: "/company/billing",   icon: "💳", label: "Abonnement verwalten",  desc: "Plan ändern, Rechnungen" },
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
