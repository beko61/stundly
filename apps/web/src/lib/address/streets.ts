/**
 * Adress-Helfer für den Notdienst-Dialog: Straßenvorschläge je PLZ (Daten: OpenPLZ API,
 * über /api/address/streets geproxied) und Zerlegen/Zusammensetzen des `adresse`-Feldes.
 *
 * `notdienst_entries.adresse` bleibt ein einzelnes Textfeld im Format
 * "Straße Nr, PLZ Ort" — keine Migration nötig, alte Freitexte bleiben gültig.
 */

export interface StreetSuggestion {
  name: string;
  ort:  string;
}

export interface AdresseParts {
  strasse: string;
  plz:     string;
  ort:     string;
}

/** OpenPLZ kürzt ab ("Hildesheimer Str.", "Wiehbergstr.") — für die Anzeige ausschreiben. */
export function normalizeStreetName(name: string): string {
  return name.trim().replace(/([Ss])tr\.$/, "$1traße");
}

/** Seiten zusammenführen: ausschreiben, Duplikate (gleiche Straße, mehrere Abschnitte) entfernen, sortieren. */
export function mergeStreets(items: Array<{ name: string; locality: string }>): StreetSuggestion[] {
  const seen = new Map<string, StreetSuggestion>();
  for (const it of items) {
    if (!it.name) continue;
    const s = { name: normalizeStreetName(it.name), ort: it.locality ?? "" };
    const key = `${s.name}|${s.ort}`;
    if (!seen.has(key)) seen.set(key, s);
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
}

/** Orte einer PLZ, häufigster zuerst (manche PLZ decken mehrere Orte ab). */
export function orteOf(streets: StreetSuggestion[]): string[] {
  const count = new Map<string, number>();
  for (const s of streets) if (s.ort) count.set(s.ort, (count.get(s.ort) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([ort]) => ort);
}

function norm(s: string): string {
  return s.toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/str\.?(?=\s|$)/g, "strasse")
    .replace(/[^a-z0-9äöü]/g, "");
}

/** Eingabe ohne Hausnummer ("Hildesheimer Str 12a" → "Hildesheimer Str"). */
export function streetQuery(input: string): string {
  return input.replace(/\s+\d+\s*[a-zA-Z]?(\s*[-/]\s*\d+\s*[a-zA-Z]?)?\s*$/, "").trim();
}

/**
 * Vorschläge zur Eingabe — Teilwort-Treffer, Wortanfang zuerst ("str"/"straße" gleichwertig).
 * Leer, sobald eine Hausnummer getippt wird (ein Klick würde sie überschreiben) oder die
 * Eingabe wörtlich einer Straße entspricht (gerade ausgewählt).
 */
export function filterStreets(streets: StreetSuggestion[], input: string, limit = 6): StreetSuggestion[] {
  const raw = input.trim();
  const typed = streetQuery(raw);
  if (typed !== raw) return [];
  const q = norm(typed);
  if (q.length < 2) return [];
  if (streets.some(s => s.name.toLowerCase() === typed.toLowerCase())) return [];
  const hits = streets.filter(s => norm(s.name).includes(q));
  return hits
    .sort((a, b) => Number(!norm(a.name).startsWith(q)) - Number(!norm(b.name).startsWith(q)))
    .slice(0, limit);
}

/** "Hildesheimer Straße 5, 30519 Hannover" → Teile. Freitext ohne PLZ landet komplett in `strasse`. */
export function splitAdresse(adresse: string | null | undefined): AdresseParts {
  const a = (adresse ?? "").trim();
  const m = a.match(/^(.*?),\s*(\d{5})\s*(.*)$/);
  if (!m) return { strasse: a, plz: "", ort: "" };
  return { strasse: m[1]!.trim(), plz: m[2]!, ort: m[3]!.trim() };
}

export function joinAdresse({ strasse, plz, ort }: AdresseParts): string {
  const city = [plz.trim(), ort.trim()].filter(Boolean).join(" ");
  return [strasse.trim(), city].filter(Boolean).join(", ");
}
