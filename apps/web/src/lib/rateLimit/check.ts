/**
 * Persistent rate limiter (sliding window) — Supabase-backed.
 *
 * Serverless-safe: her Vercel-Function-Instance aynı DB'yi okur, in-memory
 * Map'in cross-instance sorunu yok.
 *
 * Kullanım:
 *   const rl = await checkRateLimit({ bucket: `scan:${userId}`, limit: 10, windowSec: 3600 });
 *   if (!rl.allowed) return NextResponse.json({...}, { status: 429, headers: { "Retry-After": rl.retryAfterSec } });
 */

import { createClient as createAdmin } from "@supabase/supabase-js";

export interface RateLimitInput {
  /** Bucket key — e.g. "scan:userId" or "contact:ip". */
  bucket:    string;
  /** Max events in the window. */
  limit:     number;
  /** Sliding window duration (saniye). */
  windowSec: number;
}

export interface RateLimitResult {
  allowed:       boolean;
  count:         number;
  limit:         number;
  /** 429 için Retry-After header değeri (saniye). */
  retryAfterSec: number;
}

function getAdmin() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase-Konfiguration fehlt");
  return createAdmin(url, key, { auth: { persistSession: false } });
}

export async function checkRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const { bucket, limit, windowSec } = input;
  const admin = getAdmin();
  const windowStartIso = new Date(Date.now() - windowSec * 1000).toISOString();

  // Aynı bucket'ta window içi event sayısı
  const { count, error: countErr } = await admin
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket)
    .gte("created_at", windowStartIso);

  if (countErr) {
    // Fail-open (DB down → izin ver, ama logla). Kritik alt yapı; kullanıcıyı
    // bir Postgres arızasında kilitlemek istemiyoruz. Anthropic maliyet
    // patlaması riski var ama nadir + gözlenir.
    console.error("[rateLimit] count sorgu hatası, fail-open:", countErr);
    return { allowed: true, count: 0, limit, retryAfterSec: 0 };
  }

  const currentCount = count ?? 0;
  if (currentCount >= limit) {
    return {
      allowed:       false,
      count:         currentCount,
      limit,
      retryAfterSec: windowSec, // konservatif: penceresel yenilenmeyi bekle
    };
  }

  // Event kaydını ekle
  const { error: insErr } = await admin
    .from("rate_limit_events")
    .insert({ bucket });

  if (insErr) {
    // Insert fail → fail-open, count'u eski değerle geri döndür
    console.error("[rateLimit] insert hatası:", insErr);
    return { allowed: true, count: currentCount, limit, retryAfterSec: 0 };
  }

  return {
    allowed:       true,
    count:         currentCount + 1,
    limit,
    retryAfterSec: 0,
  };
}
