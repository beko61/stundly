/**
 * Jahresbericht PDF (Firma → Berichte → "Jahr") — eine Seite pro Mitarbeiter zum Unterschreiben.
 *
 * Zahlen = Summe der Monatsberichte: jeder Monat mit calcMonthStats aus monthlyReportPdf
 * (gleiche Soll-/Ist-Rechnung, Notdienst nach Wochen-Sonntag-Monat). Zukünftige Monate des
 * laufenden Jahres werden nicht gezählt (sonst stünde dort Soll ohne Ist).
 */

import type { TimeEntry } from "@workly/shared";
import { makePdfTextSafe } from "./pdfSafe";
import { notdienstBelongsToMonth } from "@/lib/utils/weekMonth";
import {
  calcMonthStats, drawBriefkopf, drawUnterschrift, minsToTime, pad2, MONTHS_DE,
  type MonthStats, type NotdienstEntry, type ProfileInfo,
} from "./monthlyReportPdf";

export interface YearlyReportInput {
  year:      number;
  entries:   TimeEntry[];
  notdienst: NotdienstEntry[];
  feiertage: Record<string, string>;
  profile:   ProfileInfo;
  /** Stichtag (Tests); Standard: heute */
  today?:    Date;
}

export interface YearRow { month: number; stats: MonthStats | null; saldoMins: number }

export interface YearTotals {
  arbeitstage: number; standardMins: number; workedMins: number; ndMins: number;
  diffMins: number; urlaub: number; krank: number; notdienstCount: number; monate: number;
}

/** 12 Zeilen (null = Monat liegt in der Zukunft) + laufender Saldo + Summen. */
export function calcYearRows(input: Omit<YearlyReportInput, "profile">): { rows: YearRow[]; totals: YearTotals } {
  const today = input.today ?? new Date();
  const lastMonth = input.year < today.getFullYear() ? 12
    : input.year > today.getFullYear() ? 0
    : today.getMonth() + 1;

  const totals: YearTotals = {
    arbeitstage: 0, standardMins: 0, workedMins: 0, ndMins: 0,
    diffMins: 0, urlaub: 0, krank: 0, notdienstCount: 0, monate: 0,
  };
  let saldo = 0;
  const rows: YearRow[] = [];
  for (let month = 1; month <= 12; month++) {
    if (month > lastMonth) { rows.push({ month, stats: null, saldoMins: saldo }); continue; }
    const prefix = `${input.year}-${pad2(month)}-`;
    const stats = calcMonthStats({
      year: input.year, month,
      entries:   input.entries.filter(e => e.date.startsWith(prefix)),
      notdienst: input.notdienst.filter(n => notdienstBelongsToMonth(n.date, input.year, month)),
      feiertage: input.feiertage,
    });
    saldo += stats.diffMins;
    rows.push({ month, stats, saldoMins: saldo });
    totals.arbeitstage    += stats.arbeitstage;
    totals.standardMins   += stats.standardMins;
    totals.workedMins     += stats.workedMins;
    totals.ndMins         += stats.ndMins;
    totals.diffMins       += stats.diffMins;
    totals.urlaub         += stats.urlaub;
    totals.krank          += stats.krank;
    totals.notdienstCount += stats.notdienstCount;
    totals.monate++;
  }
  return { rows, totals };
}

const signed = (m: number) => `${m >= 0 ? "+" : ""}${minsToTime(m)}`;

