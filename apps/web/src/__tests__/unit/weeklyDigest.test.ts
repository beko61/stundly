import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock resend to avoid real API calls
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({ id: "mock-email-id" }) },
  })),
}));

import { computeWeeklyDigestStats } from "@/lib/email/weeklyDigest";
import type { TimeEntry } from "@workly/shared";

function mkEntry(p: Partial<TimeEntry> & { date: string }): TimeEntry {
  return {
    id:             p.id ?? `e-${p.date}`,
    user_id:        p.user_id ?? "u",
    date:           p.date,
    start_time:     p.start_time ?? null,
    end_time:       p.end_time ?? null,
    break_minutes:  p.break_minutes ?? 0,
    is_night_shift: p.is_night_shift ?? false,
    note:           p.note ?? null,
    tags:           p.tags ?? [],
    day_type:       p.day_type ?? "arbeiten",
    synced_at:      p.synced_at ?? null,
    created_at:     p.created_at ?? "2026-01-01T00:00:00Z",
    updated_at:     p.updated_at ?? "2026-01-01T00:00:00Z",
  };
}

const arbeiten = (date: string, start = "08:00", end = "17:00", brk = 60) =>
  mkEntry({ date, start_time: start, end_time: end, break_minutes: brk, day_type: "arbeiten" });
const urlaub = (date: string) => mkEntry({ date, day_type: "urlaub" });
const krank  = (date: string) => mkEntry({ date, day_type: "krank" });

beforeEach(() => {
  process.env.RESEND_API_KEY = "test-key";
});

describe("computeWeeklyDigestStats", () => {
  // refDate = 2026-07-13 (Monday). Previous week = 2026-07-06 (Mo) - 2026-07-12 (So)
  const refDate = "2026-07-13";

  it("Boş entries → tüm sayaçlar 0", () => {
    const s = computeWeeklyDigestStats({
      refDate, entries: [], notdienst: [], yearEntries: [],
    });
    expect(s.weekWorkedMin).toBe(0);
    expect(s.weekWorkedDays).toBe(0);
    expect(s.weekUrlaubDays).toBe(0);
    expect(s.weekKrankDays).toBe(0);
    expect(s.weekNotdienstDays).toBe(0);
    expect(s.monthWorkedMin).toBe(0);
  });

  it("Hafta window: 5 arbeiten günü → 40h + 5 gün", () => {
    const entries = [
      arbeiten("2026-07-06"), arbeiten("2026-07-07"), arbeiten("2026-07-08"),
      arbeiten("2026-07-09"), arbeiten("2026-07-10"),
    ];
    const s = computeWeeklyDigestStats({
      refDate, entries, notdienst: [], yearEntries: entries,
    });
    expect(s.weekWorkedMin).toBe(5 * 8 * 60);
    expect(s.weekWorkedDays).toBe(5);
    expect(s.weekStartISO).toBe("2026-07-06");
    expect(s.weekEndISO).toBe("2026-07-12");
  });

  it("Bu hafta (2026-07-13'ten sonra) sayılmaz", () => {
    const entries = [
      arbeiten("2026-07-13"), // Monday (this week)
      arbeiten("2026-07-06"), // Last Monday
    ];
    const s = computeWeeklyDigestStats({
      refDate, entries, notdienst: [], yearEntries: entries,
    });
    expect(s.weekWorkedDays).toBe(1); // Only 06.07
  });

  it("Önceki haftadan önce (2026-07-05) sayılmaz", () => {
    const entries = [
      arbeiten("2026-07-05"), // day before last week's Mon
      arbeiten("2026-07-06"),
    ];
    const s = computeWeeklyDigestStats({
      refDate, entries, notdienst: [], yearEntries: entries,
    });
    expect(s.weekWorkedDays).toBe(1);
  });

  it("Urlaub / Krank sayaçları", () => {
    const entries = [
      arbeiten("2026-07-06"),
      urlaub("2026-07-07"), urlaub("2026-07-08"),
      krank("2026-07-09"),
    ];
    const s = computeWeeklyDigestStats({
      refDate, entries, notdienst: [], yearEntries: entries,
    });
    expect(s.weekUrlaubDays).toBe(2);
    expect(s.weekKrankDays).toBe(1);
    expect(s.weekWorkedDays).toBe(1);
  });

  it("Notdienst sayısı sadece geçen hafta", () => {
    const s = computeWeeklyDigestStats({
      refDate, entries: [], yearEntries: [],
      notdienst: [
        { date: "2026-07-05", start_time: "18:00", end_time: "22:00" }, // before window
        { date: "2026-07-06", start_time: "18:00", end_time: "22:00" }, // in
        { date: "2026-07-08", start_time: "18:00", end_time: "22:00" }, // in
        { date: "2026-07-13", start_time: "18:00", end_time: "22:00" }, // after (this week)
      ],
    });
    expect(s.weekNotdienstDays).toBe(2);
  });

  it("Ay bazlı toplam (monthWorkedMin) — Temmuz tüm entries", () => {
    const entries = [
      arbeiten("2026-07-01"), arbeiten("2026-07-02"),
      arbeiten("2026-07-06"), arbeiten("2026-07-07"), arbeiten("2026-07-08"),
      arbeiten("2026-07-09"), arbeiten("2026-07-10"),
    ];
    const s = computeWeeklyDigestStats({
      refDate, entries, notdienst: [], yearEntries: entries,
    });
    expect(s.monthWorkedMin).toBe(7 * 8 * 60); // 7 gün
    expect(s.weekWorkedMin).toBe(5 * 8 * 60);  // 5 gün geçen hafta
    expect(s.monthName).toBe("Juli");
  });

  it("§3 ArbZG cap violation (11h netto)", () => {
    const entries = [
      arbeiten("2026-07-06", "07:00", "19:00", 60),  // 11h netto → violation
      arbeiten("2026-07-07"),
    ];
    const s = computeWeeklyDigestStats({
      refDate, entries, notdienst: [], yearEntries: entries,
    });
    expect(s.capViolations).toContain("2026-07-06");
    expect(s.capViolations).toHaveLength(1);
  });

  it("§3 EntgFG 6-Wochen aşımı", () => {
    // 44 gün kesintisiz Krank
    const yearEntries: TimeEntry[] = [];
    const start = new Date(2026, 4, 1); // 2026-05-01
    for (let i = 0; i < 44; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      yearEntries.push(krank(iso));
    }
    const s = computeWeeklyDigestStats({
      refDate, entries: yearEntries, notdienst: [], yearEntries,
    });
    expect(s.krankheitOverLimit).toBe(2); // 43. + 44. gün
  });

  it("Compliance yoksa 0", () => {
    const entries = [arbeiten("2026-07-06"), arbeiten("2026-07-07")];
    const s = computeWeeklyDigestStats({
      refDate, entries, notdienst: [], yearEntries: entries,
    });
    expect(s.capViolations).toEqual([]);
    expect(s.krankheitOverLimit).toBe(0);
  });
});
