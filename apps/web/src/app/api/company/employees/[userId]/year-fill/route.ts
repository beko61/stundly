import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCompanyAdminContext, getTeamMember } from "@/lib/company/admin";
import { getMemberAccess, inRanges } from "@/lib/company/membership";
import { logAudit } from "@/lib/audit/logger";
import { getFeiertage } from "@/lib/utils/feiertage";
import { planYearFill, type WeekPlan } from "@/lib/utils/yearFill";
import { AUTOFILL_TAG } from "@/lib/company/monthCheck";
import { CALENDAR_LAST_YEAR } from "@/lib/utils/years";

/**
 * POST /api/company/employees/[userId]/year-fill
 * Body: { year, week: { "1": { start, end, pause } | null, … "6": … } }  (1 = Mo … 6 = Sa)
 *
 * Chef füllt das Jahr eines Mitarbeiters mit den Zeiten, die er je Wochentag eingibt (Mo–Sa;
 * ohne Feiertage des Bundeslands des Mitarbeiters). Nur ab heute — vergangene Tage bleiben echte Einträge. Übersprungen: vorhandene
 * Einträge, Urlaubsanträge (offen/genehmigt), Tage vor Vertragsbeginn/Firmeneintritt.
 * Schon automatisch gefüllte Tage (Markierung "autofill") bekommen die neuen Zeiten — an abgewählten
 * Wochentagen werden sie entfernt; selbst eingetragene oder geänderte Tage (ohne Markierung) bleiben.
 *
 * DELETE …/year-fill?year=  entfernt alle automatisch gefüllten Tage des Jahres ab heute.
 */
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const daySchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end:   z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  pause: z.number().int().min(0).max(240),
}).refine((d) => toMin(d.end) - toMin(d.start) > d.pause, { message: "Ende nach Beginn (inkl. Pause)" }).nullable();
const bodySchema = z.object({
  year: z.number().int(),
  week: z.object({ 1: daySchema, 2: daySchema, 3: daySchema, 4: daySchema, 5: daySchema, 6: daySchema })
    .refine((w) => Object.values(w).some(Boolean), { message: "Mindestens ein Arbeitstag" }),
});

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { admin, companyId, user } = ctx;
  const { userId } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  const today = iso(new Date());
  const thisYear = Number(today.slice(0, 4));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bitte Zeiten prüfen: Ende nach Beginn, mindestens ein Arbeitstag." }, { status: 400 });
  }
  if (parsed.data.year < thisYear || parsed.data.year > CALENDAR_LAST_YEAR) {
    return NextResponse.json({ error: `Nur ${thisYear} bis ${CALENDAR_LAST_YEAR}.` }, { status: 400 });
  }
  const { year } = parsed.data;
  const week = parsed.data.week as WeekPlan;

  const member = await getTeamMember(admin, companyId, userId);
  if (!member || member.role !== "employee") {
    return NextResponse.json({ error: "Mitarbeiter nicht gefunden" }, { status: 404 });
  }

  const [{ data: prof }, { data: entries }, { data: vacations }, access] = await Promise.all([
    admin.from("profiles").select("bundesland, contract_start").eq("user_id", userId).maybeSingle(),
    admin.from("time_entries").select("date, tags").eq("user_id", userId).gte("date", `${year}-01-01`).lte("date", `${year}-12-31`),
    admin.from("vacation_requests").select("start_date, end_date").eq("user_id", userId)
      .in("status", ["pending", "approved"]).lte("start_date", `${year}-12-31`).gte("end_date", `${year}-01-01`),
    getMemberAccess(admin, companyId, userId),
  ]);
  const p = (prof ?? {}) as { bundesland?: string | null; contract_start?: string | null };
  const all = (entries ?? []) as { date: string; tags: string[] | null }[];
  const auto = new Set(all.filter((e) => (e.tags ?? []).includes(AUTOFILL_TAG)).map((e) => e.date));
  const existing = new Set(all.filter((e) => !auto.has(e.date)).map((e) => e.date)); // echte Einträge
  const vac = (vacations ?? []) as { start_date: string; end_date: string }[];
  const from = p.contract_start && p.contract_start > today ? p.contract_start : today;

  const rows = planYearFill({
    year, feiertage: getFeiertage(year, p.bundesland ?? "NI"), week,
    skip: (d) =>
      d < from
      || existing.has(d)
      || vac.some((v) => d >= v.start_date && d <= v.end_date)
      || (!!access && !inRanges(d, access.ranges)),
  }).map((r) => ({ ...r, user_id: userId }));

  // Automatisch gefüllte Tage an jetzt abgewählten Wochentagen entfernen (z. B. Freitag versehentlich gefüllt)
  const offDays = [...auto].filter((d) => {
    if (d < from || !d.startsWith(`${year}-`)) return false;
    const dow = new Date(`${d}T12:00:00`).getDay();
    return dow === 0 || !week[dow as 1 | 2 | 3 | 4 | 5 | 6];
  });
  if (offDays.length) {
    const { error } = await admin.from("time_entries").delete()
      .eq("user_id", userId).in("date", offDays).contains("tags", [AUTOFILL_TAG]);
    if (error) return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 });
  }

  if (rows.length === 0) return NextResponse.json({ ok: true, inserted: 0, updated: 0, removed: offDays.length });

  const fresh = rows.filter((r) => !auto.has(r.date));
  const refill = rows.filter((r) => auto.has(r.date));
  // Neue Tage: ignoreDuplicates — trägt der Mitarbeiter gerade selbst ein, gewinnt sein Eintrag
  const { error: e1 } = fresh.length
    ? await admin.from("time_entries").upsert(fresh, { onConflict: "user_id,date", ignoreDuplicates: true })
    : { error: null };
  const { error: e2 } = refill.length
    ? await admin.from("time_entries").upsert(refill, { onConflict: "user_id,date" })
    : { error: null };
  if (e1 || e2) return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 });

  await logAudit({
    admin, actorUserId: user.id, companyId,
    action: "entries.year_filled", resourceType: "time_entry", resourceId: userId,
    payload: { year, inserted: fresh.length, updated: refill.length, removed: offDays.length, from, week },
  });

  return NextResponse.json({ ok: true, inserted: fresh.length, updated: refill.length, removed: offDays.length, from });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { admin, companyId, user } = ctx;
  const { userId } = await params;

  const today = iso(new Date());
  const thisYear = Number(today.slice(0, 4));
  const year = Number(req.nextUrl.searchParams.get("year"));
  if (!Number.isInteger(year) || year < thisYear || year > CALENDAR_LAST_YEAR) {
    return NextResponse.json({ error: `Nur ${thisYear} bis ${CALENDAR_LAST_YEAR}.` }, { status: 400 });
  }
  const member = await getTeamMember(admin, companyId, userId);
  if (!member || member.role !== "employee") {
    return NextResponse.json({ error: "Mitarbeiter nicht gefunden" }, { status: 404 });
  }

  // Nur automatisch gefüllte Tage ab heute — selbst eingetragene und vergangene bleiben
  const from = year === thisYear ? today : `${year}-01-01`;
  const { data, error } = await admin.from("time_entries").delete()
    .eq("user_id", userId).gte("date", from).lte("date", `${year}-12-31`)
    .contains("tags", [AUTOFILL_TAG]).select("date");
  if (error) return NextResponse.json({ error: "Löschen fehlgeschlagen" }, { status: 500 });
  const removed = (data ?? []).length;

  await logAudit({
    admin, actorUserId: user.id, companyId,
    action: "entries.year_fill_removed", resourceType: "time_entry", resourceId: userId,
    payload: { year, removed, from },
  });
  return NextResponse.json({ ok: true, removed });
}
