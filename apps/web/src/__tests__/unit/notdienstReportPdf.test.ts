// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  generateNotdienstReportPdf, reportFileName, fotoFileName, type NotdienstReportInput,
} from "@/lib/pdf/notdienstReportPdf";

// 1×1-PNG — reicht, damit jsPDF ein echtes Bild einbettet
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const base: NotdienstReportInput = {
  date: "2026-09-27", start: "18:10", end: "19:40", duration: "1h 30m",
  kunde: "Frau Kraft, 2. OG rechts", telefon: "0511 987654", adresse: "Wiehbergstrasse 3, 30519 Hannover",
  problem: "WC-Spuelung undicht", ergebnis: "Dichtung getauscht\nFunktion geprueft", note: "",
  fotoAnzahl: 0, signature: null,
  firma: { name: "Sanitaer Meier GmbH", strasse: "Hauptstr. 1", plz: "30159", ort: "Hannover", telefon: "0511 123", email: "info@meier.de", logo: null },
  techniker: { name: "Yusuf Bektas", signature: null },
};

async function pdfText(input: NotdienstReportInput): Promise<string> {
  const blob = await generateNotdienstReportPdf(input);
  return Buffer.from(await blob.arrayBuffer()).toString("latin1");
}
const pages = (pdf: string) => (pdf.match(/\/Type \/Page\b/g) ?? []).length;
const images = (pdf: string) => (pdf.match(/\/Subtype \/Image/g) ?? []).length;

describe("generateNotdienstReportPdf", () => {
  it("gültiges PDF mit Briefkopf, Einsatzdaten und Ergebnis-Punkten", async () => {
    const pdf = await pdfText(base);
    expect(pdf.startsWith("%PDF-")).toBe(true);
    for (const t of ["NOTDIENST-BERICHT", "Sanitaer Meier GmbH", "27.09.2026", "Frau Kraft, 2. OG rechts",
      "Wiehbergstrasse 3, 30519 Hannover", "0511 987654", "Yusuf Bektas", "WC-Spuelung undicht", "Dichtung getauscht", "Funktion geprueft"]) {
      expect(pdf).toContain(t);
    }
    expect(pages(pdf)).toBe(1);
    expect(images(pdf)).toBe(0);
    expect(pdf).toContain("Kunde - Datum"); // noch keine Kundenunterschrift
    expect(pdf).not.toContain("Fotos:");    // ohne Fotos keine Zeile
    // Latin-1-Absicherung: Gedankenstrich/Bullet nicht mehr still verschluckt
    expect(pdf).toContain("18:10 - 19:40 Uhr");
    expect(pdf).toContain("(·) Tj");
  });

  it("Fotos NICHT eingebettet (gehen als Einzeldateien mit) — nur Anzahl; Unterschriften schon", async () => {
    const pdf = await pdfText({
      ...base,
      fotoAnzahl: 3,
      signature: { data: PNG, name: "Erika Kraft", signedAt: "2026-09-27T17:45:00.000Z" },
      techniker: { name: "Yusuf Bektas", signature: PNG },
    });
    expect(pdf).toContain("3 \\(als separate Dateien angeh"); // jsPDF escaped Klammern im Text-Stream
    expect(images(pdf)).toBe(2); // genau die 2 Unterschriften (Techniker + Kunde) — keine Fotos
    expect(pages(pdf)).toBe(1);
    expect(pdf).toContain("Kunde: Erika Kraft");
    expect(pdf).toContain("Seite 1/1");
  });

  it("Fußzeile: 'Erstellt mit Stundly' mit klickbarem Link", async () => {
    const pdf = await pdfText(base);
    expect(pdf).toContain("stundly.de");
    expect(pdf).toMatch(/\/URI \(https:\/\/stundly\.de\)/);
  });

  it("langer Text → Seitenumbruch mit Seitenzahlen", async () => {
    const lang = Array.from({ length: 80 }, (_, i) => `Feststellung ${i + 1}`).join("\n");
    const pdf = await pdfText({ ...base, ergebnis: lang });
    expect(pages(pdf)).toBeGreaterThanOrEqual(2);
    expect(pdf).toMatch(/Seite 2\/\d/);
  });

  it("defektes Bild bricht den Bericht nicht ab", async () => {
    const pdf = await pdfText({
      ...base,
      signature: { data: "data:image/jpeg;base64,kaputt", name: "X", signedAt: "2026-09-27T17:45:00Z" },
      firma: { ...base.firma, logo: "data:image/png;base64,xx" },
    });
    expect(pdf.startsWith("%PDF-")).toBe(true);
  });

  it("Nutzertext mit „Anführungszeichen“, € und … bleibt lesbar", async () => {
    const pdf = await pdfText({ ...base, problem: "Kunde sagt „tropft seit 2 Tagen“ … Kosten ca. 80 €" });
    expect(pdf).toContain("Kunde sagt \"tropft seit 2 Tagen\" ... Kosten ca. 80 EUR");
  });
});

describe("Dateinamen", () => {
  it("Bericht: Datum + Kunde, Umlaute umgeschrieben, sichere Zeichen", () => {
    expect(reportFileName("2026-09-27", "Frau Müller-Weiß, 2. OG")).toBe("Notdienst-Bericht_2026-09-27_Frau-Mueller-Weiss-2-OG.pdf");
    expect(reportFileName("2026-09-27", "  ")).toBe("Notdienst-Bericht_2026-09-27.pdf");
  });
  it("Fotos: nummeriert, Endung nach Bildtyp", () => {
    expect(fotoFileName("2026-09-27", "Frau Kraft", 2)).toBe("Notdienst_2026-09-27_Frau-Kraft_Foto-2.jpg");
    expect(fotoFileName("2026-09-27", "", 1, "image/png")).toBe("Notdienst_2026-09-27_Foto-1.png");
  });
});
