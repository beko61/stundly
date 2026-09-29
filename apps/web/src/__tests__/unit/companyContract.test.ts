import { describe, it, expect } from "vitest";
import { applyContract, contractFromProfile, hasContract, monthlyTargetFromWeekly } from "@/lib/company/contract";

describe("lib/company/contract", () => {
  it("Wochenstunden → Monats-Soll (× 52 / 12)", () => {
    expect(monthlyTargetFromWeekly(40)).toBe(173.33);
    expect(monthlyTargetFromWeekly(38.5)).toBe(166.83);
    expect(monthlyTargetFromWeekly(20)).toBe(86.67);
  });

  it("contractFromProfile: ohne Werte oder ohne Spalten → null", () => {
    expect(contractFromProfile(null)).toBeNull();
    expect(contractFromProfile({})).toBeNull();
    expect(contractFromProfile({ contract_weekly_hours: null, contract_vacation_days: null, contract_start: null })).toBeNull();
  });

  it("contractFromProfile: numeric-Strings aus Postgres werden Zahlen", () => {
    expect(contractFromProfile({ contract_weekly_hours: "40.00", contract_vacation_days: "30.0", contract_start: "2026-01-15" }))
      .toEqual({ weekly_hours: 40, vacation_days: 30, start_date: "2026-01-15" });
  });

  it("hasContract", () => {
    expect(hasContract(null)).toBe(false);
    expect(hasContract({ weekly_hours: null, vacation_days: 28, start_date: null })).toBe(true);
  });

  it("applyContract: Vertrag schlägt eigene Werte, nur gesetzte Felder", () => {
    const s = { monthly_target_hours: 160, urlaub_anspruch: 24, employment_start_date: null as string | null, hourly_rate: 18 };
    expect(applyContract(s, { weekly_hours: 40, vacation_days: null, start_date: null }))
      .toEqual({ ...s, monthly_target_hours: 173.33 });
    expect(applyContract(s, { weekly_hours: null, vacation_days: 30, start_date: "2026-03-01" }))
      .toEqual({ ...s, urlaub_anspruch: 30, employment_start_date: "2026-03-01" });
    expect(applyContract(s, null)).toBe(s);
  });

  it("applyContract: Objekt ohne employment_start_date bekommt keins dazu", () => {
    const s = { monthly_target_hours: 174, urlaub_anspruch: 30 };
    expect(applyContract(s, { weekly_hours: null, vacation_days: null, start_date: "2026-03-01" })).toEqual(s);
  });
});
