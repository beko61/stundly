import { NextRequest, NextResponse } from "next/server";
import { getCompanyAdminContext } from "@/lib/company/admin";
import { sendVacationDecisionEmail } from "@/lib/email/resend";
import { logAudit } from "@/lib/audit/logger";

/**
 * POST /api/vacation/[id]/decision
 * Body: { decision: "approved" | "rejected", reason?: string }
 *
 * Company admin (oder super_admin) — aynı şirketteki çalışanın Urlaubsantrag
 * kararını verir. Karar kaydedilir, mitarbeitere bildirim maili gider.
 *
 * Güvenlik:
 *  1. company_admin gate
 *  2. Vacation request var mı? Status hâlâ pending mi?
 *  3. Antrag sahibi aynı şirkette mi?
 *  4. Email göndermek opsiyonel — başarısızsa karar yine geçerli, log yazılır.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { admin, companyId, profile } = ctx;
  const { id } = await params;

  const body = await req.json().catch(() => null) as
    | { decision?: string; reason?: string }
    | null;
  if (!body) return NextResponse.json({ error: "Body fehlt" }, { status: 400 });

  const decision = body.decision;
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({ error: "decision muss 'approved' oder 'rejected' sein" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  // 1) Antrag holen
  const { data: vacation } = await admin
    .from("vacation_requests")
    .select("id, user_id, start_date, end_date, days_count, status, urlaub_art")
    .eq("id", id)
    .single();

  if (!vacation) return NextResponse.json({ error: "Antrag nicht gefunden" }, { status: 404 });
  if (vacation.status !== "pending") {
    return NextResponse.json({ error: "Antrag bereits bearbeitet" }, { status: 409 });
  }

  // 2) Antrag sahibi aynı şirkette mi?
  const { data: target } = await admin
    .from("profiles")
    .select("user_id, company_id, full_name, email")
    .eq("user_id", vacation.user_id)
    .single();

  if (!target || target.company_id !== companyId) {
    return NextResponse.json({ error: "Mitarbeiter nicht in deinem Unternehmen" }, { status: 403 });
  }

  // 3) Update
  const now = new Date().toISOString();
  const updatePayload =
    decision === "approved"
      ? { status: "approved", approved_at: now, approved_by: ctx.user.id, rejected_at: null, rejection_reason: null }
      : { status: "rejected", rejected_at: now, rejection_reason: reason || null, approved_at: null, approved_by: null };

  const { error: updateErr } = await admin
    .from("vacation_requests")
    .update(updatePayload)
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: "Update fehlgeschlagen", detail: updateErr.message }, { status: 500 });
  }

  // 4) Audit log (fire-and-forget)
  await logAudit({
    admin,
    actorUserId:  ctx.user.id,
    companyId,
    action:       decision === "approved" ? "vacation.approved" : "vacation.rejected",
    resourceType: "vacation_request",
    resourceId:   id,
    payload: {
      employee_user_id: vacation.user_id,
      start_date:       vacation.start_date,
      end_date:         vacation.end_date,
      days_count:       vacation.days_count,
      urlaub_art:       vacation.urlaub_art ?? null,
      ...(reason ? { rejection_reason: reason } : {}),
    },
  });

  // 5) Email (fire-and-forget — başarısızsa karar geçerli)
  if (target.email) {
    try {
      await sendVacationDecisionEmail({
        to:            target.email,
        employeeName:  target.full_name ?? target.email,
        decision,
        startDate:     vacation.start_date,
        endDate:       vacation.end_date,
        daysCount:     vacation.days_count,
        urlaubArt:     vacation.urlaub_art ?? null,
        rejectionReason: reason || null,
        decidedByName: profile.full_name ?? "Administrator",
      });
    } catch (err) {
      // Log only — kararı geri çevirmiyoruz.
      console.error("[vacation/decision] Email gönderilemedi:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    decision,
    vacationId: id,
  });
}
