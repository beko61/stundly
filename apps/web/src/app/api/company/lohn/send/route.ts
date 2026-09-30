import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCompanyAdminContext } from "@/lib/company/admin";
import { logAudit } from "@/lib/audit/logger";
import { checkRateLimit } from "@/lib/rateLimit/check";
import { loadLohnMonth } from "@/lib/company/lohnData";
import { sendLohnToSteuerberater } from "@/lib/email/companyMails";

/**
 * POST /api/company/lohn/send
 * Body: { year, month }
 * Lohn-Vorbereitung des Monats an die hinterlegte Steuerberater-Adresse (Tabelle + CSV).
 * Antwort-Adresse = der Chef, damit Rückfragen direkt bei ihm landen.
 */
const bodySchema = z.object({
  year:  z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

export async function POST(req: NextRequest) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { admin, companyId } = ctx;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  const { year, month } = parsed.data;

  const rl = await checkRateLimit({ bucket: `lohn_send:${companyId}`, limit: 10, windowSec: 86400 });
  if (!rl.allowed) return NextResponse.json({ error: "Heute schon oft gesendet — bitte morgen erneut." }, { status: 429 });

  const { company, rows, monthLabel } = await loadLohnMonth(admin, companyId, year, month);
  if (!company.steuerberater_email) return NextResponse.json({ error: "Keine Steuerberater-Adresse hinterlegt." }, { status: 400 });
  if (rows.length === 0) return NextResponse.json({ error: "Keine Mitarbeiter-Daten für diesen Monat." }, { status: 400 });

  try {
    const { error } = await sendLohnToSteuerberater({
      to: company.steuerberater_email, replyTo: ctx.user.email ?? null,
      firma: company.name, year, month, monthLabel, rows,
      sender: ctx.profile.full_name ?? ctx.user.email ?? "Betrieb",
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("[lohn/send]", e);
    return NextResponse.json({ error: "E-Mail konnte nicht gesendet werden." }, { status: 502 });
  }

  await logAudit({
    admin, actorUserId: ctx.user.id, companyId,
    action: "lohn.sent_to_steuerberater", resourceType: "company", resourceId: companyId,
    payload: { year, month, to: company.steuerberater_email, rows: rows.length },
  });
  return NextResponse.json({ ok: true, to: company.steuerberater_email });
}
