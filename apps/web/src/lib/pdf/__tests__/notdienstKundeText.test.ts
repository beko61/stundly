import { describe, it, expect } from "vitest";
import { notdienstKundeText } from "../monthlyReportPdf";

describe("notdienstKundeText (Monatsbericht, Spalte Kunde / Adresse)", () => {
  it("Kunde und Einsatzadresse", () => {
    expect(notdienstKundeText({ kunde: "Erdmann", adresse: "Musterstr. 5, 28195 Bremen" }))
      .toBe("Erdmann, Musterstr. 5, 28195 Bremen");
  });

  it("ohne Kunde: Notiz statt Kunde, Adresse bleibt", () => {
    expect(notdienstKundeText({ kunde: null, note: "Rohrbruch", adresse: "Hauptstr. 1" })).toBe("Rohrbruch, Hauptstr. 1");
  });

  it("leere Felder werden ausgelassen", () => {
    expect(notdienstKundeText({ kunde: "Bijo", adresse: "  " })).toBe("Bijo");
    expect(notdienstKundeText({})).toBe("");
  });
});
