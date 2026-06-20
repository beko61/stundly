/**
 * CSV export — GoBD-tauglich monatliche Arbeitszeit-Auswertung.
 *
 * Format: Excel-kompatibel (UTF-8 BOM + Semikolon-Trenner — DE locale).
 * Anführungszeichen-Escape: " → ""  (CSV RFC 4180).
 * Saatler: net_minutes (rakam) + HH:MM (human-readable) ikisi de var.
 */

import type { TimeEntry } from "@workly/shared";

export interface CsvNotdienst {
  date:       string;
  start_time: string | null;
  end_time:   string | null;
  erledigt?:  boolean | null;
  kunde?:     string | null;
  note?:      string | null;
}

export interface CsvEmployeeMonth {
  /** Mitarbeiter Adı */
  full_name:  string;
  /** Email (opsiyonel; boşsa "—") */
  email:      string | null;
  /** Personalnummer */
  personal_nr?: string | null;
  /** Time entries (tüm ay) */
  entries:    TimeEntry[];
  /** Notdienst entries (aynı ay) */
  notdienst:  CsvNotdienst[];
}

export interface CsvBuildInput {
  year:    number;
  month:   number;       // 1-12
  rows:    CsvEmployeeMonth[];
}

const MONTHS_DE = [
  "Januar","Februar","März","April","Mai","Juni",
  "Juli","August","September","Oktober","November","Dezember",
];

function pad2(n: number): string { return String(n).padStart(2, "0"); }

