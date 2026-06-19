import { describe, it, expect } from "vitest";
import { maskMoney } from "@/lib/privacy";

describe("maskMoney", () => {
  it("gizliyse '€ •••' döner", () => {
    expect(maskMoney(1234.56, true)).toBe("€ •••");
  });

  it("görünürse de-DE formatlı '€ 1.234,56'", () => {
    expect(maskMoney(1234.56, false)).toBe("€ 1.234,56");
  });

  it("decimals=0 ondalıksız", () => {
    expect(maskMoney(2500, false, { decimals: 0 })).toBe("€ 2.500");
    expect(maskMoney(2500.78, false, { decimals: 0 })).toBe("€ 2.501");
  });

  it("withSymbol=false sadece sayı", () => {
    expect(maskMoney(99.5, false, { withSymbol: false })).toBe("99,50");
    expect(maskMoney(99.5, true, { withSymbol: false })).toBe("•••");
  });

  it("0 değer için doğru format", () => {
    expect(maskMoney(0, false)).toBe("€ 0,00");
    expect(maskMoney(0, true)).toBe("€ •••");
  });

  it("negatif değer (yıllık kayıp vs)", () => {
    expect(maskMoney(-150.25, false)).toBe("€ -150,25");
  });
});
