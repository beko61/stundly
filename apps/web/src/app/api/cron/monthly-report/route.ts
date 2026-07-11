import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import type { TimeEntry } from "@workly/shared";
import { computeMonthlyReportStats, sendMonthlyReportEmail } from "@/lib/email/monthlyReport";
import { notdienstBelongsToMonth, notdienstLoadRange } from "@/lib/utils/weekMonth";

/**
 * Monthly Report Cron — her ayın 1'i 06:00 UTC.
 *
 * Sadece `profiles.monthly_report_enabled=true` olan aktif kullanıcılara
 * önceki ayın özet raporunu gönderir. Notdienst-Wochen-Zuordnung uygulanır.
 *
 * Autorization: Bearer $CRON_SECRET.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  // Önceki ay: bu ayın 1'inde çalışıyoruz, önceki ay = getMonth() (0-indexed)
  // Ör: 2026-08-01 çalışıyor → prev = 2026-07 (Temmuz)
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevYear  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const monthStartISO = `${prevYear}-${pad2(prevMonth)}-01`;
  const daysInPrev = new Date(prevYear, prevMonth, 0).getDate();
  const monthEndISO = `${prevYear}-${pad2(prevMonth)}-${pad2(daysInPrev)}`;
  const yearStartISO = `${prevYear}-01-01`;
  const yearEndISO   = `${prevYear}-12-31`;

  // 1. Opt-in aktif kullanıcılar
  const { data: subscribers, error: subErr } = await admin
    .from("profiles")
    .select("user_id, full_name, email, is_active, deleted_at")
    .eq("monthly_report_enabled", true)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (subErr) {
    console.error("[cron/monthly-report] fetch subscribers failed:", subErr);
    return NextResponse.json({ error: subErr.message }, { status: 500 });
  }

  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ ran_at: nowIso, total: 0, sent: 0, failed: 0 });
  }

  // 2. Toplu time_entries (o yıl) + notdienst_entries (o ay ±7 gün hafta atfı için)
  const userIds = subscribers.map((s) => s.user_id as string);
  const ndRange = notdienstLoadRange(prevYear, prevMonth);

  const [{ data: allTimeEntries }, { data: allNotdienst }] = await Promise.all([
    admin.from("time_entries")
      .select("id, user_id, date, start_time, end_time, break_minutes, day_type, is_night_shift, note, tags, synced_at, created_at, updated_at")
      .in("user_id", userIds)
      .gte("date", yearStartISO)
      .lte("date", yearEndISO),
    admin.from("notdienst_entries")
      .select("user_id, date, start_time, end_time")
      .in("user_id", userIds)
      .gte("date", ndRange.start)
      .lte("date", ndRange.end),
  ]);

  const entriesByUser = new Map<string, TimeEntry[]>();
  const ndByUser      = new Map<string, Array<{ date: string; start_time: string | null; end_time: string | null }>>();
  for (const e of allTimeEntries ?? []) {
    const key = e.user_id as string;
    if (!entriesByUser.has(key)) entriesByUser.set(key, []);
    entriesByUser.get(key)!.push(e as TimeEntry);
  }
  for (const n of allNotdienst ?? []) {
    const key = n.user_id as string;
    // Hafta-Pazar-ay-atfı burada uygulanır
    if (!notdienstBelongsToMonth(n.date, prevYear, prevMonth)) continue;
    if (!ndByUser.has(key)) ndByUser.set(key, []);
    ndByUser.get(key)!.push({ date: n.date, start_time: n.start_time, end_time: n.end_time });
  }

  // 3. Her user için email gönder (200ms delay)
  const results: Array<{ user_id: string; ok: boolean; error?: string }> = [];

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
      // O aya ait entries
      const monthEntries = userEntries.filter((e) => e.date >= monthStartISO && e.date <= monthEndISO);
      const stats = computeMonthlyReportStats({
        year:        prevYear,
        month:       prevMonth,
        entries:     monthEntries,
        notdienst:   ndByUser.get(uid) ?? [],
        yearEntries: userEntries,
      });
      // Boş ay — skip
      if (
        stats.monthWorkedMin === 0 &&
        stats.monthUrlaubDays === 0 &&
        stats.monthKrankDays === 0 &&
        stats.monthNotdienstDays === 0
      ) {
        results.push({ user_id: uid, ok: false, error: "empty month — skipped" });
        continue;
      }
      await sendMonthlyReportEmail({ to: email, name: name || email, stats });
      results.push({ user_id: uid, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron/monthly-report] send failed for ${uid}:`, msg);
      results.push({ user_id: uid, ok: false, error: msg });
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  const sent    = results.filter((r) => r.ok).length;
  const failed  = results.filter((r) => !r.ok).length;
  const skipped = results.filter((r) => r.error === "empty month — skipped").length;

  return NextResponse.json({ ran_at: nowIso, total: subscribers.length, sent, failed, skipped, year: prevYear, month: prevMonth });
}
