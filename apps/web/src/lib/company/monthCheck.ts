/**
 * Monatsprüfung für den Firmen-Abschluss: findet Auffälligkeiten, damit der Chef nur
 * die kritischen Tage ansehen muss (statt jede Zeile).
 *
 *   over10h   — §3 ArbZG: mehr als 10 h netto an einem Tag
 *   pause     — §4 ArbZG: > 6 h ohne 30 min bzw. > 9 h ohne 45 min Pause
 *   ruhezeit  — §5 ArbZG: weniger als 11 h zwischen Arbeitsende (auch Notdienst) und Arbeitsbeginn
 *   missing   — Werktag (kein Feiertag) in der Vergangenheit ohne Eintrag
 *   autofill  — per "Jahres-Befüllung" automatisch eingetragene Tage (Tag "autofill")
 *
 * Reine Funktion — Server (Firmen-Panel) und Tests.
 */

export type CheckKind = "over10h" | "pause" | "ruhezeit" | "missing" | "autofill";

export interface CheckEntry {
  date:          string;
  day_type:      string | null;
  start_time:    string | null;
  end_time:      string | null;
  break_minutes: number | null;
  tags?:         string[] | null;
}

export interface CheckNd {
  date:       string;
  start_time: string | null;
  end_time:   string | null;
}

export interface Finding {
  kind: CheckKind;
  date: string;          // bei autofill: erster betroffener Tag
  text: string;
}

export const AUTOFILL_TAG = "autofill";

const pad2 = (n: number) => String(n).padStart(2, "0");
const toMin = (t: string) => {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
};
const fmt = (min: number) => `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ""}`;
const dayDE = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

/** Absolute Minute (seit 1970, lokal egal — nur Differenzen zählen) */
function absMin(date: string, time: string, plusDay = false): number {
  const [y, m, d] = date.split("-").map(Number);
  const base = Date.UTC(y!, m! - 1, d!) / 60000;
  return base + toMin(time) + (plusDay ? 24 * 60 : 0);
}

export function checkMonth(input: {
  entries:   CheckEntry[];
  ndEntries: CheckNd[];
  year:      number;
  month:     number;
  feiertage: Record<string, string>;
  todayISO:  string;
  /** Tage vor Beschäftigungsbeginn nicht als "fehlt" melden */
  startDate?: string | null;
}): Finding[] {
  const { entries, ndEntries, year, month, feiertage, todayISO, startDate } = input;
  const prefix = `${year}-${pad2(month)}-`;
  const inMonth = entries.filter((e) => e.date.startsWith(prefix));
  const findings: Finding[] = [];

  // Arbeitsende-Zeitpunkte (Arbeit + Notdienst, auch aus Nachbartagen) für die Ruhezeit
  const ends: { at: number; label: string }[] = [];
  const starts: { at: number; date: string }[] = [];
  for (const e of entries) {
    if (e.day_type !== "arbeiten" || !e.start_time || !e.end_time) continue;
    const s = absMin(e.date, e.start_time);
    const overnight = toMin(e.end_time) < toMin(e.start_time);
    ends.push({ at: absMin(e.date, e.end_time, overnight), label: "Arbeitsende" });
    starts.push({ at: s, date: e.date });
  }
  for (const n of ndEntries) {
    if (!n.start_time || !n.end_time) continue;
    const overnight = toMin(n.end_time) < toMin(n.start_time);
    ends.push({ at: absMin(n.date, n.end_time, overnight), label: "Notdienst-Ende" });
  }

  for (const e of inMonth) {
    if (e.day_type !== "arbeiten" || !e.start_time || !e.end_time) continue;
    let total = toMin(e.end_time) - toMin(e.start_time);
    if (total < 0) total += 24 * 60;
    const pause = e.break_minutes ?? 0;
    const net = Math.max(0, total - pause);
    if (net > 600) findings.push({ kind: "over10h", date: e.date, text: `${fmt(net)} gearbeitet (max. 10h)` });
    if (total > 9 * 60 && pause < 45) findings.push({ kind: "pause", date: e.date, text: `${fmt(total)} Arbeitszeit, nur ${pause} min Pause (mind. 45)` });
    else if (total > 6 * 60 && pause < 30) findings.push({ kind: "pause", date: e.date, text: `${fmt(total)} Arbeitszeit, nur ${pause} min Pause (mind. 30)` });
  }

  // Ruhezeit: für jeden Arbeitsbeginn im Monat das letzte vorherige Ende suchen
  for (const st of starts) {
    if (!st.date.startsWith(prefix)) continue;
    let last: { at: number; label: string } | null = null;
    for (const en of ends) {
      if (en.at <= st.at && en.at > st.at - 24 * 60 && (!last || en.at > last.at)) last = en;
    }
    if (!last) continue;
    const gap = st.at - last.at;
    if (gap > 0 && gap < 11 * 60) {
      findings.push({ kind: "ruhezeit", date: st.date, text: `nur ${fmt(gap)} Ruhe nach ${last.label} (mind. 11h)` });
    }
  }

  // Fehlende Werktage (nur Vergangenheit)
  const have = new Set(inMonth.map((e) => e.date));
  const days = new Date(year, month, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const iso = `${prefix}${pad2(d)}`;
    if (iso >= todayISO) break;
    if (startDate && iso < startDate) continue;
    const dow = new Date(year, month - 1, d).getDay();
    if (dow === 0 || dow === 6 || feiertage[iso] || have.has(iso)) continue;
    findings.push({ kind: "missing", date: iso, text: "kein Eintrag" });
  }

  // Automatisch befüllt — eine Sammelmeldung
  const auto = inMonth.filter((e) => (e.tags ?? []).includes(AUTOFILL_TAG)).map((e) => e.date).sort();
  if (auto.length > 0) {
    findings.push({
      kind: "autofill",
      date: auto[0]!,
      text: `${auto.length} Tag${auto.length === 1 ? "" : "e"} automatisch mit Standardzeiten befüllt (ab ${dayDE(auto[0]!)})`,
    });
  }

  const order: Record<CheckKind, number> = { over10h: 0, ruhezeit: 1, pause: 2, missing: 3, autofill: 4 };
  return findings.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind]);
}
