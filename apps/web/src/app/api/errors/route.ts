import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit/check";
import { insertErrorEvent, sanitizeErrorPayload, shouldIgnore } from "@/lib/monitoring/errorEvents";

/**
 * POST /api/errors — Browser-Fehler aus reportError (öffentlich, auch ohne Login).
 * Antwortet immer 204, damit ein Fehler beim Melden keinen neuen Fehler auslöst.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 10_000;
const done = () => new NextResponse(null, { status: 204 });

export async function POST(req: Request) {
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return done();
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { return done(); }
    const payload = sanitizeErrorPayload(raw);
    if (!payload || shouldIgnore(payload.message)) return done();

    const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
    const rl = await checkRateLimit({ bucket: `errors:${ip}`, limit: 30, windowSec: 3600 });
    if (!rl.allowed) return done();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await insertErrorEvent("client", payload, user?.id ?? null);
  } catch (e) {
    console.error("[api/errors]", e);
  }
  return done();
}
