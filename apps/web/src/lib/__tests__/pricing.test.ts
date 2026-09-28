// @vitest-environment node
import { describe, it, expect } from "vitest";
import { BETA_DISCOUNT_PCT, PAID_START_LABEL, PLAN_PRICES, BETA_PRICE_LINE, euro } from "../pricing";

describe("pricing", () => {
  it("Beta-Preis hält das Versprechen: mindestens 50 % unter regulär", () => {
    for (const p of Object.values(PLAN_PRICES)) {
      expect(p.beta).toBeLessThanOrEqual(p.monthly * (1 - BETA_DISCOUNT_PCT / 100));
      expect(p.beta).toBeGreaterThan(0);
    }
  });

  it("Jahrespreis höchstens 10 Monatspreise ('2 Monate gratis' stimmt)", () => {
    for (const p of Object.values(PLAN_PRICES)) expect(p.yearly).toBeLessThanOrEqual(p.monthly * 10);
  });

  it("reguläre Preise ab dem Tag nach Beta-Ende", () => {
    expect(PAID_START_LABEL).toBe("01.04.2027");
  });

  it("einheitlicher Satz ohne Streichpreis", () => {
    expect(euro(2.99)).toBe("2,99 €");
    expect(BETA_PRICE_LINE).toBe("Danach für Beta-Tester dauerhaft 50 % günstiger: ab 2,99 €/Monat (regulär ab 5,99 €)");
  });
});
