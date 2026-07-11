import { NextRequest, NextResponse } from "next/server";
import { getCompanyAdminContext } from "@/lib/company/admin";
import { logAudit } from "@/lib/audit/logger";
import { employeeIdSchema } from "@/lib/validation/schemas";

/**
 * POST /api/company/employees/restore
 * Body: { userId: string }
 *
 * Soft-delete'i geri alır: deleted_at = null, is_active = true.
 * deleted_by da temizlenir (history audit_log'da kalır).
 *
 * Güvenlik:
 *   - company_admin gate
 *   - Target aynı şirkette mi?
 *   - Target zaten aktifse 409
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
  if (!target.deleted_at) {
    return NextResponse.json({ error: "Mitarbeiter ist nicht gelöscht" }, { status: 409 });
  }

  const { error: updateErr } = await admin
    .from("profiles")
    .update({ deleted_at: null, deleted_by: null, is_active: true })
    .eq("user_id", userId);

  if (updateErr) {
    return NextResponse.json({ error: "Wiederherstellen fehlgeschlagen", detail: updateErr.message }, { status: 500 });
  }

  await logAudit({
    admin,
    actorUserId:  ctx.user.id,
    companyId,
    action:       "employee.restored",
    resourceType: "profile",
    resourceId:   userId,
    payload: {
      target_full_name: target.full_name,
      target_email:     target.email,
      target_role:      target.role,
    },
  });

  return NextResponse.json({ ok: true, userId });
}
