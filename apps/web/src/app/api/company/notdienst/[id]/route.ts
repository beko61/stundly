import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCompanyAdminContext, getTeamMember } from "@/lib/company/admin";
import { logAudit } from "@/lib/audit/logger";

/**
 * PATCH /api/company/notdienst/[id]
 * Body: { erledigt: boolean }
 *
 * Bezahlt-Status eines Notdienst-Einsatzes setzt bei Firmen-Mitarbeitern die Firma
 * (Migration 033: Mitarbeiter selbst dürfen erledigt nicht mehr ändern).
 */
const bodySchema = z.object({ erledigt: z.boolean() });
const idSchema = z.string().uuid();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { admin, companyId } = ctx;

  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });

  const { data: nd } = await admin
    .from("notdienst_entries")
    .select("id, user_id, date, erledigt")
    .eq("id", id)
    .maybeSingle();
  const entry = nd as { id: string; user_id: string; date: string; erledigt: boolean } | null;
  if (!entry || !(await getTeamMember(admin, companyId, entry.user_id))) {
    return NextResponse.json({ error: "Einsatz nicht gefunden" }, { status: 404 });
  }

  const { erledigt } = parsed.data;
  if (entry.erledigt !== erledigt) {
    const { error } = await admin.from("notdienst_entries").update({ erledigt }).eq("id", id);
    if (error) return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 });

    await logAudit({
      admin,
      actorUserId:  ctx.user.id,
      companyId,
      action:       erledigt ? "notdienst.marked_paid" : "notdienst.marked_unpaid",
      resourceType: "notdienst_entry",
      resourceId:   id,
      payload:      { user_id: entry.user_id, date: entry.date },
    });
  }

  return NextResponse.json({ ok: true, erledigt });
}
