import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Firmenzugehörigkeit mit Zeitraum (Migration 042, Tabelle company_memberships).
 *
 * Die Firma sieht Daten eines (auch ehemaligen) Mitarbeiters nur aus dem Zeitraum
 * seiner Zugehörigkeit: [visible_from, left_at]. visible_from null = ohne Untergrenze.
 * Server-Routen laufen mit service_role (RLS greift nicht) → hier filtern.
 */

export interface MemberRange { from: string | null; to: string | null }

export interface MemberAccess {
  ranges:  MemberRange[];
  /** Nicht mehr in der Firma (alle Mitgliedschaften beendet) */
  former:  boolean;
  /** Letztes Austrittsdatum (nur bei former) */
  leftAt:  string | null;
}

type Admin = SupabaseClient;

export function inRanges(date: string, ranges: MemberRange[]): boolean {
  return ranges.some((r) => (r.from === null || date >= r.from) && (r.to === null || date <= r.to));
}

/** Zugriffsfenster für mehrere Nutzer einer Firma. Fehlt die Tabelle (Migration 042 noch nicht gelaufen),
 *  gelten aktuelle Mitglieder ohne Einschränkung (bisheriges Verhalten). */
export async function loadMemberAccess(admin: Admin, companyId: string, userIds: string[]): Promise<Map<string, MemberAccess>> {
  const out = new Map<string, MemberAccess>();
  if (userIds.length === 0) return out;

  const { data, error } = await admin
    .from("company_memberships")
    .select("user_id, visible_from, left_at")
    .eq("company_id", companyId)
    .in("user_id", userIds);

  if (error) {
    const { data: cur } = await admin.from("profiles").select("user_id").eq("company_id", companyId).in("user_id", userIds);
    for (const p of (cur ?? []) as { user_id: string }[]) {
      out.set(p.user_id, { ranges: [{ from: null, to: null }], former: false, leftAt: null });
    }
    return out;
  }

  for (const row of (data ?? []) as { user_id: string; visible_from: string | null; left_at: string | null }[]) {
    const a = out.get(row.user_id) ?? { ranges: [], former: true, leftAt: null };
    a.ranges.push({ from: row.visible_from, to: row.left_at });
    if (row.left_at === null) a.former = false;
    else if (!a.leftAt || row.left_at > a.leftAt) a.leftAt = row.left_at;
    out.set(row.user_id, a);
  }
  for (const a of out.values()) if (!a.former) a.leftAt = null;
  return out;
}

export async function getMemberAccess(admin: Admin, companyId: string, userId: string): Promise<MemberAccess | null> {
  return (await loadMemberAccess(admin, companyId, [userId])).get(userId) ?? null;
}

/** Ehemalige Mitarbeiter einer Firma (für Listen) — neueste zuerst. */
export async function listFormerMembers(admin: Admin, companyId: string): Promise<{ user_id: string; left_at: string; left_reason: string | null }[]> {
  const { data, error } = await admin
    .from("company_memberships")
    .select("user_id, left_at, left_reason")
    .eq("company_id", companyId)
    .not("left_at", "is", null)
    .order("left_at", { ascending: false });
  if (error) return [];
  const { data: open } = await admin
    .from("company_memberships").select("user_id").eq("company_id", companyId).is("left_at", null);
  const current = new Set(((open ?? []) as { user_id: string }[]).map((r) => r.user_id));
  const seen = new Set<string>();
  const out: { user_id: string; left_at: string; left_reason: string | null }[] = [];
  for (const r of (data ?? []) as { user_id: string; left_at: string; left_reason: string | null }[]) {
    if (current.has(r.user_id) || seen.has(r.user_id)) continue;
    seen.add(r.user_id);
    out.push(r);
  }
  return out;
}

/**
 * Mitarbeiter verlässt die Firma (selbst oder durch die Firma).
 * Konto und eigene Daten bleiben; der Trigger aus Migration 042 schließt die Mitgliedschaft.
 */
export async function endMembership(admin: Admin, opts: {
  userId: string; companyId: string; actorId: string; reason: "left" | "removed";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId, companyId, actorId, reason } = opts;

  const { error } = await admin
    .from("profiles")
    .update({ company_id: null, role: "individual", contract_weekly_hours: null, contract_vacation_days: null, contract_start: null })
    .eq("user_id", userId)
    .eq("company_id", companyId);
  if (error) return { ok: false, error: error.message };

  // Austrittsgrund nachtragen (Trigger hat left_at gesetzt)
  await admin
    .from("company_memberships")
    .update({ left_reason: reason, left_by: actorId })
    .eq("user_id", userId).eq("company_id", companyId)
    .is("left_reason", null).not("left_at", "is", null);

  // Künftige Notdienst-Wochen freigeben
  const today = new Date().toISOString().slice(0, 10);
  await admin.from("notdienst_rota").delete().eq("company_id", companyId).eq("user_id", userId).gt("week_start", today);

  return { ok: true };
}
