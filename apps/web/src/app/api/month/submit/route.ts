import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/month/submit
 * Body: { year, month, action: "submit" | "withdraw" }
 *
 * Firmen-Mitarbeiter reicht seinen Monat bei der Firma ein (month_closings, Migration 033)
 * bzw. zieht die Einreichung zurück, solange die Firma noch nicht freigegeben hat.
 * month_closings hat keine Schreib-Policies → Schreiben per service_role nach Prüfung.
 */
const bodySchema = z.object({
  year:   z.number().int().min(2020).max(2100),
  month:  z.number().int().min(1).max(12),
  action: z.enum(["submit", "withdraw"]),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  const { year, month, action } = parsed.data;

  const { data: profile } = await supabase
    .from("profiles").select("company_id").eq("user_id", user.id).maybeSingle();
  const companyId = (profile?.company_id as string | null) ?? null;
  if (!companyId) return NextResponse.json({ error: "Du gehörst zu keiner Firma" }, { status: 403 });

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: existing } = await admin
    .from("month_closings")
    .select("id, status")
    .eq("user_id", user.id).eq("year", year).eq("month", month)
    .maybeSingle();
  const row = existing as { id: string; status: string } | null;

  if (row?.status === "approved") {
    return NextResponse.json({ error: "Der Monat ist bereits von deiner Firma freigegeben." }, { status: 409 });
  }

  if (action === "submit") {
    const payload = { user_id: user.id, company_id: companyId, year, month, status: "submitted", submitted_at: new Date().toISOString() };
    const { error } = row
      ? await admin.from("month_closings").update(payload).eq("id", row.id)
      : await admin.from("month_closings").insert(payload);
    if (error) return NextResponse.json({ error: "Einreichen fehlgeschlagen" }, { status: 500 });
    return NextResponse.json({ ok: true, status: "submitted" });
  }

  if (row) {
    const { error } = await admin.from("month_closings").delete().eq("id", row.id);
    if (error) return NextResponse.json({ error: "Zurückziehen fehlgeschlagen" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: null });
}
