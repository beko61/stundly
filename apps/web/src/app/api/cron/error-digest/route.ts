import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { groupErrors, type ErrorRow } from "@/lib/monitoring/errorEvents";
import { sendErrorDigest } from "@/lib/email/errorDigest";

/**
 * Täglich 07:00 UTC (vercel.json): Fehler der letzten 24 h an alle aktiven super_admin
 * mailen (nur wenn es welche gab) und Ereignisse älter als 30 Tage löschen.
 * Authorization: Bearer $CRON_SECRET.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET fehlt" }, { status: 500 });
  if ((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { count: deleted } = await admin.from("error_events").delete({ count: "exact" }).lt("created_at", cutoff);

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await admin.from("error_events")
    .select("id, created_at, source, fingerprint, message, stack, location, path, digest, user_id, app_version")
    .gte("created_at", since).order("created_at", { ascending: false }).limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as ErrorRow[];
  if (rows.length === 0) return NextResponse.json({ ran_at: new Date().toISOString(), errors: 0, sent: 0, deleted: deleted ?? 0 });

  const groups = groupErrors(rows);
  const { data: admins } = await admin.from("profiles")
    .select("email").eq("role", "super_admin").eq("is_active", true).is("deleted_at", null);
  let sent = 0;
  for (const a of (admins ?? []) as { email: string | null }[]) {
    if (!a.email) continue;
    try { await sendErrorDigest(a.email, groups, rows.length); sent++; }
    catch (e) { console.error("[cron/error-digest] mail", e); }
  }

  return NextResponse.json({ ran_at: new Date().toISOString(), errors: rows.length, groups: groups.length, sent, deleted: deleted ?? 0 });
}
