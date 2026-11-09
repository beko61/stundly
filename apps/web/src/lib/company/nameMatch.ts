/**
 * Name vom Stundenzettel-Foto → Mitarbeiter der Firma (Foto-Import).
 * Handschrift/Schichtpläne schreiben "Müller", "M. Müller", "Mueller Max", "Max" …
 * Nur eindeutige Treffer werden zugeordnet; sonst wählt der Admin in der Tabelle selbst.
 */

export interface TeamMember { user_id: string; full_name: string | null; vorname?: string | null; nachname?: string | null }

export function normName(s: string): string {
  return s.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/ı/g, "i") // türkisches ı zerfällt nicht per NFD
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(m: TeamMember): string[] {
  const all = [m.full_name, m.vorname, m.nachname].filter(Boolean).join(" ");
  return [...new Set(normName(all).split(" ").filter(t => t.length > 1))];
}

/** user_id des eindeutig passenden Mitarbeiters oder null. */
export function matchEmployee(raw: string, team: TeamMember[]): string | null {
  const parts = normName(raw).split(" ").filter(Boolean);
  if (parts.length === 0) return null;
  const words = parts.filter(t => t.length > 1);         // ganze Namensteile
  const initials = parts.filter(t => t.length === 1);    // "M." → m

  const score = (m: TeamMember): number => {
    const tk = tokens(m);
    if (words.length === 0 || !words.every(w => tk.includes(w))) return 0;
    if (!initials.every(i => tk.some(t => t.startsWith(i)))) return 0;
    return words.length * 10 + initials.length;
  };

  const scored = team.map(m => ({ id: m.user_id, s: score(m) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
  if (scored.length === 0) return null;
  if (scored.length > 1 && scored[1]!.s === scored[0]!.s) return null; // mehrdeutig
  return scored[0]!.id;
}
