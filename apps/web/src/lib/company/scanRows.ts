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

const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Montag der Woche, in der `d` liegt (lokal, YYYY-MM-DD). */
export function mondayOf(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

/**
 * Wochenlisten haben oft nur Spalten Mo–Fr (+ KW) ohne Datum → die KI soll nicht rechnen:
 * feste Zuordnung Wochentag → Datum für die vom Admin gewählte Woche. null bei ungültigem Datum.
 */
export function weekHint(weekStart: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return null;
  const [y, m, d] = weekStart.split("-").map(Number) as [number, number, number];
  const start = new Date(y, m - 1, d);
  if (start.getMonth() !== m - 1) return null;
  const monday = mondayOf(start);
  const [my, mm, md] = monday.split("-").map(Number) as [number, number, number];
  const days = WD.map((wd, i) => {
    const x = new Date(my, mm - 1, md + i);
    return `${wd}=${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  });
  return `Der Zettel gilt für die Woche ab Montag ${monday}. Stehen nur Wochentage (ohne Datum) da, nimm genau diese Daten: ${days.join(", ")}.`;
}
