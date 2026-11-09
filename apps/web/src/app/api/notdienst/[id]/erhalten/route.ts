import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/logger";

/**
 * POST /api/notdienst/[id]/erhalten  Body: { erhalten: boolean }
 *
 * Firmen-Mitarbeiter bestätigt den Zahlungseingang eines Notdienst-Einsatzes (Migration 041):
 * Firma markiert "überwiesen" (ueberwiesen_am) → Mitarbeiter bestätigt → erledigt = true (= bezahlt).
 * Nur der eigene Einsatz, nur wenn überwiesen. Per service_role, weil der DB-Schutz direkte Änderungen
 * an erledigt verbietet und die Bestätigung auch im abgeschlossenen Monat möglich sein muss.
 */
const bodySchema = z.object({ erhalten: z.boolean() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  const { erhalten } = parsed.data;

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: row } = await admin.from("notdienst_entries")
    .select("id, user_id, date, erledigt, ueberwiesen_am").eq("id", id).maybeSingle();
  const nd = row as { id: string; user_id: string; date: string; erledigt: boolean | null; ueberwiesen_am: string | null } | null;
  if (!nd || nd.user_id !== user.id) return NextResponse.json({ error: "Einsatz nicht gefunden" }, { status: 404 });
  // Einzelpersonen setzen "bezahlt" selbst; diese Bestätigung gibt es nur in einer Firma
  const { data: prof } = await admin.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle();
  const companyId = (prof as { company_id: string | null } | null)?.company_id;
  if (!companyId) return NextResponse.json({ error: "Nur für Firmen-Mitarbeiter" }, { status: 400 });
  if (erhalten && !nd.ueberwiesen_am) {
    return NextResponse.json({ error: "Deine Firma hat diesen Einsatz noch nicht als überwiesen markiert." }, { status: 409 });
  }

  if (!!nd.erledigt !== erhalten) {
    const { error } = await admin.from("notdienst_entries").update({ erledigt: erhalten }).eq("id", id);
    if (error) return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 });

    await logAudit({
      admin,
      actorUserId:  user.id,
      companyId,
      action:       erhalten ? "notdienst.payment_confirmed" : "notdienst.payment_disputed",
      resourceType: "notdienst_entry",
      resourceId:   id,
      payload:      { date: nd.date },
    });
  }
  return NextResponse.json({ ok: true, erledigt: erhalten });
}
