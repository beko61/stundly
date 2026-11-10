import { NextRequest, NextResponse } from "next/server";
import { getCompanyAdminContext, netMinutesForEntry } from "@/lib/company/admin";
import { listFormerMembers, loadMemberAccess, visibleFn } from "@/lib/company/membership";

/**
 * GET /api/company/team-summary?month=YYYY-MM
 * Sadece company_admin çağırabilir.
 *
 * Döner:
 *   employees:    [{ user_id, full_name, email, role, is_active, last_seen_at,
 *                    monthlyMinutes, workDays, vacationDays, sickDays }]
 *   totalMinutes: int (tüm aktif çalışanların toplam dakikası)
 *   pendingVacationCount: int
 *   pendingVacations: [{ id, user_id, full_name, start_date, end_date, days_count }]
 */
export async function GET(req: NextRequest) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { admin, companyId } = ctx;

  const url   = new URL(req.url);
  const month = url.searchParams.get("month"); // "YYYY-MM"
  // ?includeDeleted=true → soft-deleted Mitarbeiter de döner (Geloeschte UI sekmesi için)
  const includeDeleted = url.searchParams.get("includeDeleted") === "true";
  const now   = new Date();
  const [y, m] = month
    ? month.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];

  if (!y || !m || m < 1 || m > 12) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  const firstDay = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay  = new Date(y, m, 0).toISOString().split("T")[0];

  // 1) Şirket çalışanları — soft-deleted by default haric tutulur
  let empQuery = admin
    .from("profiles")
    .select("user_id, full_name, email, role, is_active, last_seen_at, created_at, deleted_at, deleted_by")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  if (!includeDeleted) empQuery = empQuery.is("deleted_at", null);
  const { data: employees } = await empQuery;

  const empList = employees ?? [];
  const userIds = empList.map((e) => e.user_id);
  // Neue Mitglieder mit Vorgeschichte: Daten vor dem Beitritt nicht zeigen (Migration 042)
  const access = await loadMemberAccess(admin, companyId, userIds);
  const visible = visibleFn(access);

  // 2) Bu ay'ın time_entries kayıtları
  const { data: timeEntries } = userIds.length > 0
    ? await admin
        .from("time_entries")
        .select("user_id, date, start_time, end_time, break_minutes, day_type")
        .in("user_id", userIds)
        .gte("date", firstDay)
        .lte("date", lastDay)
    : { data: [] };

  // 3) Pending vacation requests (tüm zamanlar — admin'in bekleyen kuyruğu)
  const { data: pendingVacations } = userIds.length > 0
    ? await admin
        .from("vacation_requests")
        .select("id, user_id, start_date, end_date, days_count, created_at")
        .in("user_id", userIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
    : { data: [] };

  // 3b) Abschluss-Status des Vormonats (wird nach Monatsende eingereicht) — Migration 033
  const pm = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const { data: closings } = userIds.length > 0
    ? await admin
        .from("month_closings")
        .select("user_id, status")
        .in("user_id", userIds)
        .eq("year", pm.y).eq("month", pm.m)
    : { data: [] };
  const closingMap = new Map(((closings ?? []) as { user_id: string; status: string }[]).map((c) => [c.user_id, c.status]));

  // 4) Aggregate per employee
  const summaries = empList.map((emp) => {
    const entries = (timeEntries ?? []).filter((t) => t.user_id === emp.user_id && visible(emp.user_id, t.date));
    const monthlyMinutes = entries.reduce((sum, e) => sum + netMinutesForEntry(e), 0);
    return {
      prevMonthStatus: (closingMap.get(emp.user_id) ?? null) as "submitted" | "approved" | null,
      user_id:        emp.user_id,
      full_name:      emp.full_name,
      email:          emp.email,
      role:           emp.role,
      is_active:      emp.is_active,
      last_seen_at:   emp.last_seen_at,
      deleted_at:     emp.deleted_at,
      monthlyMinutes,
      workDays:       entries.filter((e) => e.day_type === "arbeiten").length,
      vacationDays:   entries.filter((e) => e.day_type === "urlaub").length,
      sickDays:       entries.filter((e) => e.day_type === "krank").length,
    };
  });

  // 5) Pending vacations için full_name join (manuel)
  const empNameMap = new Map(empList.map((e) => [e.user_id, e.full_name ?? e.email ?? "—"]));
  const pendingList = (pendingVacations ?? []).filter((v) => visible(v.user_id, v.start_date)).map((v) => ({
    id:         v.id,
    user_id:    v.user_id,
    full_name:  empNameMap.get(v.user_id) ?? "—",
    start_date: v.start_date,
    end_date:   v.end_date,
    days_count: v.days_count,
  }));

  const totalMinutes = summaries
    .filter((s) => s.is_active)
    .reduce((sum, s) => sum + s.monthlyMinutes, 0);

  // Ehemalige Mitarbeiter (Migration 042) — nur Name + Austritt, Daten über die Detailseite
  const formerRows = await listFormerMembers(admin, companyId);
  const { data: formerProfiles } = formerRows.length > 0
    ? await admin.from("profiles").select("user_id, full_name, email").in("user_id", formerRows.map((f) => f.user_id))
    : { data: [] };
  const formerName = new Map(((formerProfiles ?? []) as { user_id: string; full_name: string | null; email: string | null }[])
    .map((p) => [p.user_id, p]));
  const former = formerRows.map((f) => ({
    user_id:     f.user_id,
    full_name:   formerName.get(f.user_id)?.full_name ?? null,
    email:       formerName.get(f.user_id)?.email ?? null,
    left_at:     f.left_at,
    left_reason: f.left_reason,
  }));

  return NextResponse.json({
    former,
    month:                `${y}-${String(m).padStart(2, "0")}`,
    prevMonth:            `${pm.y}-${String(pm.m).padStart(2, "0")}`,
    employees:            summaries,
    totalMinutes,
    pendingVacationCount: pendingList.length,
    pendingVacations:     pendingList.slice(0, 5), // ilk 5'i göster
  });
}
