import { describe, it, expect, vi, afterEach } from "vitest";
import { BETA_MODE, BETA_END_DATE, BETA_END_DATE_LABEL, isBetaActive, betaDaysRemaining } from "@/lib/beta";

// Relativ zu BETA_END_DATE — eine Verlängerung der Beta bricht die Tests nicht.
const END = new Date(`${BETA_END_DATE}T12:00:00Z`);
const daysFromEnd = (d: number) => new Date(END.getTime() + d * 86400000);

afterEach(() => { vi.useRealTimers(); });

describe("Beta config", () => {
  it("BETA_END_DATE format YYYY-MM-DD", () => {
    expect(BETA_END_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("BETA_MODE boolean", () => {
    expect(typeof BETA_MODE).toBe("boolean");
  });

  it("Label ist deutsches Langformat", () => {
    expect(BETA_END_DATE_LABEL).toMatch(/^\d{2}\. [A-Za-zäöüÄÖÜ]+ \d{4}$/);
  });
});

describe("isBetaActive", () => {
  it("vor BETA_END_DATE → active (wenn BETA_MODE)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(daysFromEnd(-60));
    expect(isBetaActive()).toBe(BETA_MODE);
  });

  it("nach BETA_END_DATE → false", () => {
    vi.useFakeTimers();
    vi.setSystemTime(daysFromEnd(1));
    expect(isBetaActive()).toBe(false);
  });

  it("am BETA_END_DATE selbst → noch active", () => {
    vi.useFakeTimers();
    vi.setSystemTime(END);
    expect(isBetaActive()).toBe(BETA_MODE);
  });
});

describe("betaDaysRemaining", () => {
  it("30 Tage vor Ende → ~30", () => {
    vi.useFakeTimers();
    vi.setSystemTime(daysFromEnd(-30));
    const r = betaDaysRemaining();
    expect(r).toBeGreaterThanOrEqual(29);
    expect(r).toBeLessThanOrEqual(31);
  });

  it("nach Ende → 0 (nie negativ)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(daysFromEnd(30));
    expect(betaDaysRemaining()).toBe(0);
  });
});
