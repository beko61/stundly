/**
 * Lohn-Vorbereitung als PDF (A4 quer) — zum Ausdrucken oder Weiterleiten.
 */

import { makePdfTextSafe } from "./pdfSafe";
import { hm, STATUS_LABEL, type LohnRow } from "@/lib/company/lohn";

export async function generateLohnPdf(p: { firma: string; monthLabel: string; rows: LohnRow[] }): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  makePdfTextSafe(doc);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Lohn-Vorbereitung ${p.monthLabel}`, 14, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(p.firma, 14, 25);

  const withPauschale = p.rows.some((r) => r.pauschaleSum != null);
  const cols = ["Mitarbeiter", "Pers.-Nr.", "Soll", "Arbeit", "U/K/FT", "Ist", "Notdienst", "Saldo", "Urlaub", "Krank",
    ...(withPauschale ? ["Pauschale"] : []), "Status"];
  const widths = [52, 20, 18, 18, 18, 18, 26, 18, 16, 14, ...(withPauschale ? [22] : []), 24];
  let y = 36;
  const row = (cells: string[], bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    let x = 14;
    cells.forEach((c, i) => {
      const right = i >= 2;
      doc.text(c, right ? x + widths[i]! - 2 : x, y, right ? { align: "right" } : undefined);
      x += widths[i]!;
    });
    y += 7;
  };

  doc.setFontSize(9);
  row(cols, true);
  doc.setDrawColor(180);
  doc.line(14, y - 5, 283, y - 5);
  for (const r of p.rows) {
    if (y > 190) { doc.addPage(); y = 20; row(cols, true); }
    row([
      r.name.slice(0, 32), r.personal_nr ?? "", hm(r.sollMin), hm(r.arbeitMin), hm(r.bezahltAbwMin), hm(r.istMin),
      r.ndCount ? `${r.ndCount}x ${hm(r.ndMin)}` : "-", `${r.diffMin >= 0 ? "+" : ""}${hm(r.diffMin)}`,
      String(r.urlaubDays), String(r.krankDays),
      ...(withPauschale ? [r.pauschaleSum != null ? `${r.pauschaleSum.toFixed(2).replace(".", ",")} EUR` : "-"] : []),
      r.status ? STATUS_LABEL[r.status] : "offen",
    ]);
  }

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("Ist = Arbeit + Urlaub/Krank/Feiertag (Sollstunden). Saldo = Ist + Notdienst - Soll. Stunden als Std:Min.", 14, 200);
  doc.text("Erstellt mit Stundly - stundly.de", 283, 200, { align: "right" });
  return doc.output("blob");
}
