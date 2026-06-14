import { describe, it, expect } from "vitest";
import { netMinutesForEntry, formatMinutes } from "@/lib/company/admin";

describe("netMinutesForEntry", () => {
  it("returns 0 when day_type is frei and times are null", () => {
    expect(netMinutesForEntry({
      date: "2026-06-15", start_time: null, end_time: null, break_minutes: null, day_type: "frei",
    })).toBe(0);
  });

  it("returns 0 when start_time or end_time missing on arbeiten day", () => {
    expect(netMinutesForEntry({
      date: "2026-06-15", start_time: "08:00", end_time: null, break_minutes: 60, day_type: "arbeiten",
    })).toBe(0);
  });

  it("calculates arbeiten day net minutes correctly (Mo)", () => {
    // 08:00-17:00 = 540, minus 60 break = 480 = 8h
    expect(netMinutesForEntry({
      date: "2026-06-15", start_time: "08:00", end_time: "17:00", break_minutes: 60, day_type: "arbeiten",
    })).toBe(480);
  });

  it("handles night shift (end before start)", () => {
    // 22:00-06:00 = 8h (crosses midnight), no break = 480
    expect(netMinutesForEntry({
      date: "2026-06-15", start_time: "22:00", end_time: "06:00", break_minutes: 0, day_type: "arbeiten",
    })).toBe(480);
  });

  it("treats null break as 0", () => {
    expect(netMinutesForEntry({
      date: "2026-06-15", start_time: "08:00", end_time: "09:00", break_minutes: null, day_type: "arbeiten",
    })).toBe(60);
  });

  it("returns 8h (480m) for urlaub on Mo-Fr", () => {
    // 2026-06-15 is a Monday
    expect(netMinutesForEntry({
      date: "2026-06-15", start_time: null, end_time: null, break_minutes: null, day_type: "urlaub",
    })).toBe(480);
  });

  it("returns 0 for urlaub on weekend", () => {
    // 2026-06-13 is a Saturday
    expect(netMinutesForEntry({
      date: "2026-06-13", start_time: null, end_time: null, break_minutes: null, day_type: "urlaub",
    })).toBe(0);
  });

  it("returns 8h for krank on weekday", () => {
    expect(netMinutesForEntry({
      date: "2026-06-15", start_time: null, end_time: null, break_minutes: null, day_type: "krank",
    })).toBe(480);
  });

  it("returns 8h for feiertag on weekday", () => {
    expect(netMinutesForEntry({
      date: "2026-06-15", start_time: null, end_time: null, break_minutes: null, day_type: "feiertag",
    })).toBe(480);
  });

  it("ignores break larger than total work time (clamps to 0)", () => {
    // 08:00-09:00 = 60min, but break=120min → max(0, 60-120) = 0
    expect(netMinutesForEntry({
      date: "2026-06-15", start_time: "08:00", end_time: "09:00", break_minutes: 120, day_type: "arbeiten",
    })).toBe(0);
  });

  it("defaults to arbeiten when day_type is null", () => {
    expect(netMinutesForEntry({
      date: "2026-06-15", start_time: "08:00", end_time: "17:00", break_minutes: 60, day_type: null,
    })).toBe(480);
  });
});

describe("formatMinutes", () => {
  it("returns 0h for 0", () => {
    expect(formatMinutes(0)).toBe("0h");
  });

  it("formats hours-only", () => {
    expect(formatMinutes(480)).toBe("8h");
    expect(formatMinutes(60)).toBe("1h");
  });

  it("formats hours+minutes", () => {
    expect(formatMinutes(495)).toBe("8h 15m");
    expect(formatMinutes(75)).toBe("1h 15m");
  });

  it("handles minutes-only under 60", () => {
    expect(formatMinutes(30)).toBe("0h 30m");
    expect(formatMinutes(1)).toBe("0h 1m");
  });

  it("handles large values", () => {
    expect(formatMinutes(60 * 174)).toBe("174h"); // standard month
    expect(formatMinutes(60 * 174 + 30)).toBe("174h 30m");
  });
});
