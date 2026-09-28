// @vitest-environment node
import { describe, it, expect } from "vitest";
import { jsPDF } from "jspdf";
import { buildStundenzettelVorlage, vorlageFileName } from "@/lib/pdf/stundenzettelVorlagePdf";

const text = (doc: jsPDF) => doc.output();

describe("Stundenzettel-Vorlage", () => {
  it("Oktober 2026 (NI): 31 Tage, Feiertage, Summe, Unterschriften, Link", () => {
    const doc = buildStundenzettelVorlage(jsPDF, { year: 2026, month: 10, bundesland: "NI", name: "Max Muster", firma: "Muster GmbH" });
    const pdf = text(doc);
    expect(doc.getNumberOfPages()).toBe(1);
    expect(pdf).toContain("Oktober 2026");
    expect(pdf).toContain("01.10.");
    expect(pdf).toContain("31.10.");
    expect(pdf).not.toContain("32.10.");
    expect(pdf).toContain("Tag der Deutschen Einheit");
    expect(pdf).toContain("Reformationstag");
    expect(pdf).toContain("Max Muster");
    expect(pdf).toContain("Muster GmbH");
    expect(pdf).toContain("Summe");
    expect(pdf).toContain("Unterschrift Vorgesetzte/r");
    expect(pdf).toMatch(/\/URI \(https:\/\/stundly\.de\)/);
  });

  it("Februar ohne Bundesland: 28 Tage, keine Feiertage, leere Namensfelder", () => {
    const pdf = text(buildStundenzettelVorlage(jsPDF, { year: 2026, month: 2, bundesland: null }));
    expect(pdf).toContain("28.02.");
    expect(pdf).not.toContain("29.02.");
    expect(pdf).not.toMatch(/Neujahr|Karfreitag/);
  });

  it("Dateiname ohne Umlaut", () => {
    expect(vorlageFileName({ year: 2026, month: 3 })).toBe("Stundenzettel_Maerz_2026.pdf");
  });
});
