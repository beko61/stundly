import { describe, it, expect } from "vitest";
import { canTier, ndLimitFor, resolveTier } from "../entitlements";

const base = { betaMode: true, betaEnd: "2027-03-31" };

describe("resolveTier — Basic / Plus / Firma", () => {
  it("Firma: Mitglied einer Firma oder Team/Business-Plan", () => {
    expect(resolveTier({ ...base, plan: "trial", createdAt: "2020-01-01", hasCompany: true }).tier).toBe("firma");
    expect(resolveTier({ ...base, plan: "business", createdAt: "2020-01-01", hasCompany: false }).tier).toBe("firma");
  });

  it("Plus bezahlt (individual)", () => {
    expect(resolveTier({ ...base, plan: "individual", createdAt: "2020-01-01", hasCompany: false, now: new Date("2028-01-01") }))
      .toEqual({ tier: "plus", reason: "paid" });
  });

  it("Beta: in der Beta angemeldet → Plus bis Beta-Ende", () => {
    const r = resolveTier({ ...base, plan: "trial", createdAt: "2026-10-23T12:00:00Z", hasCompany: false, now: new Date("2026-12-01") });
    expect(r).toEqual({ tier: "plus", reason: "beta", until: "2027-03-31" });
  });

  it("nach der Beta: neue Nutzer 30 Tage Plus, danach Basic", () => {
    const created = "2027-05-01T10:00:00Z";
    const during = resolveTier({ ...base, plan: "trial", createdAt: created, hasCompany: false, now: new Date("2027-05-20") });
    expect(during).toMatchObject({ tier: "plus", reason: "trial", until: "2027-05-31" });
    const after = resolveTier({ ...base, plan: "trial", createdAt: created, hasCompany: false, now: new Date("2027-06-05") });
    expect(after).toEqual({ tier: "basic", reason: "basic" });
  });

  it("Beta-Nutzer nach Beta-Ende ohne Bezahlung → Basic (Testzeit lange vorbei)", () => {
    const r = resolveTier({ ...base, plan: "trial", createdAt: "2026-10-23T12:00:00Z", hasCompany: false, now: new Date("2027-04-15") });
    expect(r.tier).toBe("basic");
  });
});

describe("Rechte und Notdienst-Limit", () => {
  it("Basic gesperrt, Plus/Firma frei; Basic 5 Notdienste pro Monat", () => {
    expect(canTier("basic", "share")).toBe(false);
    expect(canTier("plus", "share")).toBe(true);
    expect(canTier("firma", "download")).toBe(true);
    expect(ndLimitFor("basic")).toBe(5);
    expect(ndLimitFor("plus")).toBe(Infinity);
  });
});
