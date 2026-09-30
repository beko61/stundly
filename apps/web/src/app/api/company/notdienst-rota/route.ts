import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCompanyAdminContext } from "@/lib/company/admin";
import { logAudit } from "@/lib/audit/logger";

/**
 * POST /api/company/notdienst-rota
 * Body: { assignments: [{ week_start: "YYYY-MM-DD" (Montag), user_id: uuid | null }] }
 *
 * Rufbereitschafts-Plan setzen (Migration 034). user_id = null → Woche freigeben.
 * Mehrere Wochen auf einmal (für "Automatisch verteilen").
 */
const bodySchema = z.object({
  assignments: z.array(z.object({
    week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    user_id:    z.string().uuid().nullable(),
  })).min(1).max(60),
});

function isMonday(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() === 1;
}

export async function POST(req: NextRequest) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { admin, companyId } = ctx;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  const { assignments } = parsed.data;
  if (assignments.some((a) => !isMonday(a.week_start))) {
    return NextResponse.json({ error: "week_start muss ein Montag sein" }, { status: 400 });
  }

  // Nur aktive Mitglieder dieser Firma
  const userIds = [...new Set(assignments.map((a) => a.user_id).filter((u): u is string => !!u))];
  if (userIds.length > 0) {
    const { data: members } = await admin
      .from("profiles").select("user_id").eq("company_id", companyId).is("deleted_at", null).in("user_id", userIds);
    const ok = new Set(((members ?? []) as { user_id: string }[]).map((m) => m.user_id));
    if (userIds.some((u) => !ok.has(u))) return NextResponse.json({ error: "Mitarbeiter nicht gefunden" }, { status: 404 });
  }

  const set = assignments.filter((a) => a.user_id).map((a) => ({ company_id: companyId, week_start: a.week_start, user_id: a.user_id! }));
  const clear = assignments.filter((a) => !a.user_id).map((a) => a.week_start);

  if (set.length > 0) {
    const { error } = await admin.from("notdienst_rota").upsert(set, { onConflict: "company_id,week_start" });
    if (error) {
      const missing = /notdienst_rota/.test(error.message);
      return NextResponse.json({ error: missing ? "Datenbank noch nicht aktualisiert (Migration 034 fehlt)." : "Speichern fehlgeschlagen" }, { status: 500 });
    }
  }
  if (clear.length > 0) {
    const { error } = await admin.from("notdienst_rota").delete().eq("company_id", companyId).in("week_start", clear);
    if (error) return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 });
  }

  await logAudit({
    admin, actorUserId: ctx.user.id, companyId,
    action: "notdienst.rota_updated", resourceType: "company", resourceId: companyId,
    payload: { weeks: assignments.length },
  });
  return NextResponse.json({ ok: true });
}
