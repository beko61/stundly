import { describe, it, expect } from "vitest";
import { calculateMonthlySalary } from "@workly/shared";
import type { TimeEntry, SalarySettings } from "@workly/shared";

const BASE_SETTINGS: SalarySettings = {
  id: "test", user_id: "test", valid_from: "2024-01-01",
  hourly_rate:              20,
  overtime_rate_multiplier: 1.5,
  night_shift_bonus:        5,
  notdienst_bonus:          100,
  monthly_target_hours:     8, // 8h target = easy to test overtime
};

function makeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: "1", user_id: "u", date: "2024-01-01",
    start_time: "08:00", end_time: "17:00",
    break_minutes: 60,
    day_type: "arbeiten",
    is_night_shift: false,
    note: null, tags: [],
    synced_at: null, created_at: "", updated_at: "",
    ...overrides,
  };
}

describe("calculateMonthlySalary", () => {
  it("8h target, 8h worked → no overtime", () => {
    const entries = [makeEntry()]; // 08:00–17:00 - 60min = 8h
    const r = calculateMonthlySalary(entries, BASE_SETTINGS);
    expect(r.worked_hours).toBeCloseTo(8);
    expect(r.overtime_hours).toBeCloseTo(0);
    expect(r.base_pay).toBeCloseTo(160); // 8h × €20
    expect(r.overtime_pay).toBeCloseTo(0);
    expect(r.total_gross).toBeCloseTo(160);
  });

  it("adds overtime pay for extra hours", () => {
    // 08:00–20:00 - 0 min break = 12h, target = 8h → 4h overtime
    // Festgehalt-Modell: base zaten ödendi, ek olarak (multiplier - 1) zuschlag
    const entries = [makeEntry({ end_time: "20:00", break_minutes: 0 })];
    const r = calculateMonthlySalary(entries, BASE_SETTINGS);
    expect(r.worked_hours).toBeCloseTo(12);
    expect(r.overtime_hours).toBeCloseTo(4);
    expect(r.overtime_pay).toBeCloseTo(4 * 20 * (1.5 - 1)); // 40 (zuschlag, base zaten içinde)
    expect(r.total_gross).toBeCloseTo(8 * 20 + 40); // base 160 + Mehrarbeit-zuschlag 40 = 200
  });

  it("adds notdienst bonus per day", () => {
    const entries = [makeEntry({ day_type: "notdienst" })];
    const r = calculateMonthlySalary(entries, BASE_SETTINGS);
    expect(r.notdienst_bonus).toBeCloseTo(100);
  });

  it("zero entries → Festgehalt only (base_pay = target × rate, no overtime)", () => {
    // Festgehalt-Modell (Almanya KOBİ standardı):
    // Ay boş bile olsa baz ödeme garantilenir (Urlaub/Krank tamamlayacak varsayım).
    const r = calculateMonthlySalary([], BASE_SETTINGS);
    expect(r.worked_hours).toBe(0);
    expect(r.overtime_pay).toBe(0);
    expect(r.base_pay).toBe(8 * 20); // 8h target × €20 = €160
    expect(r.total_gross).toBe(8 * 20);
  });

  it("urlaub entries count as 8h paid (Sollstunden, German law)", () => {
    // Festgehalt sisteminde Urlaub Sollstunden olarak sayılır — base_pay zaten içinde.
    const entries = [makeEntry({ day_type: "urlaub", start_time: null, end_time: null })];
    const r = calculateMonthlySalary(entries, BASE_SETTINGS);
    expect(r.worked_hours).toBeCloseTo(8);   // 2024-01-01 = Mo → 8h
    expect(r.overtime_hours).toBeCloseTo(0); // worked = target, kein Mehrarbeit
    expect(r.base_pay).toBeCloseTo(8 * 20);  // 160
    expect(r.total_gross).toBeCloseTo(8 * 20);
  });

  it("krank entries without times count as 8h paid (German law)", () => {
    const entries = [makeEntry({ day_type: "krank", start_time: null, end_time: null })];
    const r = calculateMonthlySalary(entries, BASE_SETTINGS);
    expect(r.worked_hours).toBeCloseTo(8);
    expect(r.base_pay).toBeCloseTo(8 * 20); // 160
  });

  it("feiertag entries without times count as 8h paid (German law)", () => {
    const entries = [makeEntry({ day_type: "feiertag", start_time: null, end_time: null })];
    const r = calculateMonthlySalary(entries, BASE_SETTINGS);
    expect(r.worked_hours).toBeCloseTo(8);
    expect(r.base_pay).toBeCloseTo(8 * 20); // 160
  });
});
