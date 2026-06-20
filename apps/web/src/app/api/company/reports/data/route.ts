import { NextRequest, NextResponse } from "next/server";
import { getCompanyAdminContext } from "@/lib/company/admin";
import { getFeiertage } from "@/lib/utils/feiertage";

/**
 * GET /api/company/reports/data?year=2026&month=6&userId=<optional>
 *
 * Company admin için ay-bazlı veri dump (export için JSON).
 *  - userId verilirse: tek çalışan (PDF veya detail CSV için)
 *  - userId yoksa:    tüm aktif çalışanlar (bulk summary CSV için)
 *
 * Güvenlik:
 *  - company_admin gate
 *  - userId aynı şirkette mi?
 *
 * Profile field'ları PDF helper'ın ihtiyaç duyduğu şekilde döner
 * (vorname, nachname, personal_nr, abteilung, vorgesetzter, signature_data,
 *  firma_*, logo_data, company_email).
 */
export async function GET(req: NextRequest) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { admin, companyId } = ctx;

  const sp = req.nextUrl.searchParams;
  const yearRaw  = parseInt(sp.get("year")  ?? "", 10);
  const monthRaw = parseInt(sp.get("month") ?? "", 10);
  const userId   = sp.get("userId");

  const now = new Date();
  const year  = Number.isInteger(yearRaw)  && yearRaw  >= 2020 && yearRaw  <= 2100 ? yearRaw  : now.getFullYear();
  const month = Number.isInteger(monthRaw) && monthRaw >= 1    && monthRaw <= 12   ? monthRaw : now.getMonth() + 1;

  const daysIn = new Date(year, month, 0).getDate();
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay  = `${year}-${String(month).padStart(2, "0")}-${String(daysIn).padStart(2, "0")}`;

  // ── Şirket bilgisi ──────────────────────────────────────────────
  const { data: company } = await admin
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .single();

  // ── Hedef Mitarbeiter listesi ──────────────────────────────────
  let employees: Array<Record<string, unknown>> = [];
  if (userId) {
    // Tek Mitarbeiter — same-company doğrula
    const { data: emp } = await admin
      .from("profiles")
      .select("user_id, full_name, email, vorname, nachname, personal_nr, abteilung, vorgesetzter, signature_data, firma_strasse, firma_plz, firma_ort, firma_telefon, logo_data, bundesland, company_id")
      .eq("user_id", userId)
      .single();
    if (!emp || emp.company_id !== companyId) {
      return NextResponse.json({ error: "Mitarbeiter nicht in deinem Unternehmen" }, { status: 404 });
    }
    employees = [emp];
  } else {
    const { data: list } = await admin
      .from("profiles")
      .select("user_id, full_name, email, vorname, nachname, personal_nr, abteilung, vorgesetzter, signature_data, firma_strasse, firma_plz, firma_ort, firma_telefon, logo_data, bundesland")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("nachname", { ascending: true });
    employees = list ?? [];
  }
  const userIds = employees.map(e => e.user_id as string);

  // ── Time entries (aylık) ───────────────────────────────────────
  const { data: timeEntries } = userIds.length > 0
    ? await admin
        .from("time_entries")
        .select("user_id, id, date, start_time, end_time, break_minutes, day_type, note, is_night_shift, tags")
        .in("user_id", userIds)
        .gte("date", firstDay).lte("date", lastDay)
        .order("date", { ascending: true })
    : { data: [] };

  // ── Notdienst (aylık) ──────────────────────────────────────────
  const { data: ndEntries } = userIds.length > 0
    ? await admin
        .from("notdienst_entries")
        .select("user_id, date, start_time, end_time, erledigt, kunde, note")
        .in("user_id", userIds)
        .gte("date", firstDay).lte("date", lastDay)
        .order("date", { ascending: true })
    : { data: [] };

  // ── Feiertage (Bundesland: ilk Mitarbeiter'in bundesland'ı, default NI) ─
  const bundesland = (employees[0]?.bundesland as string) ?? "NI";
  const feiertage  = getFeiertage(year, bundesland);

  // ── Aggregate Mitarbeiter bazlı ────────────────────────────────
  const result = employees.map(emp => {
    const uid = emp.user_id as string;
    return {
      profile: emp,
      entries:   (timeEntries ?? []).filter(t => t.user_id === uid),
      notdienst: (ndEntries  ?? []).filter(n => n.user_id === uid),
    };
  });

  return NextResponse.json({
    year, month, bundesland,
    companyName: (company as { name?: string } | null)?.name ?? null,
    feiertage,
    employees: result,
  });
}
