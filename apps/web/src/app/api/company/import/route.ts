import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCompanyAdminContext } from "@/lib/company/admin";
import { applyCorrection } from "@/lib/company/applyCorrection";
import { logAudit } from "@/lib/audit/logger";
import { loadMemberAccess, visibleFn } from "@/lib/company/membership";

export const maxDuration = 60;

const time = z.string().regex(/^\d{2}:\d{2}$/);
const rowSchema = z.object({
  userId:        z.string().uuid(),
  date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day_type:      z.enum(["arbeiten", "urlaub", "krank"]),
  start_time:    time.nullable(),
  end_time:      time.nullable(),
  break_minutes: z.number().int().min(0).max(600),
}).refine(
  (r) => r.day_type !== "arbeiten" || (!!r.start_time && !!r.end_time && r.start_time !== r.end_time),
  { message: "Arbeiten braucht Beginn und Ende" },
);
const bodySchema = z.object({ rows: z.array(rowSchema).min(1).max(1000) });

const REASON = "Import aus Stundenzettel-Foto";

/**
 * POST /api/company/import  Body: { rows: [{ userId, date, day_type, start_time, end_time, break_minutes }] }
 *
 * Speichert die geprüfte Foto-Import-Tabelle bei den Mitarbeitern. Jede Zeile wie eine Firmen-Korrektur
 * (applyCorrection): protokolliert in entry_corrections, der Mitarbeiter sieht sie. Unveränderte Tage
 * werden übersprungen. Nur Mitarbeiter der eigenen Firma; doppelte Person+Tag → 400 (in der Tabelle klären).
 */
export async function POST(req: NextRequest) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { admin, companyId, user } = ctx;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Zeilen – bitte Tabelle prüfen." }, { status: 400 });
  const { rows } = parsed.data;

  const seen = new Set<string>();
  for (const r of rows) {
    const k = `${r.userId}|${r.date}`;
    if (seen.has(k)) return NextResponse.json({ error: `Doppelt: gleicher Mitarbeiter am ${r.date}.` }, { status: 400 });
    seen.add(k);
  }

  const ids = [...new Set(rows.map(r => r.userId))];
  const { data: members } = await admin.from("profiles")
    .select("user_id").in("user_id", ids).eq("company_id", companyId).is("deleted_at", null);
  const allowed = new Set((members ?? []).map(m => (m as { user_id: string }).user_id));
  if (ids.some(id => !allowed.has(id))) {
    return NextResponse.json({ error: "Mitarbeiter nicht in deinem Unternehmen" }, { status: 404 });
  }

  // Keine Tage vor dem Firmeneintritt überschreiben (eigene Vorgeschichte des Mitarbeiters, Migration 042)
  const visible = visibleFn(await loadMemberAccess(admin, companyId, ids));
  const before = rows.filter((r) => !visible(r.userId, r.date));
  if (before.length > 0) {
    return NextResponse.json({
      error: `${before.length} Zeile${before.length === 1 ? "" : "n"} vor dem Firmeneintritt (z. B. ${before[0]!.date}) — bitte aus der Tabelle entfernen.`,
    }, { status: 400 });
  }

  const counts = { created: 0, updated: 0, unchanged: 0, failed: 0 };
  for (const r of rows) {
    const res = await applyCorrection(admin, {
      companyId, actorId: user.id, userId: r.userId, date: r.date, reason: REASON, skipUnchanged: true,
      entry: { day_type: r.day_type, start_time: r.start_time, end_time: r.end_time, break_minutes: r.break_minutes },
    });
    if (!res.ok) counts.failed++;
    else if (res.result !== "deleted") counts[res.result]++;
  }

  await logAudit({
    admin, actorUserId: user.id, companyId,
    action: "entries.imported", resourceType: "time_entry",
    payload: { ...counts, employees: ids.length, source: "photo" },
  });

  return NextResponse.json({ ok: counts.failed === 0, ...counts });
}
