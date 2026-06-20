import { describe, it, expect } from "vitest";
import { currentMindestlohn, formatMindestlohn, MINDESTLOHN_CURRENT } from "@/lib/mindestlohn";

describe("currentMindestlohn", () => {
  it("2026 → 13.90", () => {
    expect(currentMindestlohn(new Date("2026-06-15"))).toBe(13.90);
  });
  it("2025 → 12.82", () => {
    expect(currentMindestlohn(new Date("2025-03-01"))).toBe(12.82);
  });
  it("2027 → 14.60", () => {
    expect(currentMindestlohn(new Date("2027-01-01"))).toBe(14.60);
  });
  it("bilinmeyen yıl (2028) → en son bilinen (14.60)", () => {
    expect(currentMindestlohn(new Date("2028-06-15"))).toBe(14.60);
  });
  it("bilinmeyen geçmiş (2020) → en son bilinen", () => {
    // En son bilinen 2027 (14.60). Helper en YENİ yılı kullanıyor (descending sort).
    expect(currentMindestlohn(new Date("2020-01-01"))).toBe(14.60);
  });
});

describe("formatMindestlohn", () => {
  it("DE locale virgüllü '€' ile", () => {
    expect(formatMindestlohn(13.90)).toBe("13,90 €");
    expect(formatMindestlohn(14.60)).toBe("14,60 €");
  });
  it("ondalıksız değer → 2 ondalık göster", () => {
    expect(formatMindestlohn(15)).toBe("15,00 €");
  });
});

describe("MINDESTLOHN_CURRENT constant", () => {
  it("number tipinde, pozitif", () => {
    expect(typeof MINDESTLOHN_CURRENT).toBe("number");
    expect(MINDESTLOHN_CURRENT).toBeGreaterThan(12);
  });
});
