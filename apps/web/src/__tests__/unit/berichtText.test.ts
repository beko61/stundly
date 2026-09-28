import { describe, it, expect } from "vitest";
import { buildBerichtText, type BerichtTextInput } from "@/lib/notdienst/berichtText";

const b: BerichtTextInput = {
  date: "2026-09-27", start: "18:10", end: "19:40", duration: "1h 30m",
  kunde: "Frau Kraft", telefon: "0511 987654", adresse: "Hildesheimer Straße 5, 30519 Hannover",
  problem: "WC undicht", ergebnis: "Dichtung getauscht\n\nFunktion geprüft", note: "Material 12 €", fotoAnzahl: 2,
};

describe("buildBerichtText", () => {
  it("Betreff: Datum – Kunde – Adresse", () => {
    expect(buildBerichtText(b).subject).toBe("Notdienst-Bericht 27.09.2026 – Frau Kraft – Hildesheimer Straße 5, 30519 Hannover");
  });

  it("Mail-Text mit allen Angaben, Ergebnis als Punkte, Anhänge genannt", () => {
    expect(buildBerichtText(b).body).toBe([
      "Datum: 27.09.2026",
      "Uhrzeit: 18:10 – 19:40 Uhr (1h 30m)",
      "Kunde: Frau Kraft",
      "Telefon: 0511 987654",
      "Adresse: Hildesheimer Straße 5, 30519 Hannover",
      "",
      "Problem:",
      "WC undicht",
      "",
      "Ergebnis / Feststellungen:",
      "• Dichtung getauscht",
      "• Funktion geprüft",
      "",
      "Notiz: Material 12 €",
      "",
      "Anhänge: Bericht (PDF) + 2 Fotos",
    ].join("\n"));
  });

  it("leere Felder entfallen; ohne Fotos nur PDF-Anhang", () => {
    const r = buildBerichtText({ ...b, kunde: "", telefon: " ", adresse: "", problem: "", ergebnis: "", note: "", fotoAnzahl: 0 });
    expect(r.subject).toBe("Notdienst-Bericht 27.09.2026");
    expect(r.body).toBe("Datum: 27.09.2026\nUhrzeit: 18:10 – 19:40 Uhr (1h 30m)\n\nAnhang: Bericht (PDF)");
  });

  it("ein Foto → Singular", () => {
    expect(buildBerichtText({ ...b, fotoAnzahl: 1 }).body).toContain("Anhänge: Bericht (PDF) + 1 Foto");
  });
});
