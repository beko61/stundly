import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { decideReminder, sendReminderEmail, type ReminderType } from "@/lib/email/reminders";

/**
 * Erinnerungs-Cron — täglich 08:00 UTC (10:00 Sommerzeit).
 * Nutzer, die Stundly nach der Registrierung nicht nutzen oder seit ≥ 14 Tagen nichts
 * eingetragen haben, bekommen eine Erinnerung (Regeln: lib/email/reminders).
 *
 * Auth: Bearer $CRON_SECRET. `?dry=1` → nur Entscheidungen zurückgeben, nichts senden.
 * Braucht Migration 031 (profiles.reminder_*).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_PER_RUN = 200;

interface AuthInfo { email: string | null; createdAt: string; lastSignInAt: string | null; confirmed: boolean }

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET fehlt" }, { status: 500 });
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (token !== cronSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) {
    return NextResponse.json({ error: "Supabase-Konfiguration fehlt" }, { status: 500 });
  }
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const admin = createAdmin(supabaseUrl, serviceRole, { auth: { persistSession: false } });
  const now = new Date();

  // 1. Kandidaten: aktiv, nicht gelöscht, Erinnerungen nicht abbestellt
  const { data: profiles, error: profErr } = await admin
    .from("profiles")
    .select("user_id, vorname, full_name, reminder_emails_enabled, reminder_last_type, reminder_last_sent_at")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or("reminder_emails_enabled.is.null,reminder_emails_enabled.eq.true");
  if (profErr) {
    console.error("[cron/reminders] profiles:", profErr);
    return NextResponse.json({ error: profErr.message, hint: "Migration 031 ausgeführt?" }, { status: 500 });
  }

  // 2. Auth-Daten (E-Mail, Registrierung, letzter Login)
  const auth = new Map<string, AuthInfo>();
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const u of data.users) {
      auth.set(u.id, {
        email: u.email ?? null,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        confirmed: !!u.email_confirmed_at,
      });
    }
    if (data.users.length < 1000) break;
  }

  const results: { user_id: string; type?: ReminderType; sent?: boolean; error?: string }[] = [];
  let sent = 0;

  for (const prof of profiles ?? []) {
    if (sent >= MAX_PER_RUN) break;
    const uid = prof.user_id as string;
    const a = auth.get(uid);
    if (!a?.email || !a.confirmed) continue;

    // 3. Letzte eigene Eintragung (Beispieldaten zählen nicht)
    const [{ data: te }, { data: nd }] = await Promise.all([
      admin.from("time_entries").select("updated_at, created_at")
        .eq("user_id", uid).not("tags", "cs", "{sample}")
        .order("updated_at", { ascending: false }).limit(1),
      admin.from("notdienst_entries").select("created_at, note")
        .eq("user_id", uid).order("created_at", { ascending: false }).limit(5),
    ]);
    const stamps = [
      te?.[0]?.updated_at, te?.[0]?.created_at,
      ...(nd ?? []).filter((n) => !String(n.note ?? "").includes("Beispieldatensatz")).map((n) => n.created_at),
    ].filter(Boolean).map((s) => new Date(s as string).getTime());
    const lastDataAt = stamps.length ? new Date(Math.max(...stamps)) : null;

    const decision = decideReminder({
      now,
      signupAt:     new Date(a.createdAt),
      lastDataAt,
      lastSignInAt: a.lastSignInAt ? new Date(a.lastSignInAt) : null,
      lastType:     (prof.reminder_last_type as ReminderType | null) ?? null,
      lastSentAt:   prof.reminder_last_sent_at ? new Date(prof.reminder_last_sent_at as string) : null,
    });
    if (!decision) continue;

    if (dry) {
      results.push({ user_id: uid, type: decision.type });
      continue;
    }

    try {
      const name = ((prof.vorname as string | null) || (prof.full_name as string | null) || "").trim();
      await sendReminderEmail({ to: a.email, userId: uid, name, decision });
      await admin.from("profiles")
        .update({ reminder_last_type: decision.type, reminder_last_sent_at: now.toISOString() })
        .eq("user_id", uid);
      results.push({ user_id: uid, type: decision.type, sent: true });
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron/reminders] ${uid}:`, msg);
      results.push({ user_id: uid, type: decision.type, error: msg });
    }
    await new Promise((r) => setTimeout(r, 200)); // Resend-Rate-Limit
  }

  return NextResponse.json({
    ran_at: now.toISOString(),
    dry,
    candidates: profiles?.length ?? 0,
    sent,
    failed: results.filter((r) => r.error).length,
    by_type: results.reduce<Record<string, number>>((acc, r) => {
      if (r.type) acc[r.type] = (acc[r.type] ?? 0) + 1;
      return acc;
    }, {}),
  });
}
