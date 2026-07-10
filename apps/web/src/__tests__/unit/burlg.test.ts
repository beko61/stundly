import { describe, it, expect } from "vitest";
import {
  BURLG_MIN_URLAUB_DAYS,
  BURLG_WARTEZEIT_MONTHS,
  BURLG_VERFALL_CUTOFF_MONTH,
  BURLG_VERFALL_CUTOFF_DAY,
  countFullMonthsInYear,
  calcAnnualEntitlement,
  calcUrlaubskonto,
} from "@workly/shared";

describe("BUrlG constants", () => {
  it("Min 20 Arbeitstage", () => expect(BURLG_MIN_URLAUB_DAYS).toBe(20));
  it("Wartezeit 6 Monate", () => expect(BURLG_WARTEZEIT_MONTHS).toBe(6));
  it("Verfall 31.03", () => {
    expect(BURLG_VERFALL_CUTOFF_MONTH).toBe(3);
    expect(BURLG_VERFALL_CUTOFF_DAY).toBe(31);
  });
});

describe("countFullMonthsInYear", () => {
  it("Ganzes Jahr → 12 Monate", () => {
    expect(countFullMonthsInYear("2025-06-15", null, 2026)).toBe(12);
  });
  it("Beschäftigung ab 01.01. → 12 Monate", () => {
    expect(countFullMonthsInYear("2026-01-01", null, 2026)).toBe(12);
  });
  it("Beschäftigung ab 15.06. → 6 volle Monate (Jul-Dez)", () => {
    expect(countFullMonthsInYear("2026-06-15", null, 2026)).toBe(6);
  });
  it("Beschäftigung ab 01.06. → 7 volle Monate (Jun-Dez)", () => {
    expect(countFullMonthsInYear("2026-06-01", null, 2026)).toBe(7);
  });
  it("Beschäftigung endet 30.06. → 6 volle Monate (Jan-Jun)", () => {
    expect(countFullMonthsInYear("2026-01-01", "2026-06-30", 2026)).toBe(6);
  });
  it("Beschäftigung 15.06.–15.09. → 2 volle Monate (Jul + Aug)", () => {
    expect(countFullMonthsInYear("2026-06-15", "2026-09-15", 2026)).toBe(2);
  });
  it("Beschäftigung 01.06.–30.09. → 4 volle Monate", () => {
    expect(countFullMonthsInYear("2026-06-01", "2026-09-30", 2026)).toBe(4);
  });
  it("Beschäftigung nur eine Woche → 0 Monate", () => {
    expect(countFullMonthsInYear("2026-06-15", "2026-06-22", 2026)).toBe(0);
  });
  it("Beschäftigung ganz vor dem Jahr → 0", () => {
    expect(countFullMonthsInYear("2020-01-01", "2024-12-31", 2026)).toBe(0);
  });
  it("Beschäftigung ganz nach dem Jahr → 0", () => {
    expect(countFullMonthsInYear("2028-01-01", null, 2026)).toBe(0);
  });
});

describe("calcAnnualEntitlement", () => {
  it("30 Tage / ganzes Jahr → 30", () => {
    const r = calcAnnualEntitlement({
      annualAnspruch: 30, employmentStart: null, employmentEnd: null, year: 2026,
    });
    expect(r.anspruch).toBe(30);
    expect(r.fullMonths).toBe(12);
    expect(r.isProrated).toBe(false);
  });
  it("30 Tage / ab 15.06. (6/12) → 15", () => {
    const r = calcAnnualEntitlement({
      annualAnspruch: 30, employmentStart: "2026-06-15", employmentEnd: null, year: 2026,
    });
    // 6 volle Monate (Jul-Dez) × 30/12 = 15
    expect(r.anspruch).toBe(15);
    expect(r.fullMonths).toBe(6);
    expect(r.isProrated).toBe(true);
    expect(r.waitingPeriodActive).toBe(false); // 6 Monate = Wartezeit erfüllt
  });
  it("30 Tage / ab 01.10. (3/12) → 8 (gerundet 30×3/12=7.5→8)", () => {
    const r = calcAnnualEntitlement({
      annualAnspruch: 30, employmentStart: "2026-10-01", employmentEnd: null, year: 2026,
    });
    // Oct-Dec = 3 volle Monate
    expect(r.fullMonths).toBe(3);
    expect(r.anspruch).toBe(Math.round(30 * 3 / 12)); // 8
    expect(r.waitingPeriodActive).toBe(true); // < 6 Monate
  });
  it("Ausgeschieden 30.06. → 6/12 = 15", () => {
    const r = calcAnnualEntitlement({
      annualAnspruch: 30, employmentStart: null, employmentEnd: "2026-06-30", year: 2026,
    });
    expect(r.fullMonths).toBe(6);
    expect(r.anspruch).toBe(15);
  });
});

