import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { netMinutesForEntry } from "@/lib/company/admin";
import { addDays, berlinNowLocal, mondayOf } from "@/lib/company/notdienstZentrale";
import { sendTeamDigest } from "@/lib/email/companyMails";

/**
 * Montags-Überblick für den Chef — montags 05:30 UTC (vercel.json).
 * Nur Firmen mit `team_digest_enabled = true`; Empfänger: aktive company_admin/super_admin der Firma.
 * Authorization: Bearer $CRON_SECRET.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const dayDE = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET fehlt" }, { status: 500 });
  if ((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const today = berlinNowLocal().slice(0, 10);
  const thisMonday = mondayOf(today);
  const lastMonday = addDays(thisMonday, -7);
  const lastSunday = addDays(thisMonday, -1);
  const [ty, tm] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const pm = tm === 1 ? { y: ty - 1, m: 12 } : { y: ty, m: tm - 1 };

  const { data: companies, error } = await admin.from("companies").select("id, name").eq("team_digest_enabled", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: { company: string; sent: number; error?: string }[] = [];
  for (const c of (companies ?? []) as { id: string; name: string }[]) {
    try {
      const { data: people } = await admin.from("profiles")
        .select("user_id, full_name, email, role, is_active").eq("company_id", c.id).is("deleted_at", null);
      const all = (people ?? []) as { user_id: string; full_name: string | null; email: string | null; role: string; is_active: boolean }[];
      const ids = all.filter((p) => p.is_active).map((p) => p.user_id);
      const recipients = all.filter((p) => p.is_active && p.email && (p.role === "company_admin" || p.role === "super_admin"));
      if (recipients.length === 0 || ids.length === 0) { results.push({ company: c.id, sent: 0 }); continue; }

      const [{ data: te }, { count: ndCount }, { data: rota }, { data: closings }, { count: vac }, { count: unpaid }] = await Promise.all([
        admin.from("time_entries").select("date, day_type, start_time, end_time, break_minutes").in("user_id", ids).gte("date", lastMonday).lte("date", lastSunday),
        admin.from("notdienst_entries").select("id", { count: "exact", head: true }).in("user_id", ids).gte("date", lastMonday).lte("date", lastSunday),
        admin.from("notdienst_rota").select("user_id").eq("company_id", c.id).eq("week_start", thisMonday).maybeSingle(),
        admin.from("month_closings").select("status").in("user_id", ids).eq("year", pm.y).eq("month", pm.m),
        admin.from("vacation_requests").select("id", { count: "exact", head: true }).in("user_id", ids).eq("status", "pending"),
        admin.from("notdienst_entries").select("id", { count: "exact", head: true }).in("user_id", ids).eq("erledigt", false).gte("date", addDays(today, -120)),
      ]);
      const teamMin = ((te ?? []) as Parameters<typeof netMinutesForEntry>[0][]).reduce((s, e) => s + netMinutesForEntry(e), 0);
      const onDutyId = (rota as { user_id: string } | null)?.user_id;
      const onDuty = onDutyId ? (all.find((p) => p.user_id === onDutyId)?.full_name ?? all.find((p) => p.user_id === onDutyId)?.email ?? null) : null;
      const cl = (closings ?? []) as { status: string }[];
      const submitted = cl.filter((x) => x.status === "submitted").length;
      const notApproved = ids.length - cl.filter((x) => x.status === "approved").length;
      const pmName = new Date(pm.y, pm.m - 1, 1).toLocaleDateString("de-DE", { month: "long" });

      const tasks: string[] = [];
      if (submitted) tasks.push(`${submitted} × ${pmName} eingereicht — bitte freigeben`);
      else if (notApproved && Number(today.slice(8, 10)) <= 15) tasks.push(`${pmName}: ${notApproved} Mitarbeiter noch nicht freigegeben`);
      if (vac) tasks.push(`${vac} Urlaubsantr${vac === 1 ? "ag" : "äge"} offen`);
      if (unpaid) tasks.push(`${unpaid} Notdienst${unpaid === 1 ? "" : "e"} noch nicht bezahlt`);
      if (!onDutyId) tasks.push("Rufbereitschaft für diese Woche eintragen");

      let sent = 0;
      for (const r of recipients) {
        const { error: e } = await sendTeamDigest(r.email!, r.full_name ?? r.email!, {
          firma: c.name, weekLabel: `${dayDE(lastMonday)} – ${dayDE(lastSunday)}`,
          teamMin, ndCount: ndCount ?? 0, onDuty, tasks,
        });
        if (!e) sent++;
        await new Promise((res) => setTimeout(res, 250));
      }
      results.push({ company: c.id, sent });
    } catch (e) {
      results.push({ company: c.id, sent: 0, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return NextResponse.json({ week: lastMonday, results });
}
