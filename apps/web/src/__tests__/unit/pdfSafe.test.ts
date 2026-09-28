import { describe, it, expect } from "vitest";
import { pdfSafe } from "@/lib/pdf/pdfSafe";

describe("pdfSafe", () => {
  it("Latin-1 (inkl. Umlaute, ß, ·) bleibt unverändert", () => {
    expect(pdfSafe("Müller-Weiß · Größe 5 °C")).toBe("Müller-Weiß · Größe 5 °C");
  });
  it("typografische Zeichen → Latin-1-Entsprechungen", () => {
    expect(pdfSafe("18:10 – 19:40 — „gut“ ‚ok‘ … 12 € • Punkt → weiter ✅"))
      .toBe("18:10 - 19:40 - \"gut\" 'ok' ... 12 EUR · Punkt -> weiter x");
  });
  it("unbekannte Zeichen (z.B. Emoji) werden entfernt statt Müll zu erzeugen", () => {
    expect(pdfSafe("Rohr 🔧 dicht 🚿")).toBe("Rohr  dicht ");
  });
});
