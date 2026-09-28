// @vitest-environment node
import { describe, it, expect } from "vitest";
import { generateNotdienstReportPdf, reportFileName, type NotdienstReportInput } from "@/lib/pdf/notdienstReportPdf";

// 1×1-PNG — reicht, damit jsPDF ein echtes Bild einbettet
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const base: NotdienstReportInput = {
  date: "2026-09-27", start: "18:10", end: "19:40", duration: "1h 30m",
  kunde: "Frau Kraft, 2. OG rechts", adresse: "Wiehbergstrasse 3, 30519 Hannover",
  problem: "WC-Spuelung undicht", ergebnis: "Dichtung getauscht\nFunktion geprueft", note: "",
  photos: [], signature: null,
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
      "Wiehbergstrasse 3, 30519 Hannover", "Yusuf Bektas", "WC-Spuelung undicht", "Dichtung getauscht", "Funktion geprueft"]) {
      expect(pdf).toContain(t);
    }
    expect(pages(pdf)).toBe(1);
    expect(images(pdf)).toBe(0);
    expect(pdf).toContain("Kunde - Datum"); // noch keine Kundenunterschrift
    // Latin-1-Absicherung: Gedankenstrich/Bullet nicht mehr still verschluckt
    expect(pdf).toContain("18:10 - 19:40 Uhr");
    expect(pdf).toContain("(·) Tj");
  });

  it("Fotos und beide Unterschriften werden eingebettet, viele Fotos → neue Seite", async () => {
    const pdf = await pdfText({
      ...base,
      photos: [PNG, PNG, PNG, PNG, PNG, PNG],
      signature: { data: PNG, name: "Erika Kraft", signedAt: "2026-09-27T17:45:00.000Z" },
      techniker: { name: "Yusuf Bektas", signature: PNG },
    });
    // gleiche Bilddaten werden von jsPDF dedupliziert → mind. 1 Bildobjekt, aber Seitenumbruch
    expect(images(pdf)).toBeGreaterThanOrEqual(1);
    expect(pages(pdf)).toBeGreaterThanOrEqual(2);
    expect(pdf).toContain("Fotos \\(6\\)"); // jsPDF escaped Klammern im Text-Stream
    expect(pdf).toContain("Kunde: Erika Kraft");
    expect(pdf).toMatch(/Seite 2\/\d/);
  });

  it("defektes Bild bricht den Bericht nicht ab", async () => {
    const pdf = await pdfText({ ...base, photos: ["data:image/jpeg;base64,kaputt"], firma: { ...base.firma, logo: "data:image/png;base64,xx" } });
    expect(pdf.startsWith("%PDF-")).toBe(true);
  });
});

it("Nutzertext mit „Anführungszeichen“, € und … bleibt lesbar", async () => {
  const pdf = await pdfText({ ...base, problem: "Kunde sagt „tropft seit 2 Tagen“ … Kosten ca. 80 €" });
  expect(pdf).toContain("Kunde sagt \"tropft seit 2 Tagen\" ... Kosten ca. 80 EUR");
});

describe("reportFileName", () => {
  it("Datum + Kunde, Umlaute umgeschrieben, sichere Zeichen", () => {
    expect(reportFileName("2026-09-27", "Frau Müller-Weiß, 2. OG")).toBe("Notdienst-Bericht_2026-09-27_Frau-Mueller-Weiss-2-OG.pdf");
    expect(reportFileName("2026-09-27", "  ")).toBe("Notdienst-Bericht_2026-09-27.pdf");
  });
});
