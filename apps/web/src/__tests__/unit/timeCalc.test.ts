import { describe, it, expect } from "vitest";
import {
  parseTimeToMinutes,
  calculateWorkDuration,
  formatDuration,
  calculateOvertime,
} from "@workly/shared";

describe("parseTimeToMinutes", () => {
  it("parses 08:00 → 480", () => expect(parseTimeToMinutes("08:00")).toBe(480));
  it("parses 17:30 → 1050", () => expect(parseTimeToMinutes("17:30")).toBe(1050));
  it("parses 00:00 → 0", () => expect(parseTimeToMinutes("00:00")).toBe(0));
});

describe("calculateWorkDuration", () => {
  it("normal day 08:00–17:00 with 30 min break", () => {
    const r = calculateWorkDuration("08:00", "17:00", 30);
    expect(r.total_minutes).toBe(540);
    expect(r.net_minutes).toBe(510);
    expect(r.is_overnight).toBe(false);
  });

  it("overnight shift 22:00–06:00 with 0 min break", () => {
    const r = calculateWorkDuration("22:00", "06:00", 0);
    expect(r.total_minutes).toBe(480);
    expect(r.net_minutes).toBe(480);
    expect(r.is_overnight).toBe(true);
  });

  it("break larger than work → 0 net minutes", () => {
    const r = calculateWorkDuration("09:00", "09:30", 60);
    expect(r.net_minutes).toBe(0);
  });
});

describe("formatDuration", () => {
  it("0 → '0h'",        () => expect(formatDuration(0)).toBe("0h"));
  it("60 → '1h'",       () => expect(formatDuration(60)).toBe("1h"));
  it("90 → '1h 30m'",   () => expect(formatDuration(90)).toBe("1h 30m"));
  it("-30 → '-0h 30m'", () => expect(formatDuration(-30)).toBe("-0h 30m"));
});

describe("calculateOvertime", () => {
  it("overtime positive when worked > target", () =>
    expect(calculateOvertime(600, 480)).toBe(120));
  it("negative when worked < target", () =>
    expect(calculateOvertime(400, 480)).toBe(-80));
  it("zero when exactly on target", () =>
    expect(calculateOvertime(480, 480)).toBe(0));
});
