import { describe, it, expect } from "vitest";
import {
  ENTGFG_KRANKHEIT_LIMIT_DAYS,
  calcKrankheitEpisodes,
  findKrankheitExcessDays,
  longestKrankheitStreak,
} from "@workly/shared";
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
    day_type:       p.day_type ?? "krank",
    synced_at:      p.synced_at ?? null,
    created_at:     p.created_at ?? "2026-01-01T00:00:00Z",
    updated_at:     p.updated_at ?? "2026-01-01T00:00:00Z",
  };
}

const krank = (date: string) => mkEntry({ date, day_type: "krank" });
const arbeiten = (date: string) => mkEntry({ date, day_type: "arbeiten" });

// Yardımcı: n gün ardışık Krank tarih listesi
function krankRange(start: string, n: number): TimeEntry[] {
  const [yStr, mStr, dStr] = start.split("-");
  const y = Number(yStr); const m = Number(mStr); const d = Number(dStr);
  const out: TimeEntry[] = [];
  for (let i = 0; i < n; i++) {
    const dt = new Date(y, m - 1, d + i);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    out.push(krank(iso));
  }
  return out;
}

describe("§3 EntgFG constants", () => {
  it("Limit = 42 Tage (6 Wochen)", () => {
    expect(ENTGFG_KRANKHEIT_LIMIT_DAYS).toBe(42);
  });
});

describe("calcKrankheitEpisodes", () => {
  it("Boş entries → boş liste", () => {
    expect(calcKrankheitEpisodes([])).toEqual([]);
  });

  it("Sadece ARBEITEN → boş liste", () => {
    expect(calcKrankheitEpisodes([arbeiten("2026-01-15")])).toEqual([]);
  });

  it("1 gün Krank → 1 episode, days=1, kein excess", () => {
    const r = calcKrankheitEpisodes([krank("2026-01-15")]);
    expect(r).toHaveLength(1);
    expect(r[0]!.start).toBe("2026-01-15");
    expect(r[0]!.end).toBe("2026-01-15");
    expect(r[0]!.days).toBe(1);
    expect(r[0]!.excessDates).toEqual([]);
  });

  it("3 gün kesintisiz → 1 episode 3 gün", () => {
    const r = calcKrankheitEpisodes(krankRange("2026-01-15", 3));
    expect(r).toHaveLength(1);
    expect(r[0]!.days).toBe(3);
    expect(r[0]!.end).toBe("2026-01-17");
  });

  it("Gap günü → 2 ayrı episode", () => {
    const r = calcKrankheitEpisodes([
      krank("2026-01-15"),
      krank("2026-01-17"), // 16 gap
    ]);
    expect(r).toHaveLength(2);
    expect(r[0]!.days).toBe(1);
    expect(r[1]!.days).toBe(1);
  });

  it("42 gün kesintisiz → limit'te, excess yok", () => {
    const r = calcKrankheitEpisodes(krankRange("2026-01-01", 42));
    expect(r).toHaveLength(1);
    expect(r[0]!.days).toBe(42);
    expect(r[0]!.excessDates).toEqual([]);
  });

  it("43 gün kesintisiz → 1 gün excess (43. gün)", () => {
    const r = calcKrankheitEpisodes(krankRange("2026-01-01", 43));
    expect(r).toHaveLength(1);
    expect(r[0]!.days).toBe(43);
    expect(r[0]!.excessDates).toEqual(["2026-02-12"]); // 01.01 + 42 gün = 12.02
  });

  it("50 gün kesintisiz → 8 gün excess", () => {
    const r = calcKrankheitEpisodes(krankRange("2026-01-01", 50));
    expect(r[0]!.days).toBe(50);
    expect(r[0]!.excessDates).toHaveLength(8);
    expect(r[0]!.excessDates[0]).toBe("2026-02-12");
    expect(r[0]!.excessDates[7]).toBe("2026-02-19");
  });

  it("Ay geçişinde kesintisiz Krank tek episode olarak", () => {
    const r = calcKrankheitEpisodes([
      ...krankRange("2026-01-28", 4), // 28-31 Ocak
      ...krankRange("2026-02-01", 3), // 01-03 Şubat
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.days).toBe(7);
    expect(r[0]!.start).toBe("2026-01-28");
    expect(r[0]!.end).toBe("2026-02-03");
  });

  it("ARBEITEN entries mixed → sadece Krank sayılır", () => {
    const r = calcKrankheitEpisodes([
      arbeiten("2026-01-14"),
      krank("2026-01-15"),
      krank("2026-01-16"),
      arbeiten("2026-01-17"),
      krank("2026-01-18"),
    ]);
    expect(r).toHaveLength(2);
    expect(r[0]!.days).toBe(2);
    expect(r[1]!.days).toBe(1);
  });

  it("Duplicate Krank aynı tarih → tek sayılır", () => {
    const r = calcKrankheitEpisodes([
      krank("2026-01-15"),
      krank("2026-01-15"),
      krank("2026-01-16"),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.days).toBe(2);
  });

  it("Verschachtelte Episoden, kronolojik değil verilirse doğru", () => {
    const r = calcKrankheitEpisodes([
      krank("2026-03-05"),
      krank("2026-01-15"),
      krank("2026-01-16"),
      krank("2026-03-06"),
      krank("2026-01-17"),
    ]);
    expect(r).toHaveLength(2);
    expect(r[0]!.start).toBe("2026-01-15");
    expect(r[0]!.days).toBe(3);
    expect(r[1]!.start).toBe("2026-03-05");
    expect(r[1]!.days).toBe(2);
  });
});

describe("findKrankheitExcessDays", () => {
  it("42 gün → boş liste", () => {
    expect(findKrankheitExcessDays(krankRange("2026-01-01", 42))).toEqual([]);
  });
  it("45 gün → 3 gün excess", () => {
    const r = findKrankheitExcessDays(krankRange("2026-01-01", 45));
    expect(r).toHaveLength(3);
  });
  it("2 ayrı episode ikisi de 45 gün → 6 gün excess toplam", () => {
    const entries = [
      ...krankRange("2026-01-01", 45),
      // Gap: ay geçişi, 2026-04-01 sonrası (yeni episode olsun diye 2 hafta boşluk)
      ...krankRange("2026-06-01", 45),
    ];
    expect(findKrankheitExcessDays(entries)).toHaveLength(6);
  });
});

describe("longestKrankheitStreak", () => {
  it("Boş → 0", () => {
    expect(longestKrankheitStreak([])).toBe(0);
  });
  it("En uzun episode", () => {
    const entries = [
      ...krankRange("2026-01-01", 5),   // 5 gün
      arbeiten("2026-01-10"),
      ...krankRange("2026-01-20", 12),  // 12 gün
      arbeiten("2026-02-05"),
      ...krankRange("2026-03-01", 8),   // 8 gün
    ];
    expect(longestKrankheitStreak(entries)).toBe(12);
  });
});
