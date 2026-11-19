import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCompanyAdminContext, getTeamMember } from "@/lib/company/admin";
import { getMemberAccess, inRanges } from "@/lib/company/membership";
import { logAudit } from "@/lib/audit/logger";
import { getFeiertage } from "@/lib/utils/feiertage";
import { DEFAULT_STANDARD_TIMES } from "@/lib/utils/standardTimes";
import { parseStandardTimes } from "@/lib/utils/standardTimesSync";
import { planYearFill } from "@/lib/utils/yearFill";

/**
 * POST /api/company/employees/[userId]/year-fill  Body: { year }
 *
 * Chef füllt das Jahr eines Mitarbeiters mit dessen Standardzeiten (Mo–Fr, ohne Feiertage seines
 * Bundeslands). Nur ab heute — vergangene Tage bleiben echte Einträge. Übersprungen: vorhandene
 * Einträge, Urlaubsanträge (offen/genehmigt), Tage vor Vertragsbeginn/Firmeneintritt.
 * Bestehendes wird nie überschrieben. Markierung "autofill" → Mitarbeiter und Firma sehen es.
 */
const bodySchema = z.object({ year: z.number().int() });

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { admin, companyId, user } = ctx;
  const { userId } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  const today = iso(new Date());
  const thisYear = Number(today.slice(0, 4));
  if (!parsed.success || parsed.data.year < thisYear || parsed.data.year > thisYear + 1) {
    return NextResponse.json({ error: `Nur ${thisYear} oder ${thisYear + 1}.` }, { status: 400 });
  }
  const { year } = parsed.data;

  const member = await getTeamMember(admin, companyId, userId);
  if (!member || member.role !== "employee") {
    return NextResponse.json({ error: "Mitarbeiter nicht gefunden" }, { status: 404 });
  }

  const [{ data: prof }, { data: entries }, { data: vacations }, access] = await Promise.all([
    admin.from("profiles").select("bundesland, standard_times, contract_start").eq("user_id", userId).maybeSingle(),
    admin.from("time_entries").select("date").eq("user_id", userId).gte("date", `${year}-01-01`).lte("date", `${year}-12-31`),
    admin.from("vacation_requests").select("start_date, end_date").eq("user_id", userId)
      .in("status", ["pending", "approved"]).lte("start_date", `${year}-12-31`).gte("end_date", `${year}-01-01`),
    getMemberAccess(admin, companyId, userId),
  ]);
  const p = (prof ?? {}) as { bundesland?: string | null; standard_times?: unknown; contract_start?: string | null };
  const std = parseStandardTimes(p.standard_times) ?? DEFAULT_STANDARD_TIMES;
  const existing = new Set(((entries ?? []) as { date: string }[]).map((e) => e.date));
  const vac = (vacations ?? []) as { start_date: string; end_date: string }[];
  const from = p.contract_start && p.contract_start > today ? p.contract_start : today;

  const rows = planYearFill({
    year, feiertage: getFeiertage(year, p.bundesland ?? "NI"), std,
    skip: (d) =>
      d < from
      || existing.has(d)
      || vac.some((v) => d >= v.start_date && d <= v.end_date)
      || (!!access && !inRanges(d, access.ranges)),
  }).map((r) => ({ ...r, user_id: userId }));

  if (rows.length === 0) return NextResponse.json({ ok: true, inserted: 0 });

  // ignoreDuplicates: falls der Mitarbeiter gerade selbst einträgt, gewinnt sein Eintrag
  const { error } = await admin.from("time_entries")
    .upsert(rows, { onConflict: "user_id,date", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 });

  await logAudit({
    admin, actorUserId: user.id, companyId,
    action: "entries.year_filled", resourceType: "time_entry", resourceId: userId,
    payload: { year, days: rows.length, from, std },
  });

  return NextResponse.json({ ok: true, inserted: rows.length, from });
}
