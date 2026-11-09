import { matchEmployee, type TeamMember } from "@/lib/company/nameMatch";

/** Eine Zeile der Foto-Import-Tabelle (Firma). */
export interface ScanRow {
  name:          string;          // wie auf dem Zettel
  userId:        string | null;   // Vorschlag (eindeutiger Treffer), sonst wählt der Admin
  date:          string;          // YYYY-MM-DD oder "" (unbekannt)
  day_type:      "arbeiten" | "urlaub" | "krank";
  start_time:    string | null;
  end_time:      string | null;
  break_minutes: number;
}

const TYP: Record<string, ScanRow["day_type"]> = { A: "arbeiten", U: "urlaub", K: "krank" };
const TIME = /^\d{1,2}:\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const hhmm = (v: unknown) => (typeof v === "string" && TIME.test(v) ? v.padStart(5, "0") : null);

/**
 * KI-Antwort (kompakt: je Person eine Tagesliste ["YYYY-MM-DD","HH:MM","HH:MM",Pause,"A|U|K"])
 * → flache, geprüfte Zeilen mit Mitarbeiter-Vorschlag. Arbeitstage ohne Beginn/Ende fallen weg.
 */
export function toRows(parsed: unknown, team: TeamMember[]): ScanRow[] {
  const personen = (parsed as { personen?: unknown } | null)?.personen;
  if (!Array.isArray(personen)) return [];
  const rows: ScanRow[] = [];
  for (const p of personen as { name?: unknown; tage?: unknown }[]) {
    const name = typeof p?.name === "string" ? p.name.trim() : "";
    if (!name || !Array.isArray(p.tage)) continue;
    const userId = matchEmployee(name, team);
    for (const t of p.tage as unknown[]) {
      if (!Array.isArray(t)) continue;
      const [datum, beginn, ende, pause, typ] = t as unknown[];
      const day_type = TYP[String(typ ?? "A").toUpperCase()] ?? "arbeiten";
      const start_time = hhmm(beginn), end_time = hhmm(ende);
      if (day_type === "arbeiten" && (!start_time || !end_time)) continue;
      rows.push({
        name, userId,
        date: typeof datum === "string" && DATE.test(datum) ? datum : "",
        day_type,
        start_time: day_type === "arbeiten" ? start_time : null,
        end_time:   day_type === "arbeiten" ? end_time : null,
        break_minutes: day_type === "arbeiten" ? Math.max(0, Math.min(600, Math.round(Number(pause) || 0))) : 0,
      });
    }
  }
  return rows;
}
