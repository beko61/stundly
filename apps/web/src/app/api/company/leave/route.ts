import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { endMembership } from "@/lib/company/membership";
import { logAudit } from "@/lib/audit/logger";

/**
 * POST /api/company/leave
 *
 * Mitarbeiter verlässt seine Firma selbst. Konto und eigene Daten bleiben (weiter als Einzelperson);
 * die Firma sieht die Daten aus dem Zeitraum der Zugehörigkeit weiterhin (Migration 042).
 * Inhaber (company_admin) können hier nicht austreten.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role, company_id, full_name, email").eq("user_id", user.id).maybeSingle();
  if (!profile?.company_id) return NextResponse.json({ error: "Du gehörst zu keiner Firma." }, { status: 400 });
  if (profile.role !== "employee") {
    return NextResponse.json({ error: "Als Inhaber kannst du die Firma nicht verlassen." }, { status: 400 });
  }

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const companyId = profile.company_id as string;
  const res = await endMembership(admin, { userId: user.id, companyId, actorId: user.id, reason: "left" });
  if (!res.ok) return NextResponse.json({ error: "Austritt fehlgeschlagen" }, { status: 500 });

  await logAudit({
    admin,
    actorUserId:  user.id,
    companyId,
    action:       "employee.left",
    resourceType: "profile",
    resourceId:   user.id,
    payload:      { target_full_name: profile.full_name, target_email: profile.email },
  });

  return NextResponse.json({ ok: true });
}
