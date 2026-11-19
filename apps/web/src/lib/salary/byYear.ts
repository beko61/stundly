/**
 * Lohn-Einstellungen je Jahr (Nutzerwunsch 19.11.2026: Änderung in 2027 darf 2026 nicht verändern).
 *
 * salary_settings hat je Nutzer mehrere Zeilen mit valid_from. Für ein Jahr gilt die neueste Zeile,
 * die spätestens in diesem Jahr beginnt; gibt es keine (Jahr vor der ersten Einstellung), die älteste.
 * Gespeichert wird in die Zeile, die in diesem Jahr beginnt — fehlt sie, entsteht eine neue ab 01.01.
 * Eine Stelle für App (Gehalt, Dashboard, Berichte, Urlaub, Tracker) und Firma (Lohn, Übersicht).
 */
export interface VersionedRow {
  valid_from?: string | null;
  created_at?: string | null;
}

const key = (r: VersionedRow) => `${r.valid_from ?? ""}|${r.created_at ?? ""}`;

export function rowForYear<T extends VersionedRow>(rows: readonly T[] | null | undefined, year: number): T | null {
  if (!rows || rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => key(b).localeCompare(key(a))); // neueste zuerst
  const end = `${year}-12-31`;
  return sorted.find((r) => (r.valid_from ?? "") <= end) ?? sorted[sorted.length - 1]!;
}

/** Zeile, die in diesem Jahr beginnt (dorthin wird gespeichert) — sonst null (→ neue Zeile ab 01.01.) */
export function ownRowForYear<T extends VersionedRow>(rows: readonly T[] | null | undefined, year: number): T | null {
  const own = (rows ?? []).filter((r) => (r.valid_from ?? "").startsWith(`${year}-`));
  return rowForYear(own, year);
}

/** Mehrere Nutzer: je user_id die Zeile für das Jahr */
export function rowsForYearByUser<T extends VersionedRow & { user_id: string }>(
  rows: readonly T[] | null | undefined, year: number,
): Map<string, T> {
  const byUser = new Map<string, T[]>();
  for (const r of rows ?? []) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
  const out = new Map<string, T>();
  for (const [u, list] of byUser) { const r = rowForYear(list, year); if (r) out.set(u, r); }
  return out;
}

/** Gespeicherter Stand im Browser (Gehalt → Dashboard/Tracker live) gilt nur für sein Jahr */
export const SALARY_LS_KEY = "workly_salary_settings_v2";
export function localSettingsForYear<T extends object>(raw: string | null, year: number): Partial<T> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<T> & { _year?: number };
    return v._year === year ? v : null;
  } catch {
    return null;
  }
}
