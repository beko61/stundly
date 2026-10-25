import { describe, it, expect } from "vitest";
import { jsPDF } from "jspdf";
import { addVorschauWatermark } from "../watermark";

describe("addVorschauWatermark", () => {
  it("schreibt VORSCHAU + Hinweis auf jede Seite", () => {
    const doc = new jsPDF({ compress: false });
    doc.text("Seite 1", 10, 10);
    doc.addPage();
    doc.text("Seite 2", 10, 10);
    addVorschauWatermark(doc);
    const raw = doc.output();
    expect(raw.match(/\(VORSCHAU\) Tj/g)?.length).toBe(2);
    expect(raw).toContain("Senden & Speichern mit Stundly Plus");
  });
});
