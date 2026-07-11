import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import type { TimeEntry } from "@workly/shared";
import { computeWeeklyDigestStats, sendWeeklyDigestEmail } from "@/lib/email/weeklyDigest";

/**
 * Weekly Digest Cron — her Pazartesi 06:00 UTC.
 *
 * Sadece `profiles.weekly_digest_enabled=true` olan aktif kullanıcılara
 * geçen haftanın özet mailini gönderir.
 *
 * Autorization: Bearer $CRON_SECRET (DSGVO cron ile aynı).
 *
 * Rate limiting: her mail arasında 200ms delay (Resend free tier 100/day,
 * paid 10/s). ~500 user için 100s < 300s (Vercel cap).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface DigestResult {
  user_id: string;
  ok:      boolean;
  error?:  string;
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET fehlt" }, { status: 500 });

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (token !== cronSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) {
    return NextResponse.json({ error: "Supabase-Konfiguration fehlt" }, { status: 500 });
  }

  const admin = createAdmin(supabaseUrl, serviceRole, { auth: { persistSession: false } });
  const now = new Date();
  const nowIso = now.toISOString();
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const todayISO = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

  // 1. Opt-in aktif kullanıcılar
  const { data: subscribers, error: subErr } = await admin
    .from("profiles")
    .select("user_id, full_name, email, is_active, deleted_at")
    .eq("weekly_digest_enabled", true)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (subErr) {
    console.error("[cron/weekly-digest] fetch subscribers failed:", subErr);
    return NextResponse.json({ error: subErr.message }, { status: 500 });
  }

  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ ran_at: nowIso, total: 0, sent: 0, failed: 0 });
  }

  // 2. Toplu time_entries + notdienst_entries — geçen 40 gün (hafta + ay + buffer)
  //    yearEntries için de: Krankheit episode hesabı için yıllık
  const userIds = subscribers.map((s) => s.user_id as string);
  const yearStart = `${now.getFullYear()}-01-01`;
  const monthStart = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`;
  // Geçen hafta hesabı: refDate=Monday, weekStart=Monday-7d
  // Yani en fazla 7 gün öncesine kadar veri lazım. monthStart genelde daha eski.
  const fetchFrom = monthStart < yearStart ? monthStart : yearStart;

  const [{ data: allTimeEntries }, { data: allNotdienst }] = await Promise.all([
    admin.from("time_entries")
      .select("id, user_id, date, start_time, end_time, break_minutes, day_type, is_night_shift, note, tags, synced_at, created_at, updated_at")
      .in("user_id", userIds)
      .gte("date", fetchFrom)
      .lte("date", todayISO),
    admin.from("notdienst_entries")
      .select("user_id, date, start_time, end_time")
      .in("user_id", userIds)
      .gte("date", monthStart)
      .lte("date", todayISO),
  ]);

  const entriesByUser  = new Map<string, TimeEntry[]>();
  const ndByUser       = new Map<string, Array<{ date: string; start_time: string | null; end_time: string | null }>>();
  for (const e of allTimeEntries ?? []) {
    const key = e.user_id as string;
    if (!entriesByUser.has(key)) entriesByUser.set(key, []);
    entriesByUser.get(key)!.push(e as TimeEntry);
  }
  for (const n of allNotdienst ?? []) {
    const key = n.user_id as string;
    if (!ndByUser.has(key)) ndByUser.set(key, []);
    ndByUser.get(key)!.push({ date: n.date, start_time: n.start_time, end_time: n.end_time });
  }

  // 3. Her user için email gönder (200ms delay)
  const results: DigestResult[] = [];
  for (const sub of subscribers) {
    const uid   = sub.user_id as string;
    const email = sub.email   as string | null;
    const name  = (sub.full_name as string | null) ?? "";
    if (!email) {
      results.push({ user_id: uid, ok: false, error: "no email" });
      continue;
    }
    try {
      const userEntries = entriesByUser.get(uid) ?? [];
      const stats = computeWeeklyDigestStats({
        refDate:     todayISO,
        entries:     userEntries,
        notdienst:   ndByUser.get(uid) ?? [],
        yearEntries: userEntries,
      });
      // Boş hafta — mail gönderme (aksi halde spam algısı)
      if (
        stats.weekWorkedMin === 0 &&
        stats.weekUrlaubDays === 0 &&
        stats.weekKrankDays === 0 &&
        stats.weekNotdienstDays === 0
      ) {
        results.push({ user_id: uid, ok: false, error: "empty week — skipped" });
        continue;
      }
      await sendWeeklyDigestEmail({ to: email, name: name || email, stats });
      results.push({ user_id: uid, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron/weekly-digest] send failed for ${uid}:`, msg);
      results.push({ user_id: uid, ok: false, error: msg });
    }
    // Resend rate limit safety
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  const sent   = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return NextResponse.json({
    ran_at:  nowIso,
    total:   subscribers.length,
    sent,
    failed,
    skipped: results.filter((r) => r.error === "empty week — skipped").length,
  });
}