export async function generateYearlyReportPDF(input: YearlyReportInput): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const { rows, totals } = calcYearRows(input);

  const maName = [input.profile.vorname, input.profile.nachname].filter(Boolean).join(" ") || "Mitarbeiter";
  const heute = input.today ?? new Date();
  const heuteStr = `${pad2(heute.getDate())}.${pad2(heute.getMonth() + 1)}.${heute.getFullYear()}`;

  const doc = makePdfTextSafe(new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }));
  const W = 210, L = 14, R = 196, CW = R - L;
  let y = drawBriefkopf(doc, input.profile, 14);
  y += 5;
  doc.setDrawColor(80); doc.setLineWidth(0.4); doc.line(L, y, R, y); y += 7;

  doc.setFontSize(14); doc.setFont("helvetica", "bold");
  doc.text("JAHRESBERICHT ARBEITSZEIT", W / 2, y, { align: "center" }); y += 6;
  doc.setFontSize(11);
  doc.text(String(input.year), W / 2, y, { align: "center" }); y += 5;
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  const head = [`Mitarbeiter: ${maName}`];
  if (input.profile.personal_nr) head.push(`Pers-Nr.: ${input.profile.personal_nr}`);
  if (input.profile.abteilung)   head.push(`Abteilung: ${input.profile.abteilung}`);
  doc.text(head.join("   "), W / 2, y, { align: "center" }); y += 8;

  // ── Monatstabelle ──
  const cols = ["Monat", "Arb.-Tage", "Soll", "Ist", "Notdienst", "Differenz", "Saldo", "Urlaub", "Krank"];
  const x = [L + 2, L + 30, L + 50, L + 70, L + 90, L + 112, L + 134, L + 154, L + 170];
  doc.setFillColor(60, 60, 60); doc.rect(L, y - 4, CW, 6, "F");
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(255);
  cols.forEach((c, i) => doc.text(c, x[i]!, y));
  doc.setTextColor(0); y += 6;

  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  rows.forEach((r, i) => {
    if (i % 2 === 1) { doc.setFillColor(245, 245, 245); doc.rect(L, y - 3.8, CW, 5.6, "F"); }
    doc.text(MONTHS_DE[r.month - 1]!, x[0]!, y);
    if (!r.stats) {
      doc.setTextColor(150); doc.text("—", x[1]!, y); doc.setTextColor(0);
    } else {
      const s = r.stats;
      doc.text(String(s.arbeitstage), x[1]!, y);
      doc.text(minsToTime(s.standardMins), x[2]!, y);
      doc.text(minsToTime(s.workedMins), x[3]!, y);
      doc.text(s.ndMins ? minsToTime(s.ndMins) : "—", x[4]!, y);
      doc.setFont("helvetica", "bold"); doc.text(signed(s.diffMins), x[5]!, y);
      doc.setFont("helvetica", "normal"); doc.text(signed(r.saldoMins), x[6]!, y);
      doc.text(String(s.urlaub), x[7]!, y);
      doc.text(String(s.krank), x[8]!, y);
    }
    y += 5.6;
  });

  doc.setDrawColor(80); doc.setLineWidth(0.3); doc.line(L, y - 3.2, R, y - 3.2); y += 1.5;
  doc.setFont("helvetica", "bold");
  doc.text("Summe", x[0]!, y);
  doc.text(String(totals.arbeitstage), x[1]!, y);
  doc.text(minsToTime(totals.standardMins), x[2]!, y);
  doc.text(minsToTime(totals.workedMins), x[3]!, y);
  doc.text(totals.ndMins ? minsToTime(totals.ndMins) : "—", x[4]!, y);
  doc.text(signed(totals.diffMins), x[5]!, y);
  doc.text(String(totals.urlaub), x[7]!, y);
  doc.text(String(totals.krank), x[8]!, y);
  y += 10;

  // ── Zusammenfassung ──
  doc.setFontSize(9.5);
  doc.text(`Arbeitszeitkonto ${input.year}: ${signed(totals.diffMins)} Std`, L + 2, y); y += 5.5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  doc.text(`Ist inkl. Notdienst ${minsToTime(totals.workedMins + totals.ndMins)} Std von ${minsToTime(totals.standardMins)} Std Soll · `
    + `${totals.urlaub} Urlaubstage · ${totals.krank} Krankheitstage · ${totals.notdienstCount}× Notdienst`, L + 2, y); y += 5;
  if (totals.monate < 12) {
    doc.setTextColor(110);
    doc.text(`Stand ${heuteStr}: berücksichtigt Januar bis ${MONTHS_DE[totals.monate - 1] ?? "—"}.`, L + 2, y);
    doc.setTextColor(0); y += 5;
  }
  doc.setTextColor(110); doc.setFontSize(7.5);
  doc.text("Urlaub/Krank zählen mit der Standard-Tagesarbeitszeit als Ist. Notdienst wird dem Monat zugeordnet, in dem der Sonntag seiner Woche liegt.", L + 2, y, { maxWidth: CW - 4 });
  doc.setTextColor(0);

  drawUnterschrift(doc, input.profile, Math.max(y + 20, 258), maName, heuteStr);
  doc.save(`Jahresbericht_${input.year}_${maName}.pdf`.replace(/[^a-zA-Z0-9_.äöüÄÖÜß-]/g, "_"));
}
