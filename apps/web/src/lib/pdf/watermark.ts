import type { jsPDF as JsPDF } from "jspdf";

/**
 * Basic-Tarif: PDF nur als Vorschau — diagonal "VORSCHAU" auf jeder Seite + Hinweis unten.
 * Senden/Speichern gibt es mit Plus (dann ohne Wasserzeichen).
 */
export function addVorschauWatermark(doc: JsPDF): void {
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setTextColor(215, 215, 225);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(64);
    doc.text("VORSCHAU", w / 2, h / 2, { angle: 35, align: "center" });
    doc.setFontSize(9);
    doc.setTextColor(150, 140, 200);
    doc.text("Vorschau - Senden & Speichern mit Stundly Plus", w / 2, h - 6, { align: "center" });
  }
  doc.setTextColor(0, 0, 0);
}
