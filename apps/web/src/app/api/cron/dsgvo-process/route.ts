import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

/**
 * DSGVO Art. 17 — Recht auf Löschung: Cron Worker
 *
 * `/api/dsgvo/delete` (POST) legt eine deletion_requests-Zeile mit
 * `status='pending'` und `scheduled_for = now() + 30 Tage` an. Bis dahin
 * kann der Nutzer den Antrag über `/api/dsgvo/delete` (DELETE) widerrufen.
 *
 * Dieser Endpoint wird täglich von Vercel Cron (siehe vercel.json) aufgerufen.
 * Er:
 *   1. Findet alle pending Anträge, deren scheduled_for erreicht ist
 *   2. Löscht den Auth-User → CASCADE räumt Profil + alle referenzierten
 *      Datensätze auf (time_entries, notdienst_entries, vacation_requests,
 *      salary_settings, …)
 *   3. Markiert deletion_requests.status='completed' + completed_at
 *   4. Schreibt Audit-Log
 *
 * Autorisierung über CRON_SECRET (Bearer). Vercel Cron sendet automatisch
 * `Authorization: Bearer $CRON_SECRET`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 dk — 100'lük batch için yeterli

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET nicht konfiguriert" },
      { status: 500 },
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (token !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) {
    return NextResponse.json(
      { error: "Supabase-Konfiguration fehlt" },
      { status: 500 },
    );
  }

  const admin = createAdmin(supabaseUrl, serviceRole);
  const nowIso = new Date().toISOString();

  // 1. Pending Anträge, deren scheduled_for erreicht ist (max 100/Lauf)
  const { data: pending, error: fetchErr } = await admin
    .from("deletion_requests")
    .select("id, user_id, requested_at, scheduled_for")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(100);

  if (fetchErr) {
    console.error("[cron/dsgvo] fetch error:", fetchErr);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const results: Array<{ id: string; user_id: string; ok: boolean; error?: string }> = [];

  for (const row of pending ?? []) {
    try {
      // 2. Auth-User löschen — CASCADE räumt Profil + verknüpfte Tabellen
      const { error: delErr } = await admin.auth.admin.deleteUser(row.user_id);
      if (delErr) throw new Error(delErr.message);

      // 3. Antrag als completed markieren
      const { error: updErr } = await admin
        .from("deletion_requests")
        .update({ status: "completed", completed_at: nowIso })
        .eq("id", row.id);
      if (updErr) console.error("[cron/dsgvo] request update failed:", updErr);

      // 4. Audit-Log (fire-and-forget)
      admin
        .from("audit_logs")
        .insert({
          user_id: null,
          action: "deletion_processed",
          resource: "account",
        })
        .then(({ error }) => {
          if (error) console.error("[cron/dsgvo] audit insert failed:", error);
        });

      results.push({ id: row.id, user_id: row.user_id, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[cron/dsgvo] delete failed for user ${row.user_id}:`, message);
      results.push({ id: row.id, user_id: row.user_id, ok: false, error: message });
    }
  }

  const processed = results.filter(r => r.ok).length;
  const failed    = results.filter(r => !r.ok).length;

  return NextResponse.json({
    ran_at:    nowIso,
    total:     pending?.length ?? 0,
    processed,
    failed,
    results,
  });
}
