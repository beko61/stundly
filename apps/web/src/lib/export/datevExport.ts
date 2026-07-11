/**
 * DATEV / LODAS-uyumlu Lohnjournal CSV export.
 *
 * Format: Alman Steuerberater standardı — Excel + Lohnbuchhaltung
 * (DATEV Lohn und Gehalt, LODAS, Lexware, Sage) importa uygun.
 *
 * Encoding: UTF-8 BOM + Semikolon-Trenner (DE-Excel default).
 * Ondalık: virgül (12,50). Tarih: DD.MM.JJJJ (DE-Format).
 * CSV escape: RFC 4180 (" → "").
 *
 * Sütunlar (v1 — minimum viable):
 *   1. Personalnummer         (settings.personal_nr veya user_id[:8].toUpper)
 *   2. Nachname
 *   3. Vorname
 *   4. Abrechnungsmonat       (MM.JJJJ)
 *   5. Arbeitsstunden         (ondalık, netto çalışma)
 *   6. Urlaubstage
 *   7. Krankheitstage
 *   8. Notdiensttage
 *   9. Notdienstbonus_EUR
 *  10. Grundlohn_Brutto_EUR
 *  11. Bruttolohn_Gesamt_EUR
 *
 * Steuerberater bu değerler üzerinden LSt/SV/Netto kendisi hesaplar.
 * Bu export "payroll input" formatı — SFN detayı, Krankengeld hesabı vs.
 * dahil değil (v2'de eklenebilir).
 */

import type { TimeEntry } from "@workly/shared";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface DatevNotdienst {
  date:       string;
  start_time: string | null;
  end_time:   string | null;
}

export interface DatevEmployeeMonth {
  /** Personalnummer — settings.personal_nr veya boşsa auto-generate */
  personalNummer: string;
  /** Kullanıcı adı bölünmesi. `full_name` "Ali Yıldız" → last="Yıldız", first="Ali". */
  vorname:  string;
  nachname: string;
  /** Time entries (tüm ay) */
  entries:  TimeEntry[];
  /** Notdienst entries (aynı ay) */
  notdienst: DatevNotdienst[];
  /** Stundenlohn EUR/h (SalarySettings.hourly_rate) */
  stundenlohn: number;
  /** Notdienst-Bonus EUR/gün */
  notdienstBonus: number;
  /** Aylık Sollstunden (Grundlohn için baz) */
  monatlicheSollstunden: number;
}

export interface DatevBuildInput {
  year:  number;
  month: number;   // 1-12
  rows:  DatevEmployeeMonth[];
}

// ─────────────────────────────────────────────────────────────
// Yardımcılar
// ─────────────────────────────────────────────────────────────

function pad2(n: number): string { return String(n).padStart(2, "0"); }

function timeToMins(t: string | null | undefined): number {
  if (!t) return 0;
  const parts = t.split(":");
  const h = Number(parts[0]); const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function entryNetMinutes(e: TimeEntry): number {
  if (!e.start_time || !e.end_time) return 0;
  let n = timeToMins(e.end_time) - timeToMins(e.start_time);
  if (n < 0) n += 24 * 60; // gece vardiyası
  return Math.max(0, n - (e.break_minutes ?? 0));
}

function ndDurationMinutes(n: DatevNotdienst): number {
  if (!n.start_time || !n.end_time) return 0;
  let m = timeToMins(n.end_time) - timeToMins(n.start_time);
  if (m < 0) m += 24 * 60;
  return Math.max(0, m);
}

/** DE ondalık format: 168.75 → "168,75" */
export function deNumber(n: number, decimals = 2): string {
  return n.toFixed(decimals).replace(".", ",");
}

/** CSV escape RFC 4180 (Semikolon-Trenner). */
export function csvEscape(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (/[";\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * `full_name` → `{ vorname, nachname }`. Türkçe/Almanca isimlerde
 * son kelime nachname, öncekiler vorname. Tek kelime → nachname='',
 * vorname='—'. Boşluk yoksa vorname'e koyar.
 */
export function splitFullName(fullName: string | null | undefined): { vorname: string; nachname: string } {
  const s = (fullName ?? "").trim();
  if (!s) return { vorname: "—", nachname: "" };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { vorname: parts[0]!, nachname: "" };
  const nachname = parts[parts.length - 1]!;
  const vorname  = parts.slice(0, -1).join(" ");
  return { vorname, nachname };
}

// ─────────────────────────────────────────────────────────────
// Ana CSV builder
// ─────────────────────────────────────────────────────────────

const HEADERS = [
  "Personalnummer",
  "Nachname",
  "Vorname",
  "Abrechnungsmonat",
  "Arbeitsstunden",
  "Urlaubstage",
  "Krankheitstage",
  "Notdiensttage",
  "Notdienstbonus_EUR",
  "Grundlohn_Brutto_EUR",
  "Bruttolohn_Gesamt_EUR",
];

/**
 * Aylık DATEV-uyumlu Lohnjournal CSV (bulk — tüm mitarbeiter).
 * UTF-8 BOM ile başlar. Steuerberater'a e-posta veya paylaşım için hazır.
 */
export function buildDatevMonthlyCsv(input: DatevBuildInput): string {
  const { year, month, rows } = input;
  const monatStr = `${pad2(month)}.${year}`;

  const lines: string[] = [];
  lines.push(HEADERS.join(";"));

  for (const r of rows) {
    const workMin  = r.entries
      .filter((e) => e.day_type === "arbeiten")
      .reduce((s, e) => s + entryNetMinutes(e), 0);
    const ndMin    = r.notdienst.reduce((s, n) => s + ndDurationMinutes(n), 0);
    const workStd  = (workMin + ndMin) / 60;  // Notdienst Arbeitsstunden'e dahil

    const urlaub   = r.entries.filter((e) => e.day_type === "urlaub").length;
    const krank    = r.entries.filter((e) => e.day_type === "krank").length;
    const ndTage   = r.notdienst.length;

    const notdienstBonusEur = ndTage * r.notdienstBonus;
    const grundlohnEur      = r.monatlicheSollstunden * r.stundenlohn;
    // MVP: Bruttolohn = grundlohn + notdienstBonus (Überstunden ayrı satır yok)
    const bruttoGesamt      = grundlohnEur + notdienstBonusEur;

    const row = [
      csvEscape(r.personalNummer),
      csvEscape(r.nachname),
      csvEscape(r.vorname),
      csvEscape(monatStr),
      deNumber(workStd),
      String(urlaub),
      String(krank),
      String(ndTage),
      deNumber(notdienstBonusEur),
      deNumber(grundlohnEur),
      deNumber(bruttoGesamt),
    ];
    lines.push(row.join(";"));
  }

  const BOM = "﻿";
  return BOM + lines.join("\r\n");
}

/** Browser'da CSV blob indirir. */
export function datevDownload(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
