import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCompanyAdminContext, getTeamMember } from "@/lib/company/admin";
import { monthlyTargetFromWeekly } from "@/lib/company/contract";
import { logAudit } from "@/lib/audit/logger";

/**
 * PATCH /api/company/employees/[userId]/contract
 * Body: { weekly_hours: number|null, vacation_days: number|null, start_date: "YYYY-MM-DD"|null }
 *
 * Vertragsdaten eines Mitarbeiters (Migration 033). null = Mitarbeiter pflegt den Wert selbst.
 * Gesetzte Werte werden in die neueste salary_settings-Zeile übernommen
 * (Soll-Stunden = Wochenstunden × 52 / 12, Urlaubsanspruch, Beschäftigungsbeginn) —
 * der Mitarbeiter kann sie danach nicht mehr selbst ändern (DB-Trigger).
 */
const bodySchema = z.object({
  weekly_hours:  z.number().min(1).max(60).nullable(),
  vacation_days: z.number().int().min(0).max(60).nullable(),
  start_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { admin, companyId } = ctx;
  const { userId } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { weekly_hours, vacation_days, start_date } = parsed.data;

  const member = await getTeamMember(admin, companyId, userId);
  if (!member) return NextResponse.json({ error: "Mitarbeiter nicht gefunden" }, { status: 404 });

  const { error: profErr } = await admin
    .from("profiles")
    .update({ contract_weekly_hours: weekly_hours, contract_vacation_days: vacation_days, contract_start: start_date })
    .eq("user_id", userId);
  if (profErr) {
    const missing = /contract_/.test(profErr.message);
    return NextResponse.json({
      error: missing ? "Datenbank noch nicht aktualisiert (Migration 033 fehlt)." : "Speichern fehlgeschlagen",
    }, { status: 500 });
  }

  // Werte in die Lohn-Einstellungen des Mitarbeiters übernehmen
  const patch: Record<string, unknown> = {};
  if (weekly_hours != null)  patch["monthly_target_hours"]  = monthlyTargetFromWeekly(weekly_hours);
  if (vacation_days != null) patch["urlaub_anspruch"]       = vacation_days;
  if (start_date != null)    patch["employment_start_date"] = start_date;

  if (Object.keys(patch).length > 0) {
    const { data: latest } = await admin
      .from("salary_settings")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = (latest ?? [])[0] as { id: string } | undefined;
    const { error: sErr } = row
      ? await admin.from("salary_settings").update(patch).eq("id", row.id)
      : await admin.from("salary_settings").insert({ user_id: userId, ...patch });
    if (sErr) return NextResponse.json({ error: "Lohn-Einstellungen konnten nicht aktualisiert werden" }, { status: 500 });
  }

  await logAudit({
    admin,
    actorUserId:  ctx.user.id,
    companyId,
    action:       "employee.contract_updated",
    resourceType: "profile",
    resourceId:   userId,
    payload:      { weekly_hours, vacation_days, start_date },
  });

  return NextResponse.json({ ok: true });
}
