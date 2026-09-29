import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCompanyAdminContext, getTeamMember } from "@/lib/company/admin";
import { logAudit } from "@/lib/audit/logger";

/**
 * POST /api/company/month-closings
 * Body: { userId, year, month, action: "approve" | "reopen" }
 *
 * approve → Monat freigegeben: der Mitarbeiter kann ihn nicht mehr ändern (DB-Trigger
 *           guard_locked_month), Korrekturen nur noch durch die Firma. Geht auch ohne Einreichung.
 * reopen  → Freigabe/Einreichung aufheben, der Mitarbeiter kann wieder bearbeiten.
 */
const bodySchema = z.object({
  userId: z.string().uuid(),
  year:   z.number().int().min(2020).max(2100),
  month:  z.number().int().min(1).max(12),
  action: z.enum(["approve", "reopen"]),
});

export async function POST(req: NextRequest) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { admin, companyId } = ctx;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  const { userId, year, month, action } = parsed.data;

  if (!(await getTeamMember(admin, companyId, userId))) {
    return NextResponse.json({ error: "Mitarbeiter nicht gefunden" }, { status: 404 });
  }

  const { data: existing } = await admin
    .from("month_closings")
    .select("id, status, submitted_at")
    .eq("user_id", userId).eq("year", year).eq("month", month)
    .maybeSingle();
  const row = existing as { id: string; status: string; submitted_at: string | null } | null;

  if (action === "approve") {
    const payload = {
      user_id: userId, company_id: companyId, year, month, status: "approved",
      submitted_at: row?.submitted_at ?? null,
      approved_at: new Date().toISOString(), approved_by: ctx.user.id,
    };
    const { error } = row
      ? await admin.from("month_closings").update(payload).eq("id", row.id)
      : await admin.from("month_closings").insert(payload);
    if (error) return NextResponse.json({ error: "Freigabe fehlgeschlagen" }, { status: 500 });
  } else if (row) {
    const { error } = await admin.from("month_closings").delete().eq("id", row.id);
    if (error) return NextResponse.json({ error: "Wieder öffnen fehlgeschlagen" }, { status: 500 });
  }

  await logAudit({
    admin,
    actorUserId:  ctx.user.id,
    companyId,
    action:       action === "approve" ? "month.approved" : "month.reopened",
    resourceType: "month_closing",
    resourceId:   userId,
    payload:      { year, month, was: row?.status ?? null },
  });

  return NextResponse.json({ ok: true, status: action === "approve" ? "approved" : null });
}
