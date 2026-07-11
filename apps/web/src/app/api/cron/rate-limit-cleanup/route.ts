import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

/**
 * Rate-limit cleanup cron — günlük 24h'den eski rate_limit_events kaydını siler.
 *
 * Sliding window en fazla 1h; 24h fazla margin. Tablo şişmesini önler.
 * Autorization: Bearer $CRON_SECRET (aynı DSGVO cron gibi).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET fehlt" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (token !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) {
    return NextResponse.json({ error: "Supabase-Konfiguration fehlt" }, { status: 500 });
  }

  const admin = createAdmin(supabaseUrl, serviceRole, { auth: { persistSession: false } });
  const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { error, count } = await admin
    .from("rate_limit_events")
    .delete({ count: "exact" })
    .lt("created_at", cutoffIso);

  if (error) {
    console.error("[cron/rate-limit-cleanup] delete failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ran_at: new Date().toISOString(),
    deleted: count ?? 0,
    cutoff: cutoffIso,
  });
}
