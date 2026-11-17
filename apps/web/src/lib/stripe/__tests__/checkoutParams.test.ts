import { describe, it, expect } from "vitest";
import { buildCheckoutParams } from "../server";
import { betaDiscountApplies } from "@/lib/pricing";

const base = {
  priceId: "price_plus_m", billingInterval: "monthly" as const,
  successUrl: "https://stundly.de/ok", cancelUrl: "https://stundly.de/pricing",
  userId: "u1", customerEmail: "a@b.de",
};

describe("buildCheckoutParams", () => {
  it("keine Stripe-Testphase (die App gibt die 30 Tage schon ohne Karte)", () => {
    const p = buildCheckoutParams(base);
    expect(p.subscription_data?.trial_period_days).toBeUndefined();
    expect(p.subscription_data?.metadata).toEqual({ company_id: "", user_id: "u1" });
  });

  it("Beta-Tester: Coupon automatisch, dann kein Promo-Code-Feld (Stripe erlaubt nicht beides)", () => {
    const p = buildCheckoutParams({ ...base, betaCouponId: "BETA50" });
    expect(p.discounts).toEqual([{ coupon: "BETA50" }]);
    expect(p.allow_promotion_codes).toBeUndefined();
  });

  it("ohne Beta-Coupon: Promo-Codes erlaubt, kein Rabatt", () => {
    const p = buildCheckoutParams(base);
    expect(p.discounts).toBeUndefined();
    expect(p.allow_promotion_codes).toBe(true);
  });

  it("bestehender Kunde statt E-Mail", () => {
    const p = buildCheckoutParams({ ...base, customerId: "cus_1" });
    expect(p.customer).toBe("cus_1");
    expect(p.customer_email).toBeUndefined();
  });
});

describe("betaDiscountApplies", () => {
  it("bis einschließlich Beta-Ende registriert → ja, danach nein", () => {
    expect(betaDiscountApplies("2026-11-17T10:00:00Z")).toBe(true);
    expect(betaDiscountApplies("2027-03-31T23:00:00Z")).toBe(true);
    expect(betaDiscountApplies("2027-04-01T00:00:00Z")).toBe(false);
    expect(betaDiscountApplies(null)).toBe(false);
  });
});
