import { describe, it, expect, vi } from "vitest";
import { BETA_MODE, BETA_END_DATE, isBetaActive, betaDaysRemaining } from "@/lib/beta";

describe("Beta config", () => {
  it("BETA_END_DATE format YYYY-MM-DD", () => {
    expect(BETA_END_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("BETA_MODE boolean", () => {
    expect(typeof BETA_MODE).toBe("boolean");
  });
});

describe("isBetaActive", () => {
  it("BETA_MODE=true ve bugün < BETA_END_DATE → active", () => {
    // BETA_END_DATE = 2026-09-07; bu test sabit tarih ile yapılır
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01"));
    expect(isBetaActive()).toBe(BETA_MODE);
    vi.useRealTimers();
  });

  it("BETA_END_DATE'den sonra → false", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-01"));
    expect(isBetaActive()).toBe(false);
    vi.useRealTimers();
  });

  it("BETA_END_DATE'in tam günü → hâlâ active", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T12:00:00Z"));
    expect(isBetaActive()).toBe(BETA_MODE);
    vi.useRealTimers();
  });
});

describe("betaDaysRemaining", () => {
  it("BETA_END_DATE'den 30 gün önce → ~30", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-08T00:00:00Z"));
    const r = betaDaysRemaining();
    expect(r).toBeGreaterThanOrEqual(29);
    expect(r).toBeLessThanOrEqual(31);
    vi.useRealTimers();
  });

  it("Beta bittikten sonra → 0", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-01"));
    expect(betaDaysRemaining()).toBe(0);
    vi.useRealTimers();
  });
});