describe("calcUrlaubskonto", () => {
  it("Kein Übertrag, kein Verfall, nicht verwendet", () => {
    const r = calcUrlaubskonto({
      thisYearEntitlement: 30, thisYearUsed: 0, previousYearRemaining: 0,
      refDate: "2026-06-15", year: 2026,
    });
    expect(r.carryOverAvailable).toBe(0);
    expect(r.carryOverExpired).toBe(false);
    expect(r.totalEntitlement).toBe(30);
    expect(r.remaining).toBe(30);
    expect(r.verfallWarning).toBe(false);
  });

  it("Übertrag 5 Tage, vor 31.03 → nutzbar", () => {
    const r = calcUrlaubskonto({
      thisYearEntitlement: 30, thisYearUsed: 0, previousYearRemaining: 5,
      refDate: "2026-02-15", year: 2026,
    });
    expect(r.carryOverAvailable).toBe(5);
    expect(r.carryOverExpired).toBe(false);
    expect(r.totalEntitlement).toBe(35);
    expect(r.remaining).toBe(35);
  });

  it("Übertrag 5 Tage, nach 31.03 → verfallen", () => {
    const r = calcUrlaubskonto({
      thisYearEntitlement: 30, thisYearUsed: 0, previousYearRemaining: 5,
      refDate: "2026-04-01", year: 2026,
    });
    expect(r.carryOverAvailable).toBe(0);
    expect(r.carryOverExpired).toBe(true);
    expect(r.totalEntitlement).toBe(30);
  });

  it("Übertrag 3 Tage + refDate 15.03 → Warnung (≤30 Tage bis Verfall)", () => {
    const r = calcUrlaubskonto({
      thisYearEntitlement: 30, thisYearUsed: 0, previousYearRemaining: 3,
      refDate: "2026-03-15", year: 2026,
    });
    expect(r.carryOverAvailable).toBe(3);
    expect(r.daysUntilVerfall).toBe(16);
    expect(r.verfallWarning).toBe(true);
  });

  it("Übertrag verfallen aber refDate 01.04 → keine Warnung", () => {
    const r = calcUrlaubskonto({
      thisYearEntitlement: 30, thisYearUsed: 0, previousYearRemaining: 3,
      refDate: "2026-04-01", year: 2026,
    });
    expect(r.verfallWarning).toBe(false);
  });

  it("Übertrag 5 aber remaining = 0 → keine Warnung", () => {
    const r = calcUrlaubskonto({
      thisYearEntitlement: 30, thisYearUsed: 35, previousYearRemaining: 5,
      refDate: "2026-03-15", year: 2026,
    });
    expect(r.remaining).toBe(0);
    expect(r.verfallWarning).toBe(false);
  });

  it("Rest negativ (überzogen)", () => {
    const r = calcUrlaubskonto({
      thisYearEntitlement: 30, thisYearUsed: 33, previousYearRemaining: 0,
      refDate: "2026-06-15", year: 2026,
    });
    expect(r.remaining).toBe(-3);
  });

  it("Verfall exakt 31.03 → noch nicht verfallen", () => {
    const r = calcUrlaubskonto({
      thisYearEntitlement: 30, thisYearUsed: 0, previousYearRemaining: 2,
      refDate: "2026-03-31", year: 2026,
    });
    expect(r.carryOverExpired).toBe(false);
    expect(r.daysUntilVerfall).toBe(0);
  });
});