function timeToMins(t: string | null | undefined): number {
  if (!t) return 0;
  const parts = t.split(":");
  const h = Number(parts[0]); const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function minsToHHMM(mins: number): string {
  const sign = mins < 0 ? "-" : "";
  const abs  = Math.abs(mins);
  return `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

function entryNetMinutes(e: TimeEntry): number {
  if (!e.start_time || !e.end_time) return 0;
  let n = timeToMins(e.end_time) - timeToMins(e.start_time);
  if (n < 0) n += 24 * 60;
  return Math.max(0, n - (e.break_minutes ?? 0));
}

function ndDurationMinutes(n: CsvNotdienst): number {
  if (!n.start_time || !n.end_time) return 0;
  let m = timeToMins(n.end_time) - timeToMins(n.start_time);
  if (m < 0) m += 24 * 60;
  return Math.max(0, m);
}

/** CSV alanı kaçırma — DE Excel uyumlu (semikolon). */
function csvEscape(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  // Türkçe ve Almanca karakterler güvenli, sadece "/CR/LF/; içeren stringler tırnaklanır.
  if (/[";\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function statusFromDayType(dt: string | null | undefined): string {
  switch (dt) {
    case "arbeiten":  return "Arbeit";
    case "urlaub":    return "Urlaub";
    case "krank":     return "Krank";
    case "feiertag":  return "Feiertag";
    case "notdienst": return "Notdienst";
    case "frei":      return "Frei";
    default:          return "";
  }
}

/** Detail mode: gün gün dökümü (tek çalışan için). */
export function buildCsvDetail(input: { year: number; month: number; row: CsvEmployeeMonth }): string {
  const { year, month, row } = input;
  const header = [
    "Mitarbeiter", "Datum", "Wochentag", "Status",
    "Start", "Ende", "Pause (Min)", "Netto (HH:MM)", "Netto (Min)",
    "Notiz",
  ];
  const lines: string[] = [];
  // Meta-Header (Excel'e açıldığında okunur)
  lines.push(csvEscape(`Monatsbericht ${MONTHS_DE[month - 1]} ${year}`));
  lines.push(csvEscape(`Mitarbeiter: ${row.full_name}${row.personal_nr ? " (" + row.personal_nr + ")" : ""}`));
  lines.push(""); // boş satır
  lines.push(header.map(csvEscape).join(";"));

  const entryMap = new Map(row.entries.map(e => [e.date, e]));
  const daysIn = new Date(year, month, 0).getDate();
  const WD = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];

  let totalMin = 0;
  for (let d = 1; d <= daysIn; d++) {
    const iso = `${year}-${pad2(month)}-${pad2(d)}`;
    const dow = new Date(year, month - 1, d).getDay();
    const e = entryMap.get(iso);
    const net = e ? entryNetMinutes(e) : 0;
    totalMin += net;

    lines.push([
      csvEscape(row.full_name),
      csvEscape(`${pad2(d)}.${pad2(month)}.${year}`),
      csvEscape(WD[dow] ?? ""),
      csvEscape(statusFromDayType(e?.day_type)),
      csvEscape(e?.start_time ?? ""),
      csvEscape(e?.end_time ?? ""),
      csvEscape(e?.break_minutes ?? ""),
      csvEscape(net > 0 ? minsToHHMM(net) : ""),
      csvEscape(net > 0 ? net : ""),
      csvEscape(e?.note ?? ""),
    ].join(";"));
  }

  // Notdienst section
  if (row.notdienst.length > 0) {
    lines.push("");
    lines.push(csvEscape("NOTDIENST"));
    lines.push(["Datum","Start","Ende","Dauer (HH:MM)","Dauer (Min)","Bezahlt","Kunde / Notiz"].map(csvEscape).join(";"));
    let ndSum = 0;
    for (const n of row.notdienst) {
      const dur = ndDurationMinutes(n);
      ndSum += dur;
      lines.push([
        csvEscape(n.date),
        csvEscape(n.start_time ?? ""),
        csvEscape(n.end_time ?? ""),
        csvEscape(minsToHHMM(dur)),
        csvEscape(dur),
        csvEscape(n.erledigt ? "Ja" : "Nein"),
        csvEscape(n.kunde ?? n.note ?? ""),
      ].join(";"));
    }
    lines.push([
      csvEscape("Summe Notdienst"), "", "",
      csvEscape(minsToHHMM(ndSum)),
      csvEscape(ndSum),
      "", "",
    ].join(";"));
  }

  // Summe Arbeitszeit
  lines.push("");
  lines.push([
    csvEscape("Summe Arbeitszeit"), "", "", "", "", "",
    csvEscape(minsToHHMM(totalMin)),
    csvEscape(totalMin),
    "",
  ].join(";"));

  return "﻿" + lines.join("\r\n"); // UTF-8 BOM + Windows line ending
}

/** Summary mode: çalışan başına tek satır (Bulk export). */
export function buildCsvSummary(input: CsvBuildInput): string {
  const { year, month, rows } = input;
  const header = [
    "Mitarbeiter", "Email", "Personal-Nr",
    "Arbeitsstunden (HH:MM)", "Arbeitsstunden (Min)",
    "Arbeitstage", "Urlaubstage", "Krankheitstage", "Feiertage",
    "Notdienst-Einsaetze", "Notdienst (HH:MM)", "Notdienst (Min)",
  ];
  const lines: string[] = [];
  lines.push(csvEscape(`Monats-Übersicht ${MONTHS_DE[month - 1]} ${year}`));
  lines.push(csvEscape(`Generiert am ${new Date().toISOString().slice(0, 10)}`));
  lines.push("");
  lines.push(header.map(csvEscape).join(";"));

  for (const row of rows) {
    let workMin = 0;
    let workDays = 0, urlaubDays = 0, krankDays = 0, feiertagDays = 0;
    for (const e of row.entries) {
      if (e.day_type === "arbeiten") {
        workDays++;
        workMin += entryNetMinutes(e);
      } else if (e.day_type === "urlaub")   urlaubDays++;
      else if (e.day_type === "krank")      krankDays++;
      else if (e.day_type === "feiertag")   feiertagDays++;
    }
    const ndMin = row.notdienst.reduce((s, n) => s + ndDurationMinutes(n), 0);

    lines.push([
      csvEscape(row.full_name),
      csvEscape(row.email ?? ""),
      csvEscape(row.personal_nr ?? ""),
      csvEscape(minsToHHMM(workMin)),
      csvEscape(workMin),
      csvEscape(workDays),
      csvEscape(urlaubDays),
      csvEscape(krankDays),
      csvEscape(feiertagDays),
      csvEscape(row.notdienst.length),
      csvEscape(minsToHHMM(ndMin)),
      csvEscape(ndMin),
    ].join(";"));
  }

  return "﻿" + lines.join("\r\n");
}

/** Blob + filename üretir — client-side direkt indirebilir. */
export function csvDownload(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
