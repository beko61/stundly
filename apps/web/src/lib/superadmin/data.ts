import type { SupabaseClient } from "@supabase/supabase-js";
import type { SaUser } from "./metrics";

/**
 * Alle Nutzer für das Super-Admin-Panel zusammenführen:
 * profiles + auth.users (E-Mail, Login, Bestätigung, Metadaten) + Firmenname +
 * Aktivität (RPC superadmin_user_activity, Migration 032; Fallback: seitenweise lesen) +
 * offene DSGVO-Löschanträge.
 */

type Row = Record<string, unknown>;

/** PostgREST liefert max. 1000 Zeilen pro Request → seitenweise lesen */
async function fetchAll(query: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; from < 200_000; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error || !data) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

interface Activity { entryDays: number; ndCount: number; lastDataAt: string | null }

async function loadActivity(admin: SupabaseClient): Promise<Map<string, Activity>> {
  const map = new Map<string, Activity>();
  const { data, error } = await admin.rpc("superadmin_user_activity");
  if (!error && Array.isArray(data)) {
    for (const r of data as Row[]) {
      const last = [r.last_entry_at, r.last_nd_at].filter(Boolean).map((v) => new Date(v as string).getTime());
      map.set(r.user_id as string, {
        entryDays: Number(r.entry_days) || 0,
        ndCount: Number(r.nd_count) || 0,
        lastDataAt: last.length ? new Date(Math.max(...last)).toISOString() : null,
      });
    }
    return map;
  }

  // Fallback ohne Migration 032
  const [te, nd] = await Promise.all([
    fetchAll((a, b) => admin.from("time_entries").select("user_id, created_at, updated_at, tags").range(a, b)),
    fetchAll((a, b) => admin.from("notdienst_entries").select("user_id, created_at, note").range(a, b)),
  ]);
  const bump = (uid: string, at: string | null, kind: "te" | "nd") => {
    const cur = map.get(uid) ?? { entryDays: 0, ndCount: 0, lastDataAt: null };
    if (kind === "te") cur.entryDays++; else cur.ndCount++;
    if (at && (!cur.lastDataAt || at > cur.lastDataAt)) cur.lastDataAt = at;
    map.set(uid, cur);
  };
  for (const r of te) {
    if (((r.tags as string[] | null) ?? []).includes("sample")) continue;
    const at = [r.created_at, r.updated_at].filter(Boolean).sort().pop() as string | undefined;
    bump(r.user_id as string, at ?? null, "te");
  }
  for (const r of nd) {
    if (String(r.note ?? "").includes("Beispieldatensatz")) continue;
    bump(r.user_id as string, (r.created_at as string) ?? null, "nd");
  }
  return map;
}

export async function loadSuperadminUsers(admin: SupabaseClient): Promise<SaUser[]> {
  const authUsers: Row[] = [];
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    authUsers.push(...(data.users as unknown as Row[]));
    if (data.users.length < 1000) break;
  }

  const [profiles, companies, activity, deletions] = await Promise.all([
    fetchAll((a, b) => admin.from("profiles").select("*").range(a, b)),
    fetchAll((a, b) => admin.from("companies").select("id, name").range(a, b)),
    loadActivity(admin),
    fetchAll((a, b) => admin.from("deletion_requests").select("user_id").eq("status", "pending").range(a, b)),
  ]);

  const profById = new Map(profiles.map((p) => [p.user_id as string, p]));
  const companyName = new Map(companies.map((c) => [c.id as string, c.name as string]));
  const pending = new Set(deletions.map((d) => d.user_id as string));

  return authUsers.map((a): SaUser => {
    const id = a.id as string;
    const p = profById.get(id) ?? {};
    const meta = (a.user_metadata ?? {}) as Record<string, unknown>;
    const act = activity.get(id);
    const companyId = (p.company_id as string | null) ?? null;
    return {
      id,
      email:          (a.email as string | null) ?? (p.email as string | null) ?? null,
      name:           [p.vorname, p.nachname].filter(Boolean).join(" ") || (p.full_name as string | null) || (meta.full_name as string | null) || null,
      role:           (p.role as string) ?? "individual",
      isActive:       p.is_active !== false,
      companyId,
      companyName:    companyId ? companyName.get(companyId) ?? null : null,
      createdAt:      a.created_at as string,
      lastSignInAt:   (a.last_sign_in_at as string | null) ?? null,
      emailConfirmed: !!a.email_confirmed_at,
      lastDataAt:     act?.lastDataAt ?? null,
      entryDays:      act?.entryDays ?? 0,
      ndCount:        act?.ndCount ?? 0,
      source:         (meta.signup_source as string | null) ?? null,
      referredBy:     (meta.referred_by as string | null) ?? null,
      reminderLastType:   (p.reminder_last_type as string | null) ?? null,
      reminderLastSentAt: (p.reminder_last_sent_at as string | null) ?? null,
      pendingDeletion: pending.has(id),
    };
  }).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
}
