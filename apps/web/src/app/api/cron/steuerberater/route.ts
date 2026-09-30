import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { loadLohnMonth } from "@/lib/company/lohnData";
import { sendLohnToSteuerberater } from "@/lib/email/companyMails";

/**
 * Steuerberater-Cron — am 5. jedes Monats 06:00 UTC (vercel.json).
 * Firmen mit `steuerberater_auto = true` bekommen die Lohn-Vorbereitung des Vormonats
 * automatisch an die hinterlegte Adresse. `steuerberater_last_sent` verhindert Doppelversand.
 * Authorization: Bearer $CRON_SECRET.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET fehlt" }, { status: 500 });
  if ((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const now = new Date();
  const year  = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const month = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth();
  const key = `${year}-${String(month).padStart(2, "0")}`;

  const { data: companies, error } = await admin.from("companies")
    .select("id, owner_id, steuerberater_email, steuerberater_last_sent")
    .eq("steuerberater_auto", true).not("steuerberater_email", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: { company: string; ok: boolean; error?: string }[] = [];
  for (const c of (companies ?? []) as { id: string; owner_id: string | null; steuerberater_email: string; steuerberater_last_sent: string | null }[]) {
    if (c.steuerberater_last_sent === key) continue;
    try {
      const { company, rows, monthLabel } = await loadLohnMonth(admin, c.id, year, month);
      if (rows.length === 0) { results.push({ company: c.id, ok: true, error: "keine Daten" }); continue; }
      const { data: owner } = c.owner_id
        ? await admin.from("profiles").select("email, full_name").eq("user_id", c.owner_id).maybeSingle()
        : { data: null };
      const { error: sendErr } = await sendLohnToSteuerberater({
        to: c.steuerberater_email, replyTo: (owner?.email as string | null) ?? null,
        firma: company.name, year, month, monthLabel, rows,
        sender: `${(owner?.full_name as string | null) ?? company.name} (automatisch)`,
      });
      if (sendErr) throw new Error(sendErr.message);
      await admin.from("companies").update({ steuerberater_last_sent: key }).eq("id", c.id);
      await admin.from("audit_log").insert({
        actor_user_id: c.owner_id, company_id: c.id, action: "lohn.sent_to_steuerberater",
        resource_type: "company", resource_id: c.id, payload: { year, month, to: c.steuerberater_email, automatic: true },
      });
      results.push({ company: c.id, ok: true });
    } catch (e) {
      results.push({ company: c.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return NextResponse.json({ month: key, sent: results.filter((r) => r.ok && !r.error).length, results });
}
