import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCompanyAdminContext } from "@/lib/company/admin";
import { logAudit } from "@/lib/audit/logger";

/**
 * PATCH /api/company/settings
 * Body (alle Felder optional, nur gesendete werden geändert):
 *   notdienst_pauschale: number | null     (Migration 034)
 *   steuerberater_email: string | null     (Migration 035)
 *   steuerberater_auto:  boolean           (Migration 035)
 *   team_digest_enabled: boolean           (Migration 035)
 */
const bodySchema = z.object({
  notdienst_pauschale: z.number().min(0).max(10000).nullable().optional(),
  steuerberater_email: z.string().trim().toLowerCase().email().max(200).nullable().optional()
    .or(z.literal("").transform(() => null)),
  steuerberater_auto:  z.boolean().optional(),
  team_digest_enabled: z.boolean().optional(),
}).refine((b) => Object.keys(b).length > 0, { message: "Keine Änderung" });

export async function PATCH(req: NextRequest) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { admin, companyId } = ctx;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  const b = parsed.data;

  const patch: Record<string, unknown> = {};
  if (b.notdienst_pauschale !== undefined) {
    patch["notdienst_pauschale"] = b.notdienst_pauschale == null ? null : Math.round(b.notdienst_pauschale * 100) / 100;
  }
  if (b.steuerberater_email !== undefined) patch["steuerberater_email"] = b.steuerberater_email;
  if (b.steuerberater_auto !== undefined)  patch["steuerberater_auto"] = b.steuerberater_auto;
  if (b.team_digest_enabled !== undefined) patch["team_digest_enabled"] = b.team_digest_enabled;
  // Automatik ohne Adresse ergibt keinen Sinn
  if (patch["steuerberater_email"] === null) patch["steuerberater_auto"] = false;

  const { error } = await admin.from("companies").update(patch).eq("id", companyId);
  if (error) {
    const m = error.message;
    const missing = /notdienst_pauschale/.test(m) ? "034" : /steuerberater|team_digest/.test(m) ? "035" : null;
    return NextResponse.json({ error: missing ? `Datenbank noch nicht aktualisiert (Migration ${missing} fehlt).` : "Speichern fehlgeschlagen" }, { status: 500 });
  }

  await logAudit({
    admin, actorUserId: ctx.user.id, companyId,
    action: "company.settings_updated", resourceType: "company", resourceId: companyId,
    payload: patch,
  });
  return NextResponse.json({ ok: true, ...patch });
}
