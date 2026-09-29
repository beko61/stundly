import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/corrections/seen
 * Mitarbeiter bestätigt, dass er die Korrekturen seiner Firma gesehen hat (entry_corrections.seen_at).
 * Keine Update-Policy auf entry_corrections → per service_role, nur eigene Zeilen.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await admin
    .from("entry_corrections")
    .update({ seen_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("seen_at", null);
  if (error) return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
