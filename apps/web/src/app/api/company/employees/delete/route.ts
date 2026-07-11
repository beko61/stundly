import { NextRequest, NextResponse } from "next/server";
import { getCompanyAdminContext } from "@/lib/company/admin";
import { logAudit } from "@/lib/audit/logger";
import { employeeIdSchema } from "@/lib/validation/schemas";

/**
 * POST /api/company/employees/delete
 * Body: { userId: string }
 *
 * SOFT-DELETE — gerçek satır silinmez. profile.deleted_at + is_active=false set.
 * time_entries / vacation_requests / notdienst_entries DOKUNULMAZ (GoBD).
 *
 * Güvenlik:
 *   - company_admin gate
 *   - Target aynı şirkette mi?
 *   - Admin kendi kendini silemez (lockout engeli)
 *   - Target zaten silindiyse 409
 *
 * Restore için: /api/company/employees/restore
 * Gerçek/anonim silme için: /api/dsgvo/delete (kullanıcı tarafından)
 */
export async function POST(req: NextRequest) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { admin, companyId } = ctx;

  const raw = await req.json().catch(() => ({}));
  const parsed = employeeIdSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({
      error:   "Ungültige Eingabe",
      details: parsed.error.flatten().fieldErrors,
    }, { status: 400 });
  }
  const { userId } = parsed.data;

  const { data: target } = await admin
    .from("profiles")
    .select("user_id, company_id, role, full_name, email, deleted_at")
    .eq("user_id", userId)
    .single();

  if (!target || target.company_id !== companyId) {
    return NextResponse.json({ error: "Mitarbeiter nicht gefunden" }, { status: 404 });
  }
  if (target.user_id === ctx.user.id) {
    return NextResponse.json({ error: "Du kannst dich nicht selbst löschen." }, { status: 400 });
  }
  if (target.deleted_at) {
    return NextResponse.json({ error: "Mitarbeiter bereits gelöscht" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await admin
    .from("profiles")
    .update({ deleted_at: now, deleted_by: ctx.user.id, is_active: false })
    .eq("user_id", userId);

  if (updateErr) {
    return NextResponse.json({ error: "Löschen fehlgeschlagen", detail: updateErr.message }, { status: 500 });
  }

  await logAudit({
    admin,
    actorUserId:  ctx.user.id,
    companyId,
    action:       "employee.soft_deleted",
    resourceType: "profile",
    resourceId:   userId,
    payload: {
      target_full_name: target.full_name,
      target_email:     target.email,
      target_role:      target.role,
    },
  });

  return NextResponse.json({ ok: true, userId, deletedAt: now });
}
