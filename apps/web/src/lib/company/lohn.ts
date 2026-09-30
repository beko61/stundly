/**
 * Lohn-Vorbereitung (Firmen-Panel Phase D): eine Zeile pro Mitarbeiter und Monat —
 * genau das, was das Lohnbüro / der Steuerberater braucht. Gleiche Rechnung wie beim
 * Mitarbeiter (calcMonthStats: Feiertage seines Bundeslands, Notdienst per Wochen-Sonntag).
 * Reine Funktionen.
 */

import type { TimeEntry } from "@workly/shared";
import { calcMonthStats } from "@/lib/utils/monthStats";
import { notdienstBelongsToMonth } from "@/lib/utils/weekMonth";

export interface LohnEmployee {
  user_id:     string;
  name:        string;
  personal_nr: string | null;
  targetHours: number;                    // Soll pro Monat (Vertrag > Lohn-Einstellung > 174)
  feiertage:   Record<string, string>;    // Feiertage seines Bundeslands (Jahr)
}

export interface LohnNd { user_id: string; date: string; start_time: string | null; end_time: string | null; erledigt: boolean | null }

export interface LohnRow {
  user_id:      string;
  name:         string;
  personal_nr:  string | null;
  status:       "approved" | "submitted" | null;
  sollMin:      number;
  arbeitMin:    number;   // nur Arbeit
  bezahltAbwMin: number;  // Urlaub + Krank + Feiertag (Sollstunden)
  istMin:       number;   // Arbeit + bezahlte Abwesenheit
  ndCount:      number;
  ndMin:        number;
  ndOffen:      number;
  diffMin:      number;   // ist + Notdienst − Soll
  urlaubDays:   number;
  krankDays:    number;
  feiertagDays: number;
  pauschaleSum: number | null;
}

export function computeLohnRows(input: {
  employees: LohnEmployee[];
  entries:   (TimeEntry & { user_id: string })[];
  ndEntries: LohnNd[];
  closings:  Map<string, "approved" | "submitted">;
  year:      number;
  month:     number;
  pauschale: number | null;
}): LohnRow[] {
  const { employees, entries, ndEntries, closings, year, month, pauschale } = input;
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  return employees.map((emp) => {
    const own = entries.filter((e) => e.user_id === emp.user_id && e.date.startsWith(prefix));
    const nd = ndEntries.filter((n) => n.user_id === emp.user_id && notdienstBelongsToMonth(n.date, year, month));
    const s = calcMonthStats({
      entries: own, ndEntries: nd, feiertage: emp.feiertage, year, month, targetHoursPerMonth: emp.targetHours,
    });
    return {
      user_id: emp.user_id, name: emp.name, personal_nr: emp.personal_nr,
      status: closings.get(emp.user_id) ?? null,
      sollMin: Math.round(s.targetMin),
      arbeitMin: s.workedMinPure,
      bezahltAbwMin: s.paidAbsenceMin,
      istMin: s.workedMin,
      ndCount: s.ndCount,
      ndMin: s.ndMin,
      ndOffen: s.ndCount - s.ndPaid,
      diffMin: Math.round(s.diffMin),
      urlaubDays: s.urlaubDays,
      krankDays: s.krankDays,
      feiertagDays: s.feiertagDays,
      pauschaleSum: pauschale != null ? Math.round(s.ndCount * pauschale * 100) / 100 : null,
    };
  });
}

/** "12:30" / "-3:15" — Stunden:Minuten, wie Lohnprogramme es erwarten */
export function hm(min: number): string {
  const sign = min < 0 ? "-" : "";
  const a = Math.abs(Math.round(min));
  return `${sign}${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
}

/** Dezimalstunden mit Komma: 750 → "12,50" */
export function dec(min: number): string {
  return (Math.round(min / 60 * 100) / 100).toFixed(2).replace(".", ",");
}

export const STATUS_LABEL = { approved: "freigegeben", submitted: "eingereicht" } as const;

/** CSV (Semikolon, BOM) — Stunden als Dezimalzahl, damit Excel/Lohnprogramme rechnen können */
export function lohnCsv(rows: LohnRow[]): string {
  const esc = (v: string | null) => {
    const s = v ?? "";
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const eur = (v: number | null) => (v == null ? "" : v.toFixed(2).replace(".", ","));
  const head = [
    "Personalnr.", "Mitarbeiter", "Status", "Soll (h)", "Arbeit (h)", "Urlaub/Krank/Feiertag (h)", "Ist gesamt (h)",
    "Notdienst (h)", "Notdienst-Einsätze", "davon unbezahlt", "Über-/Unterstunden (h)", "Urlaubstage", "Krankheitstage",
    "Feiertage", "Notdienst-Pauschale (€)",
  ];
  const lines = rows.map((r) => [
    esc(r.personal_nr), esc(r.name), r.status ? STATUS_LABEL[r.status] : "offen",
    dec(r.sollMin), dec(r.arbeitMin), dec(r.bezahltAbwMin), dec(r.istMin), dec(r.ndMin), r.ndCount, r.ndOffen,
    dec(r.diffMin), r.urlaubDays, r.krankDays, r.feiertagDays, eur(r.pauschaleSum),
  ].join(";"));
  return "﻿" + [head.join(";"), ...lines].join("\r\n") + "\r\n";
}
