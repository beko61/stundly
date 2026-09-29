import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCompanyAdminContext, getTeamMember } from "@/lib/company/admin";
import { logAudit } from "@/lib/audit/logger";

/**
 * POST /api/company/corrections
 * Body: { userId, date, reason, entry: { day_type, start_time, end_time, break_minutes } | null }
 *
 * Firma korrigiert einen Tageseintrag — nie heimlich: Vorher/Nachher + Begründung landen in
 * entry_corrections, der Mitarbeiter sieht die Korrektur in seiner App.
 * entry = null → Eintrag löschen. Schreiben per service_role (umgeht auch die Monatssperre).
 */
const time = z.string().regex(/^\d{2}:\d{2}$/);
const bodySchema = z.object({
  userId: z.string().uuid(),
  date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(3).max(500),
  entry:  z.object({
    day_type:      z.enum(["arbeiten", "urlaub", "krank", "feiertag", "frei"]),
    start_time:    time.nullable(),
    end_time:      time.nullable(),
    break_minutes: z.number().int().min(0).max(600),
  }).nullable(),
}).refine(
  (b) => !b.entry || b.entry.day_type !== "arbeiten" || (!!b.entry.start_time && !!b.entry.end_time && b.entry.start_time !== b.entry.end_time),
  { message: "Arbeiten braucht Beginn und Ende", path: ["entry"] },
);

const FIELDS = "day_type, start_time, end_time, break_minutes";

export async function POST(req: NextRequest) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { admin, companyId } = ctx;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { userId, date, reason, entry } = parsed.data;

  if (!(await getTeamMember(admin, companyId, userId))) {
    return NextResponse.json({ error: "Mitarbeiter nicht gefunden" }, { status: 404 });
  }

  const { data: beforeRow } = await admin
    .from("time_entries").select(`id, ${FIELDS}`).eq("user_id", userId).eq("date", date).maybeSingle();
  const before = beforeRow as Record<string, unknown> | null;

  // Nur Arbeiten hat echte Zeiten — Urlaub/Krank/Feiertag/Frei ohne Zeiten speichern
  const after = entry
    ? {
        day_type:      entry.day_type,
        start_time:    entry.day_type === "arbeiten" ? entry.start_time : null,
        end_time:      entry.day_type === "arbeiten" ? entry.end_time : null,
        break_minutes: entry.day_type === "arbeiten" ? entry.break_minutes : 0,
      }
    : null;

  if (!before && !after) return NextResponse.json({ error: "Kein Eintrag vorhanden" }, { status: 400 });

  // Erst protokollieren (Transparenz ist Pflicht), dann ändern — schlägt die Änderung fehl, Protokoll zurücknehmen
  const { data: logRow, error: logErr } = await admin.from("entry_corrections").insert({
    user_id:      userId,
    company_id:   companyId,
    entity:       "time_entry",
    entry_date:   date,
    before:       before ? { day_type: before["day_type"], start_time: before["start_time"], end_time: before["end_time"], break_minutes: before["break_minutes"] } : null,
    after,
    reason,
    corrected_by: ctx.user.id,
  }).select("id").single();
  if (logErr || !logRow) return NextResponse.json({ error: "Korrektur konnte nicht protokolliert werden" }, { status: 500 });

  const { error: writeErr } = after
    ? await admin.from("time_entries").upsert({ user_id: userId, date, ...after }, { onConflict: "user_id,date" })
    : await admin.from("time_entries").delete().eq("id", before!["id"] as string);
  if (writeErr) {
    await admin.from("entry_corrections").delete().eq("id", (logRow as { id: string }).id);
    return NextResponse.json({ error: "Korrektur konnte nicht gespeichert werden" }, { status: 500 });
  }

  await logAudit({
    admin,
    actorUserId:  ctx.user.id,
    companyId,
    action:       "entry.corrected",
    resourceType: "time_entry",
    resourceId:   userId,
    payload:      { date, reason, deleted: !after },
  });

  return NextResponse.json({ ok: true });
}
