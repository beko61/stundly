import type { getCompanyAdminContext } from "@/lib/company/admin";

type Admin = NonNullable<Awaited<ReturnType<typeof getCompanyAdminContext>>>["admin"];

export interface CorrectionEntry {
  day_type:      "arbeiten" | "urlaub" | "krank" | "feiertag" | "frei";
  start_time:    string | null;
  end_time:      string | null;
  break_minutes: number;
}

const FIELDS = "day_type, start_time, end_time, break_minutes";

/**
 * Firma setzt/ändert/löscht einen Tageseintrag — nie heimlich: Vorher/Nachher + Begründung landen in
 * entry_corrections (der Mitarbeiter sieht sie in seiner App). Schreiben per service_role (umgeht die
 * Monatssperre). Genutzt von /api/company/corrections (einzeln) und /api/company/import (Foto-Import).
 *
 * skipUnchanged (Import): ist der Eintrag schon genau so → "unchanged", nichts protokolliert/geschrieben.
 */
export async function applyCorrection(
  admin: Admin,
  p: { companyId: string; actorId: string; userId: string; date: string; reason: string; entry: CorrectionEntry | null; skipUnchanged?: boolean },
): Promise<{ ok: true; result: "created" | "updated" | "deleted" | "unchanged" } | { ok: false; error: string; status: number }> {
  const { data: beforeRow } = await admin
    .from("time_entries").select(`id, ${FIELDS}`).eq("user_id", p.userId).eq("date", p.date).maybeSingle();
  const before = beforeRow as Record<string, unknown> | null;

  // Nur Arbeiten hat echte Zeiten — Urlaub/Krank/Feiertag/Frei ohne Zeiten speichern
  const after = p.entry
    ? {
        day_type:      p.entry.day_type,
        start_time:    p.entry.day_type === "arbeiten" ? p.entry.start_time : null,
        end_time:      p.entry.day_type === "arbeiten" ? p.entry.end_time : null,
        break_minutes: p.entry.day_type === "arbeiten" ? p.entry.break_minutes : 0,
      }
    : null;

  if (!before && !after) return { ok: false, error: "Kein Eintrag vorhanden", status: 400 };

  const hhmm = (v: unknown) => (typeof v === "string" ? v.slice(0, 5) : v ?? null);
  if (p.skipUnchanged && before && after
    && before["day_type"] === after.day_type
    && hhmm(before["start_time"]) === after.start_time
    && hhmm(before["end_time"]) === after.end_time
    && Number(before["break_minutes"] ?? 0) === after.break_minutes) {
    return { ok: true, result: "unchanged" };
  }

  // Erst protokollieren (Transparenz ist Pflicht), dann ändern — schlägt die Änderung fehl, Protokoll zurücknehmen
  const { data: logRow, error: logErr } = await admin.from("entry_corrections").insert({
    user_id:      p.userId,
    company_id:   p.companyId,
    entity:       "time_entry",
    entry_date:   p.date,
    before:       before ? { day_type: before["day_type"], start_time: before["start_time"], end_time: before["end_time"], break_minutes: before["break_minutes"] } : null,
    after,
    reason:       p.reason,
    corrected_by: p.actorId,
  }).select("id").single();
  if (logErr || !logRow) return { ok: false, error: "Korrektur konnte nicht protokolliert werden", status: 500 };

  const { error: writeErr } = after
    ? await admin.from("time_entries").upsert({ user_id: p.userId, date: p.date, ...after }, { onConflict: "user_id,date" })
    : await admin.from("time_entries").delete().eq("id", before!["id"] as string);
  if (writeErr) {
    await admin.from("entry_corrections").delete().eq("id", (logRow as { id: string }).id);
    return { ok: false, error: "Korrektur konnte nicht gespeichert werden", status: 500 };
  }
  return { ok: true, result: !after ? "deleted" : before ? "updated" : "created" };
}
