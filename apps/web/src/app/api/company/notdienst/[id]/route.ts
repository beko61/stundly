import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCompanyAdminContext, getTeamMember } from "@/lib/company/admin";
import { logAudit } from "@/lib/audit/logger";

/**
 * PATCH /api/company/notdienst/[id]
 * Body: { ueberwiesen: boolean }
 *
 * Notdienst-Zahlung bei Firmen-Mitarbeitern in zwei Schritten (Migration 041):
 *   Firma: ueberwiesen=true → ueberwiesen_am gesetzt ("💸 überwiesen, wartet auf Bestätigung")
 *   Mitarbeiter: /api/notdienst/[id]/erhalten → erledigt=true (= bezahlt, zählt in Lohn/Berichten)
 * ueberwiesen=false nimmt beides zurück. Mitarbeiter dürfen beides nicht direkt ändern (DB-Schutz).
 */
const bodySchema = z.object({ ueberwiesen: z.boolean() });
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
    .select("id, user_id, date, erledigt, ueberwiesen_am")
    .eq("id", id)
    .maybeSingle();
  const entry = nd as { id: string; user_id: string; date: string; erledigt: boolean | null; ueberwiesen_am: string | null } | null;
  if (!entry || !(await getTeamMember(admin, companyId, entry.user_id))) {
    return NextResponse.json({ error: "Einsatz nicht gefunden" }, { status: 404 });
  }

  const { ueberwiesen } = parsed.data;
  const ueberwiesen_am = ueberwiesen ? (entry.ueberwiesen_am ?? new Date().toISOString()) : null;
  const erledigt = ueberwiesen ? !!entry.erledigt : false;
  if (ueberwiesen_am !== entry.ueberwiesen_am || erledigt !== !!entry.erledigt) {
    const { error } = await admin.from("notdienst_entries").update({ ueberwiesen_am, erledigt }).eq("id", id);
    if (error) return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 });

    await logAudit({
      admin,
      actorUserId:  ctx.user.id,
      companyId,
      action:       ueberwiesen ? "notdienst.marked_transferred" : "notdienst.marked_unpaid",
      resourceType: "notdienst_entry",
      resourceId:   id,
      payload:      { user_id: entry.user_id, date: entry.date },
    });
  }

  return NextResponse.json({ ok: true, ueberwiesen_am, erledigt });
}
