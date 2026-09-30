import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCompanyAdminContext } from "@/lib/company/admin";
import { logAudit } from "@/lib/audit/logger";

/**
 * PATCH /api/company/settings
 * Body: { notdienst_pauschale: number | null }
 *
 * Firmen-Einstellungen (Migration 034). Aktuell: Pauschale in € pro Notdienst-Einsatz.
 */
const bodySchema = z.object({
  notdienst_pauschale: z.number().min(0).max(10000).nullable(),
});

export async function PATCH(req: NextRequest) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { admin, companyId } = ctx;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  const value = parsed.data.notdienst_pauschale == null ? null : Math.round(parsed.data.notdienst_pauschale * 100) / 100;

  const { error } = await admin.from("companies").update({ notdienst_pauschale: value }).eq("id", companyId);
  if (error) {
    const missing = /notdienst_pauschale/.test(error.message);
    return NextResponse.json({ error: missing ? "Datenbank noch nicht aktualisiert (Migration 034 fehlt)." : "Speichern fehlgeschlagen" }, { status: 500 });
  }

  await logAudit({
    admin, actorUserId: ctx.user.id, companyId,
    action: "company.notdienst_pauschale", resourceType: "company", resourceId: companyId,
    payload: { notdienst_pauschale: value },
  });
  return NextResponse.json({ ok: true, notdienst_pauschale: value });
}
