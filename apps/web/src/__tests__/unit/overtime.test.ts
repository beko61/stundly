import { describe, it, expect } from "vitest";
import { isWeekday, workdaysBetween } from "@/lib/vacation/overtime";

describe("isWeekday", () => {
  it("recognises Mo-Fr as weekday", () => {
    expect(isWeekday("2026-06-15")).toBe(true); // Mo
    expect(isWeekday("2026-06-19")).toBe(true); // Fr
  });
  it("rejects weekends", () => {
    expect(isWeekday("2026-06-13")).toBe(false); // Sa
    expect(isWeekday("2026-06-14")).toBe(false); // So
  });
});

describe("workdaysBetween", () => {
  it("counts only Mo-Fr inclusive", () => {
    // 2026-06-15 Mo .. 2026-06-19 Fr = 5
    expect(workdaysBetween("2026-06-15", "2026-06-19")).toBe(5);
  });
  it("excludes weekend days in range", () => {
    // Mo 15 .. So 21 = still 5 weekdays
    expect(workdaysBetween("2026-06-15", "2026-06-21")).toBe(5);
  });
  it("returns 0 if start > end", () => {
    expect(workdaysBetween("2026-06-20", "2026-06-15")).toBe(0);
  });
  it("counts a single weekday as 1", () => {
    expect(workdaysBetween("2026-06-15", "2026-06-15")).toBe(1);
  });
  it("counts a single weekend day as 0", () => {
    expect(workdaysBetween("2026-06-13", "2026-06-13")).toBe(0);
  });
});
