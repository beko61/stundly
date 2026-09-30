import { redirect } from "next/navigation";
import Link from "next/link";
import { getCompanyAdminContext, netMinutesForEntry, formatMinutes } from "@/lib/company/admin";
import { notdienstBelongsToMonth, notdienstLoadRange } from "@/lib/utils/weekMonth";
import {
  findDailyCapViolations,
  calcKrankheitEpisodes,
  ENTGFG_KRANKHEIT_LIMIT_DAYS,
  calcAnnualEntitlement,
  calcUrlaubskonto,
} from "@workly/shared";
import type { TimeEntry } from "@workly/shared";
import { getFeiertage } from "@/lib/utils/feiertage";
import { checkMonth, type CheckEntry } from "@/lib/company/monthCheck";
import { addDays, berlinNowLocal, restUntil } from "@/lib/company/notdienstZentrale";

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

  // Notdienst bu ay — hafta-Pazar-atfı (±7 gün pay ile fetch, sonra filter)
  const ndRange = notdienstLoadRange(now.getFullYear(), now.getMonth() + 1);
  const { data: monthNdRaw } = userIds.length > 0
    ? await admin
        .from("notdienst_entries")
        .select("user_id, date")
        .in("user_id", userIds)
        .gte("date", ndRange.start)
        .lte("date", ndRange.end)
    : { data: [] };
  const monthNdEntries = (monthNdRaw ?? []).filter(n =>
    notdienstBelongsToMonth(n.date, now.getFullYear(), now.getMonth() + 1),
  );

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
  // Aufgaben (Faz C): Vormonat-Abschluss, offene Notdienste, Ruhezeit, Auffälligkeiten
  // ─────────────────────────────────────────────────────────────
  const nowLocal = berlinNowLocal();
  const pm = now.getMonth() === 0 ? { y: now.getFullYear() - 1, m: 12 } : { y: now.getFullYear(), m: now.getMonth() };
  const pmFirst = `${pm.y}-${String(pm.m).padStart(2, "0")}-01`;
  const pmLast  = `${pm.y}-${String(pm.m).padStart(2, "0")}-${String(new Date(pm.y, pm.m, 0).getDate()).padStart(2, "0")}`;
  const pmNd    = notdienstLoadRange(pm.y, pm.m);
  const [{ data: pmClosings }, { data: pmEntries }, { data: pmNdRaw }, { count: unpaidNd }, { data: recentNd }] = userIds.length > 0
    ? await Promise.all([
        admin.from("month_closings").select("user_id, status").in("user_id", userIds).eq("year", pm.y).eq("month", pm.m),
        admin.from("time_entries").select("user_id, date, day_type, start_time, end_time, break_minutes, tags")
          .in("user_id", userIds).gte("date", addDays(pmFirst, -1)).lte("date", pmLast),
        admin.from("notdienst_entries").select("user_id, date, start_time, end_time")
          .in("user_id", userIds).gte("date", pmNd.start).lte("date", pmNd.end),
        admin.from("notdienst_entries").select("id", { count: "exact", head: true })
          .in("user_id", userIds).eq("erledigt", false).gte("date", addDays(todayISO, -120)),
        admin.from("notdienst_entries").select("user_id, date, start_time, end_time")
          .in("user_id", userIds).gte("date", addDays(todayISO, -1)).lte("date", todayISO),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { count: 0 }, { data: [] }];
  const closingByUser = new Map(((pmClosings ?? []) as { user_id: string; status: string }[]).map((c) => [c.user_id, c.status]));
  const pmApproved  = activeEmployees.filter((e) => closingByUser.get(e.user_id) === "approved").length;
  const pmSubmitted = activeEmployees.filter((e) => closingByUser.get(e.user_id) === "submitted");
  const feiertagePm = getFeiertage(pm.y, company?.bundesland ?? "NI");
  const findingsByUser = new Map<string, number>();
  for (const e of activeEmployees) {
    const n = checkMonth({
      entries:   ((pmEntries ?? []) as (CheckEntry & { user_id: string })[]).filter((t) => t.user_id === e.user_id),
      ndEntries: ((pmNdRaw ?? []) as { user_id: string; date: string; start_time: string | null; end_time: string | null }[]).filter((t) => t.user_id === e.user_id),
      year: pm.y, month: pm.m, feiertage: feiertagePm, todayISO,
    }).length;
    if (n > 0 && closingByUser.get(e.user_id) !== "approved") findingsByUser.set(e.user_id, n);
  }
  const rest = restUntil((recentNd ?? []) as { user_id: string; date: string; start_time: string | null; end_time: string | null }[], nowLocal);
  const krankToday = (monthEntries ?? []).filter((e) => e.date === todayISO && e.day_type === "krank");
  const pmLabel = new Date(pm.y, pm.m - 1, 1).toLocaleDateString("de-DE", { month: "long" });

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

      {/* ─────────────────────────────────────────────────────────
          Aufgaben — was der Chef heute erledigen sollte
          ───────────────────────────────────────────────────────── */}
      {(() => {
        const pendingVacTotal = (pendingVacationsAll ?? []).length;
        const firstPendingVacUser = (pendingVacationsAll ?? [])[0]?.user_id;
        const firstFindingUser = [...findingsByUser.keys()][0];
        const findingsTotal = [...findingsByUser.values()].reduce((s, n) => s + n, 0);
        type Task = { key: string; n?: number; text: string; sub?: string; href: string; tone: "red" | "orange" | "neutral" };
        const tasks: Task[] = [
          ...[...rest.entries()].map(([uid, until]): Task => ({
            key: `rest-${uid}`, tone: "red", href: "/company/notdienst",
            text: `${nameMap.get(uid) ?? "—"}: Ruhezeit bis ${until.slice(11, 16)} Uhr`,
            sub: "nach Notdienst-Einsatz (§5 ArbZG)",
          })),
          ...(pmSubmitted.length ? [{
            key: "submitted", n: pmSubmitted.length, tone: "orange" as const,
            text: `${pmLabel} zur Freigabe`, href: `/company/employees/${pmSubmitted[0]!.user_id}?year=${pm.y}&month=${pm.m}`,
          }] : []),
          ...(findingsTotal ? [{
            key: "findings", n: findingsTotal, tone: "red" as const,
            text: `Auffälligkeit${findingsTotal === 1 ? "" : "en"} im ${pmLabel}`,
            sub: `bei ${findingsByUser.size} Mitarbeiter${findingsByUser.size === 1 ? "" : "n"}`,
            href: `/company/employees/${firstFindingUser}?year=${pm.y}&month=${pm.m}`,
          }] : []),
          ...(pendingVacTotal ? [{
            key: "vac", n: pendingVacTotal, tone: "orange" as const,
            text: `Urlaubsantr${pendingVacTotal === 1 ? "ag" : "äge"}`, href: `/company/employees/${firstPendingVacUser}`,
          }] : []),
          ...(unpaidNd ? [{
            key: "nd", n: unpaidNd, tone: "neutral" as const,
            text: `Notdienst${unpaidNd === 1 ? "" : "e"} unbezahlt`, href: "/company/notdienst",
          }] : []),
          ...krankToday.map((k): Task => ({
            key: `krank-${k.user_id}`, tone: "neutral", href: `/company/employees/${k.user_id}`,
            text: `${nameMap.get(k.user_id) ?? "—"} krank gemeldet`, sub: "nur zur Info — kein Antrag nötig",
          })),
        ];
        const toneColor = { red: "var(--red)", orange: "var(--orange)", neutral: "var(--text)" };
        const total = activeEmployees.length;
        const pct = total ? pmApproved / total : 0;
        const C = 2 * Math.PI * 19;
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 28 }}>
            <Link href="/company/employees" className="card" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: "var(--text)" }}>
              <svg width="54" height="54" viewBox="0 0 46 46" role="img" aria-label={`${pmApproved} von ${total} freigegeben`}>
                <circle cx="23" cy="23" r="19" fill="none" stroke="var(--surface2)" strokeWidth="5" />
                <circle cx="23" cy="23" r="19" fill="none" stroke={pct === 1 ? "var(--green)" : "var(--accent)"} strokeWidth="5"
                  strokeDasharray={`${C * pct} ${C}`} transform="rotate(-90 23 23)" strokeLinecap="round" />
                <text x="23" y="27" textAnchor="middle" fontSize="11" fontWeight="800" fill="currentColor">{pmApproved}/{total}</text>
              </svg>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{pmLabel} {pct === 1 ? "abgeschlossen" : "freigeben"}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {pct === 1 ? "Alle Monate freigegeben ✓" : `${pmSubmitted.length} eingereicht · ${total - pmApproved - pmSubmitted.length} offen`}
                </div>
              </div>
            </Link>
            {tasks.length === 0 ? (
              <div className="card" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 10, color: "var(--green)", fontWeight: 800 }}>
                ✅ Alles erledigt
              </div>
            ) : tasks.map((t) => (
              <Link key={t.key} href={t.href} className="card" style={{
                padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "var(--text)",
                ...(t.tone !== "neutral" ? {
                  background: `color-mix(in srgb, ${toneColor[t.tone]} 8%, var(--surface))`,
                  border: `1px solid color-mix(in srgb, ${toneColor[t.tone]} 30%, transparent)`,
                } : {}),
              }}>
                {t.n != null && <span style={{ fontSize: 22, fontWeight: 800, minWidth: 28, color: toneColor[t.tone] }}>{t.n}</span>}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 14, color: t.tone === "neutral" ? "var(--text)" : toneColor[t.tone] }}>{t.text}</span>
                  {t.sub && <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>{t.sub}</span>}
                </span>
                <span aria-hidden="true" style={{ color: "var(--muted)" }}>›</span>
              </Link>
            ))}
          </div>
        );
      })()}

      <p style={{ fontSize: 12, color: "var(--muted)", margin: "-14px 0 24px" }}>
        {activeEmployees.length} aktive Mitarbeiter · Team {monthName}: {formatMinutes(teamTotalMin)}
        {(pendingInvites ?? 0) > 0 && <> · {pendingInvites} offene Einladungen</>}
      </p>

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

      <Link href="/company/audit" style={{ fontSize: 12, color: "var(--muted)" }}>🔒 Audit-Log — alle Änderungen im Firmenkonto</Link>
    </div>
  );
}
