import { NextRequest, NextResponse } from "next/server";
import { getCompanyAdminContext } from "@/lib/company/admin";
import { logAudit } from "@/lib/audit/logger";

/**
 * POST /api/company/employees/toggle
 * Body: { userId: string }
 *
 * Çalışanı aktif/deaktif yapar (toggle). Sadece company_admin yetkili.
 *
 * Neden server route: profiles UPDATE RLS policy'si sadece "auth.uid() = user_id"
 * izin veriyor — admin doğrudan başka çalışanı update edemez. Bu route admin
 * client ile bypass eder ama önce ownership doğrular (target aynı şirkette mi?).
 */
export async function POST(req: NextRequest) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { admin, companyId } = ctx;
  const { userId } = await req.json().catch(() => ({ userId: null }));

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId fehlt" }, { status: 400 });
  }

  // Güvenlik: target user aynı şirkette mi?
  const { data: target } = await admin
    .from("profiles")
    .select("user_id, company_id, is_active, role")
    .eq("user_id", userId)
    .single();

  if (!target || target.company_id !== companyId) {
    return NextResponse.json({ error: "Mitarbeiter nicht gefunden" }, { status: 404 });
  }

  // Admin kendi kendini deaktive etmesin (lockout engeli)
  if (target.user_id === ctx.user.id) {
    return NextResponse.json({ error: "Du kannst dich nicht selbst deaktivieren." }, { status: 400 });
  }

  const newState = !target.is_active;

  const { error: updateErr } = await admin
    .from("profiles")
    .update({ is_active: newState })
    .eq("user_id", userId);

  if (updateErr) {
    return NextResponse.json({ error: "Update fehlgeschlagen" }, { status: 500 });
  }

  await logAudit({
    admin,
    actorUserId:  ctx.user.id,
    companyId,
    action:       newState ? "employee.activated" : "employee.deactivated",
    resourceType: "profile",
    resourceId:   userId,
    payload: { target_role: target.role },
  });

  return NextResponse.json({ ok: true, is_active: newState });
}
