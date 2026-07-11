import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({ id: "mock-email-id" }) },
  })),
}));

import { computeMonthlyReportStats } from "@/lib/email/monthlyReport";
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

describe("computeMonthlyReportStats", () => {
  it("Boş entries → 0 sayaçlar", () => {
    const s = computeMonthlyReportStats({
      year: 2026, month: 6,
      entries: [], notdienst: [], yearEntries: [],
    });
    expect(s.monthWorkedMin).toBe(0);
    expect(s.monthWorkedDays).toBe(0);
    expect(s.monthLabel).toBe("Juni 2026");
  });

  it("5 arbeiten günü = 40h", () => {
    const entries = [
      arbeiten("2026-06-01"), arbeiten("2026-06-02"), arbeiten("2026-06-03"),
      arbeiten("2026-06-04"), arbeiten("2026-06-05"),
    ];
    const s = computeMonthlyReportStats({
      year: 2026, month: 6, entries, notdienst: [], yearEntries: entries,
    });
    expect(s.monthWorkedMin).toBe(5 * 8 * 60);
    expect(s.monthWorkedDays).toBe(5);
  });

  it("Ay dışı entry sayılmaz", () => {
    const entries = [
      arbeiten("2026-05-31"), // önceki ay
      arbeiten("2026-06-01"),
      arbeiten("2026-07-01"), // sonraki ay
    ];
    const s = computeMonthlyReportStats({
      year: 2026, month: 6, entries, notdienst: [], yearEntries: entries,
    });
    expect(s.monthWorkedDays).toBe(1);
  });

  it("Urlaub / Krank sayaçları", () => {
    const entries = [
      arbeiten("2026-06-01"),
      urlaub("2026-06-10"), urlaub("2026-06-11"),
      krank("2026-06-15"),
    ];
    const s = computeMonthlyReportStats({
      year: 2026, month: 6, entries, notdienst: [], yearEntries: entries,
    });
    expect(s.monthUrlaubDays).toBe(2);
    expect(s.monthKrankDays).toBe(1);
    expect(s.monthWorkedDays).toBe(1);
  });

  it("Notdienst hafta-Pazar-atfı UYGULANIYOR", () => {
    // 2026-06-28 Pazar - MAYIS'a ait DEĞİL, HAZİRAN'a ait
    // 2026-05-31 Pazar - MAYIS'a ait
    // 2026-04-30 Perşembe → haftası 27-3, Pazar Mayıs 3 → MAYIS'a
    const s = computeMonthlyReportStats({
      year: 2026, month: 5, entries: [], yearEntries: [],
      notdienst: [
        { date: "2026-04-30", start_time: "18:00", end_time: "22:00" }, // hafta Pazar 3.05 → MAYIS
        { date: "2026-05-31", start_time: "18:00", end_time: "22:00" }, // Pazar 31.05 → MAYIS
        { date: "2026-06-01", start_time: "18:00", end_time: "22:00" }, // Pazar 7.06 → HAZIRAN
      ],
    });
    // MAYIS'a atfı: 30.04 + 31.05 = 2
    expect(s.monthNotdienstDays).toBe(2);
  });

  it("§3 ArbZG cap violation", () => {
    const entries = [
      arbeiten("2026-06-01", "07:00", "19:00", 60), // 11h → violation
      arbeiten("2026-06-02"),
    ];
    const s = computeMonthlyReportStats({
      year: 2026, month: 6, entries, notdienst: [], yearEntries: entries,
    });
    expect(s.capViolations).toContain("2026-06-01");
    expect(s.capViolations).toHaveLength(1);
  });

  it("§3 EntgFG 6-Wochen aşımı", () => {
    // 44 gün kesintisiz Krank
    const yearEntries: TimeEntry[] = [];
    const start = new Date(2026, 3, 15); // 2026-04-15
    for (let i = 0; i < 44; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      yearEntries.push(krank(iso));
    }
    const s = computeMonthlyReportStats({
      year: 2026, month: 5, entries: [], notdienst: [], yearEntries,
    });
    expect(s.krankheitOverLimit).toBe(2); // 43. + 44. gün
  });

  it("reportUrl format", () => {
    const s = computeMonthlyReportStats({
      year: 2026, month: 6, entries: [], notdienst: [], yearEntries: [],
    });
    expect(s.reportUrl).toContain("/reports?year=2026&month=6");
  });
});
