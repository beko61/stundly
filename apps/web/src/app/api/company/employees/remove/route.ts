import { NextRequest, NextResponse } from "next/server";
import { getCompanyAdminContext } from "@/lib/company/admin";
import { endMembership } from "@/lib/company/membership";
import { logAudit } from "@/lib/audit/logger";
import { employeeIdSchema } from "@/lib/validation/schemas";

/**
 * POST /api/company/employees/remove   Body: { userId }
 *
 * Mitarbeiter aus dem Team entfernen (Austritt). Anders als "Löschen" (soft-delete, Login gesperrt)
 * behält der Mitarbeiter sein Konto und seine Daten und arbeitet als Einzelperson weiter.
 * Die Firma sieht seine Daten aus dem Zeitraum der Zugehörigkeit weiterhin (Migration 042).
 */
export async function POST(req: NextRequest) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { admin, companyId } = ctx;

  const parsed = employeeIdSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  const { userId } = parsed.data;

  if (userId === ctx.user.id) {
    return NextResponse.json({ error: "Du kannst dich nicht selbst entfernen." }, { status: 400 });
  }

  const { data: target } = await admin
    .from("profiles")
    .select("user_id, company_id, role, full_name, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (!target || target.company_id !== companyId) {
    return NextResponse.json({ error: "Mitarbeiter nicht gefunden" }, { status: 404 });
  }
  if (target.role !== "employee") {
    return NextResponse.json({ error: "Nur Mitarbeiter können entfernt werden." }, { status: 400 });
  }

  const res = await endMembership(admin, { userId, companyId, actorId: ctx.user.id, reason: "removed" });
  if (!res.ok) return NextResponse.json({ error: "Entfernen fehlgeschlagen" }, { status: 500 });

  await logAudit({
    admin,
    actorUserId:  ctx.user.id,
    companyId,
    action:       "employee.removed",
    resourceType: "profile",
    resourceId:   userId,
    payload:      { target_full_name: target.full_name, target_email: target.email },
  });

  return NextResponse.json({ ok: true });
}
