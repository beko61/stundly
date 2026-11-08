import { describe, it, expect } from "vitest";
import {
  getDefaultForDow, DEFAULT_STANDARD_TIMES, dayNetMinutes, weeklyNetMinutes, monthlyTargetHoursFromStandard,
} from "@/lib/utils/standardTimes";

describe("Soll aus Standardzeiten (Onboarding)", () => {
  it("Tag netto = Ende − Beginn − Pause; ungültig ≤ 0", () => {
    expect(dayNetMinutes("07:45", "17:00", 60)).toBe(495);
    expect(dayNetMinutes("08:00", "08:30", 30)).toBe(0);
    expect(dayNetMinutes("17:00", "08:00", 0)).toBeLessThan(0);
  });

  it("Standard: 4 × 8h15 + 6h15 = 39h15 pro Woche → 170,08 h Soll", () => {
    expect(weeklyNetMinutes(DEFAULT_STANDARD_TIMES)).toBe(39 * 60 + 15);
    expect(monthlyTargetHoursFromStandard(DEFAULT_STANDARD_TIMES)).toBe(170.08);
  });

  it("40-Stunden-Woche → 173,33 h (gleiche Formel wie Firmenvertrag: × 52 / 12)", () => {
    const t = { monThuStart: "07:00", monThuEnd: "15:30", monThuPause: 30, friStart: "07:00", friEnd: "15:30", friPause: 30 };
    expect(weeklyNetMinutes(t)).toBe(40 * 60);
    expect(monthlyTargetHoursFromStandard(t)).toBe(173.33);
  });
});

describe("getDefaultForDow", () => {
  it("Mo-Do (dow 1-4) → monThuStart/End/Pause", () => {
    for (const dow of [1, 2, 3, 4]) {
      const r = getDefaultForDow(dow);
      expect(r).toEqual({
        start: DEFAULT_STANDARD_TIMES.monThuStart,
        end:   DEFAULT_STANDARD_TIMES.monThuEnd,
        pause: DEFAULT_STANDARD_TIMES.monThuPause,
      });
    }
  });

  it("Fr (dow 5) → friStart/End/Pause (kısa gün)", () => {
    const r = getDefaultForDow(5);
    expect(r).toEqual({
      start: DEFAULT_STANDARD_TIMES.friStart,
      end:   DEFAULT_STANDARD_TIMES.friEnd,
      pause: DEFAULT_STANDARD_TIMES.friPause,
    });
  });

  it("Sa (dow 6) ve So (dow 0) → null", () => {
    expect(getDefaultForDow(0)).toBeNull();
    expect(getDefaultForDow(6)).toBeNull();
  });

  it("custom StandardTimes parametresiyle override edilebilir", () => {
    const custom = {
      monThuStart: "09:00", monThuEnd: "18:00", monThuPause: 45,
      friStart:    "09:00", friEnd:    "15:00", friPause:    30,
    };
    expect(getDefaultForDow(1, custom)).toEqual({ start: "09:00", end: "18:00", pause: 45 });
    expect(getDefaultForDow(5, custom)).toEqual({ start: "09:00", end: "15:00", pause: 30 });
  });
});

describe("DEFAULT_STANDARD_TIMES constants", () => {
  it("Mo-Do 8h+ Sollstunden (07:45-17:00 - 60m = 8h15m)", () => {
    // Sanity: 17:00 - 07:45 = 9h15m, -60m = 8h15m
    expect(DEFAULT_STANDARD_TIMES.monThuStart).toBe("07:45");
    expect(DEFAULT_STANDARD_TIMES.monThuEnd).toBe("17:00");
    expect(DEFAULT_STANDARD_TIMES.monThuPause).toBe(60);
  });
  it("Fr daha kısa (07:45-14:30 - 30m = 6h15m)", () => {
    expect(DEFAULT_STANDARD_TIMES.friStart).toBe("07:45");
    expect(DEFAULT_STANDARD_TIMES.friEnd).toBe("14:30");
    expect(DEFAULT_STANDARD_TIMES.friPause).toBe(30);
  });
});
