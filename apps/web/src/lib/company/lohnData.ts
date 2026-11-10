/**
 * Lohn-Vorbereitung laden — gemeinsam für Seite, Versand-API und Cron.
 * Erwartet einen service_role-Client (liest Team-Daten).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TimeEntry } from "@workly/shared";
import { getFeiertage } from "@/lib/utils/feiertage";
import { notdienstLoadRange } from "@/lib/utils/weekMonth";
import { DEFAULT_TARGET_HOURS_PER_MONTH } from "@/lib/utils/monthStats";
import { monthlyTargetFromWeekly } from "./contract";
import { listFormerMembers, loadMemberAccess, inRanges } from "./membership";
import { computeLohnRows, type LohnEmployee, type LohnNd, type LohnRow } from "./lohn";

export const MONTHS_DE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

export interface CompanyLohnSettings {
  name:                 string;
  notdienst_pauschale:  number | null;
  steuerberater_email:  string | null;
  steuerberater_auto:   boolean;
  team_digest_enabled:  boolean;
  /** false = Migration 035 fehlt noch */
  settingsSupported:    boolean;
}

export async function loadCompanySettings(admin: SupabaseClient, companyId: string): Promise<CompanyLohnSettings> {
  const { data, error } = await admin.from("companies")
    .select("name, notdienst_pauschale, steuerberater_email, steuerberater_auto, team_digest_enabled")
    .eq("id", companyId).maybeSingle();
  if (!error && data) {
    const d = data as Record<string, unknown>;
    return {
      name: String(d["name"] ?? ""),
      notdienst_pauschale: d["notdienst_pauschale"] != null ? Number(d["notdienst_pauschale"]) : null,
      steuerberater_email: (d["steuerberater_email"] as string | null) ?? null,
      steuerberater_auto: !!d["steuerberater_auto"],
      team_digest_enabled: !!d["team_digest_enabled"],
      settingsSupported: true,
    };
  }
  const { data: basic } = await admin.from("companies").select("name, notdienst_pauschale").eq("id", companyId).maybeSingle();
  const b = (basic ?? {}) as Record<string, unknown>;
  return {
    name: String(b["name"] ?? ""),
    notdienst_pauschale: b["notdienst_pauschale"] != null ? Number(b["notdienst_pauschale"]) : null,
    steuerberater_email: null, steuerberater_auto: false, team_digest_enabled: false, settingsSupported: false,
  };
}

export async function loadLohnMonth(admin: SupabaseClient, companyId: string, year: number, month: number): Promise<{
  company: CompanyLohnSettings; rows: LohnRow[]; monthLabel: string;
}> {
  const company = await loadCompanySettings(admin, companyId);
  const monthLabel = `${MONTHS_DE[month - 1]} ${year}`;
  const pad = (n: number) => String(n).padStart(2, "0");
  const first = `${year}-${pad(month)}-01`;
  const last = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;

  const { data: profs } = await admin.from("profiles")
    .select("user_id, full_name, email, personal_nr, bundesland, is_active")
    .eq("company_id", companyId).is("deleted_at", null);
  type Person = { user_id: string; full_name: string | null; email: string | null; personal_nr: string | null; bundesland: string | null; is_active: boolean };
  const people = (profs ?? []) as Person[];
  // Ehemalige (Migration 042), die in diesem Monat noch dazugehörten → Lohn für den letzten Monat
  const formerIds = (await listFormerMembers(admin, companyId)).map((f) => f.user_id);
  const access = await loadMemberAccess(admin, companyId, [...people.map((p) => p.user_id), ...formerIds]);
  const formerInMonth = formerIds.filter((uid) => (access.get(uid)?.ranges ?? [])
    .some((r) => (r.from === null || r.from <= last) && (r.to === null || r.to >= first)));
  if (formerInMonth.length > 0) {
    const { data: fp } = await admin.from("profiles")
      .select("user_id, full_name, email, personal_nr, bundesland, is_active").in("user_id", formerInMonth);
    people.push(...((fp ?? []) as Person[]));
  }
  const visible = (uid: string, d: string) => { const a = access.get(uid); return !a || inRanges(d, a.ranges); };
  const ids = people.map((p) => p.user_id);
  if (ids.length === 0) return { company, rows: [], monthLabel };

  const range = notdienstLoadRange(year, month);
  const [{ data: te }, { data: nd }, { data: cl }, { data: ss }, contractRes] = await Promise.all([
    admin.from("time_entries").select("user_id, date, day_type, start_time, end_time, break_minutes").in("user_id", ids).gte("date", first).lte("date", last),
    admin.from("notdienst_entries").select("user_id, date, start_time, end_time, erledigt").in("user_id", ids).gte("date", range.start).lte("date", range.end),
    admin.from("month_closings").select("user_id, status").in("user_id", ids).eq("year", year).eq("month", month),
    admin.from("salary_settings").select("user_id, monthly_target_hours, created_at").in("user_id", ids).order("created_at", { ascending: false }),
    admin.from("profiles").select("user_id, contract_weekly_hours").in("user_id", ids),
  ]);

  const target = new Map<string, number>();
  for (const s of (ss ?? []) as { user_id: string; monthly_target_hours: number | null }[]) {
    if (!target.has(s.user_id) && Number(s.monthly_target_hours) > 0) target.set(s.user_id, Number(s.monthly_target_hours));
  }
  if (!contractRes.error) {
    for (const c of (contractRes.data ?? []) as { user_id: string; contract_weekly_hours: number | null }[]) {
      if (c.contract_weekly_hours != null) target.set(c.user_id, monthlyTargetFromWeekly(Number(c.contract_weekly_hours)));
    }
  }

  const entries = ((te ?? []) as (TimeEntry & { user_id: string })[]).filter((e) => visible(e.user_id, e.date));
  const withData = new Set(entries.map((e) => e.user_id));
  const feiertageCache = new Map<string, Record<string, string>>();
  const employees: LohnEmployee[] = people
    .filter((p) => p.is_active || withData.has(p.user_id))
    .map((p) => {
      const bl = p.bundesland ?? "NI";
      if (!feiertageCache.has(bl)) feiertageCache.set(bl, getFeiertage(year, bl));
      return {
        user_id: p.user_id, name: p.full_name ?? p.email ?? "—", personal_nr: p.personal_nr ?? null,
        targetHours: target.get(p.user_id) ?? DEFAULT_TARGET_HOURS_PER_MONTH,
        feiertage: feiertageCache.get(bl)!,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  const rows = computeLohnRows({
    employees, entries, ndEntries: ((nd ?? []) as LohnNd[]).filter((n) => visible(n.user_id, n.date)),
    closings: new Map(((cl ?? []) as { user_id: string; status: "approved" | "submitted" }[]).map((c) => [c.user_id, c.status])),
    year, month, pauschale: company.notdienst_pauschale,
  });
  return { company, rows, monthLabel };
}
