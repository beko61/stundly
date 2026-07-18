import { describe, it, expect } from "vitest";
import {
  ARBZG_MAX_DAILY_MINUTES,
  ARBZG_STANDARD_MINUTES,
  ARBZG_ROLLING_WINDOW_MONTHS,
  ARBZG_RUHEZEIT_MIN_MINUTES,
  ARBZG_WEEKLY_MAX_MINUTES,
  isDailyCapViolation,
  isRollingAvgViolation,
  isRuhezeitViolation,
  findDailyCapViolations,
  calcRolling6MonthAvg,
  calcRuhezeitMinutes,
  calcWeeklyMinutes,
  findWeeklyCapViolations,
  getMinRequiredBreak,
  isPauseInsufficient,
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
    day_type:       p.day_type ?? "arbeiten",
    synced_at:      p.synced_at ?? null,
    created_at:     p.created_at ?? "2026-01-01T00:00:00Z",
    updated_at:     p.updated_at ?? "2026-01-01T00:00:00Z",
  };
}

const arbeiten = (date: string, start: string, end: string, brk: number): TimeEntry =>
  mkEntry({ date, start_time: start, end_time: end, break_minutes: brk, day_type: "arbeiten" });

describe("ArbZG constants", () => {
  it("10h cap in Minuten", () => {
    expect(ARBZG_MAX_DAILY_MINUTES).toBe(600);
  });
  it("8h Standard in Minuten", () => {
    expect(ARBZG_STANDARD_MINUTES).toBe(480);
  });
  it("Ausgleichszeitraum = 6 Monate", () => {
    expect(ARBZG_ROLLING_WINDOW_MONTHS).toBe(6);
  });
  it("Ruhezeit min = 11h = 660min", () => {
    expect(ARBZG_RUHEZEIT_MIN_MINUTES).toBe(660);
  });
});

describe("isDailyCapViolation", () => {
  it("600 min (10h netto) = OK (Grenze, nicht überschritten)", () => {
    expect(isDailyCapViolation(600)).toBe(false);
  });
  it("601 min = Violation", () => {
    expect(isDailyCapViolation(601)).toBe(true);
  });
  it("480 min (8h) = OK", () => {
    expect(isDailyCapViolation(480)).toBe(false);
  });
});

describe("isRollingAvgViolation", () => {
  it("480 min Ø = OK", () => {
    expect(isRollingAvgViolation(480)).toBe(false);
  });
  it("481 min Ø = Violation", () => {
    expect(isRollingAvgViolation(481)).toBe(true);
  });
});

describe("findDailyCapViolations", () => {
  it("07:00–19:30 mit 30 min Pause = 12h netto → Violation", () => {
    const entries = [arbeiten("2026-07-01", "07:00", "19:30", 30)];
    const v = findDailyCapViolations(entries);
    expect(v).toHaveLength(1);
    expect(v[0]!.date).toBe("2026-07-01");
    expect(v[0]!.netMinutes).toBe(12 * 60);
  });
  it("08:00–18:00 mit 0 min Pause = 10h netto = OK (Grenze)", () => {
    const entries = [arbeiten("2026-07-01", "08:00", "18:00", 0)];
    expect(findDailyCapViolations(entries)).toEqual([]);
  });
  it("08:00–18:01 mit 0 min Pause = 10h1m = Violation", () => {
    const entries = [arbeiten("2026-07-01", "08:00", "18:01", 0)];
    const v = findDailyCapViolations(entries);
    expect(v).toHaveLength(1);
    expect(v[0]!.netMinutes).toBe(601);
  });
  it("Nachtschicht 22:00–09:00 mit 30 min Pause = 10h30m netto = Violation", () => {
    const entries = [arbeiten("2026-07-01", "22:00", "09:00", 30)];
    const v = findDailyCapViolations(entries);
    expect(v).toHaveLength(1);
    expect(v[0]!.netMinutes).toBe(10 * 60 + 30);
  });
  it("Urlaub/Krank/Feiertag Einträge werden ignoriert", () => {
    const entries = [
      mkEntry({ date: "2026-07-01", day_type: "urlaub", start_time: "00:00", end_time: "23:59", break_minutes: 0 }),
      mkEntry({ date: "2026-07-02", day_type: "krank" }),
      mkEntry({ date: "2026-07-03", day_type: "feiertag" }),
    ];
    expect(findDailyCapViolations(entries)).toEqual([]);
  });
  it("Mehrere Tage — chronologisch sortiert nicht erzwungen (nur Verstöße)", () => {
    const entries = [
      arbeiten("2026-07-05", "07:00", "19:30", 30), // Violation
      arbeiten("2026-07-01", "08:00", "17:00", 60), // OK 8h
      arbeiten("2026-07-03", "06:00", "20:00", 60), // Violation 13h
    ];
    const v = findDailyCapViolations(entries);
    expect(v.map(x => x.date).sort()).toEqual(["2026-07-03", "2026-07-05"]);
  });
});

describe("calcRolling6MonthAvg", () => {
  it("Boş entries → avg 0, isViolation false", () => {
    const r = calcRolling6MonthAvg([], "2026-07-10");
    expect(r.avgDailyMin).toBe(0);
    expect(r.isViolation).toBe(false);
    expect(r.workdayCount).toBeGreaterThan(100); // 6 ay Mo-Fr ~130
    expect(r.windowStart).toBe("2026-01-10");
    expect(r.windowEnd).toBe("2026-07-10");
  });

  it("Tek gün 12h ARBEITEN — 130 Werktag'a bölünür → avg ~5.5 min → OK", () => {
    const entries = [arbeiten("2026-07-01", "07:00", "19:30", 30)]; // 12h netto = 720 min
    const r = calcRolling6MonthAvg(entries, "2026-07-10");
    expect(r.totalNetMin).toBe(720);
    expect(r.avgDailyMin).toBeLessThan(10); // ~5.5
    expect(r.isViolation).toBe(false);
  });

  it("Her Werktag 10h netto → Ø 10h > 8h → Violation", () => {
    // 6 ay = ~131 Werktag. Her birine 10h netto entry oluştur.
    const entries: TimeEntry[] = [];
    const start = new Date(2026, 0, 10); // 2026-01-10
    const end = new Date(2026, 6, 10); // 2026-07-10
    const cur = new Date(start);
    while (cur <= end) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) {
        const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
        entries.push(arbeiten(iso, "08:00", "18:00", 0)); // 10h netto
      }
      cur.setDate(cur.getDate() + 1);
    }
    const r = calcRolling6MonthAvg(entries, "2026-07-10");
    expect(r.avgDailyMin).toBe(600); // 10h
    expect(r.isViolation).toBe(true);
  });

  it("Urlaub-Tage werden aus dem Nenner herausgerechnet (BAG 27.4.2000)", () => {
    // 3 Mo-Fr'de 12h ARBEITEN, 2 Mo-Fr'de Urlaub
    const entries: TimeEntry[] = [
      arbeiten("2026-07-06", "07:00", "19:30", 30), // 12h
      arbeiten("2026-07-07", "07:00", "19:30", 30), // 12h
      arbeiten("2026-07-08", "07:00", "19:30", 30), // 12h
      mkEntry({ date: "2026-07-09", day_type: "urlaub" }),
      mkEntry({ date: "2026-07-10", day_type: "urlaub" }),
    ];
    const r = calcRolling6MonthAvg(entries, "2026-07-10");
    // Nenner = Werktage in Fenster - 2 Urlaubstage
    // Zähler = 3 * 720 = 2160 min
    expect(r.totalNetMin).toBe(2160);
    // avgDailyMin = 2160 / (workdayCount)
    // (Sadece pencerede kaç Werktag olduğunu kesin bilmiyoruz, ama Urlaub 2 gün eksik olmalı)
    const withoutUrlaub = calcRolling6MonthAvg(
      entries.filter(e => e.day_type !== "urlaub"),
      "2026-07-10",
    );
    expect(r.workdayCount).toBe(withoutUrlaub.workdayCount - 2);
  });

  it("Reference vor Startdatum → windowStart korrekt zurückgeschoben", () => {
    const r = calcRolling6MonthAvg([], "2026-07-15");
    expect(r.windowStart).toBe("2026-01-15");
    expect(r.windowEnd).toBe("2026-07-15");
  });

  it("Reference Januar → windowStart in Vorjahr", () => {
    const r = calcRolling6MonthAvg([], "2026-01-10");
    expect(r.windowStart).toBe("2025-07-10");
  });
});

describe("calcRuhezeitMinutes", () => {
  it("Vortag 22:00 (nicht overnight) → heute 09:00 = 11h", () => {
    // (24*60 - 22*60) + 9*60 = 120 + 540 = 660
    expect(calcRuhezeitMinutes("22:00", false, "09:00")).toBe(660);
  });
  it("Vortag 22:00 → heute 08:00 = 10h → Violation", () => {
    const r = calcRuhezeitMinutes("22:00", false, "08:00");
    expect(r).toBe(10 * 60);
    expect(isRuhezeitViolation(r)).toBe(true);
  });
  it("Vortag 17:00 → heute 08:00 = 15h → OK", () => {
    const r = calcRuhezeitMinutes("17:00", false, "08:00");
    expect(r).toBe(15 * 60);
    expect(isRuhezeitViolation(r)).toBe(false);
  });
  it("Vortag overnight endet 06:00 heute → heute 08:00 = 2h → Violation", () => {
    const r = calcRuhezeitMinutes("06:00", true, "08:00");
    expect(r).toBe(2 * 60);
    expect(isRuhezeitViolation(r)).toBe(true);
  });
  it("Vortag overnight endet 06:00 heute → heute 17:00 = 11h → OK Grenze", () => {
    const r = calcRuhezeitMinutes("06:00", true, "17:00");
    expect(r).toBe(11 * 60);
    expect(isRuhezeitViolation(r)).toBe(false);
  });
  it("Vortag overnight, aber heute start VOR prev end → 0 (Überschneidung)", () => {
    const r = calcRuhezeitMinutes("10:00", true, "08:00");
    expect(r).toBe(0);
    expect(isRuhezeitViolation(r)).toBe(true);
  });
});

describe("isRuhezeitViolation", () => {
  it("660 min = Grenze, kein Verstoß", () => {
    expect(isRuhezeitViolation(660)).toBe(false);
  });
  it("659 min = Verstoß", () => {
    expect(isRuhezeitViolation(659)).toBe(true);
  });
  it("0 min = Verstoß", () => {
    expect(isRuhezeitViolation(0)).toBe(true);
  });
});

describe("ARBZG_WEEKLY_MAX_MINUTES", () => {
  it("48h * 60 = 2880 min", () => {
    expect(ARBZG_WEEKLY_MAX_MINUTES).toBe(48 * 60);
  });
});

describe("calcWeeklyMinutes", () => {
  it("boş liste → boş sonuç", () => {
    expect(calcWeeklyMinutes([])).toEqual([]);
  });

  it("tek gün 8h → hafta = 480 min, kein Verstoß", () => {
    // 2026-01-05 (Montag) — KW 2026-W02
    const r = calcWeeklyMinutes([
      arbeiten("2026-01-05", "08:00", "17:00", 60), // 8h netto
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]?.isoWeek).toBe("2026-W02");
    expect(r[0]?.netMinutes).toBe(480);
    expect(r[0]?.isViolation).toBe(false);
  });

  it("5 gün × 10h = 50h → 48h aşımı, Verstoß", () => {
    // Mo-Fr 08:00-19:00 mit 60min Pause = 10h netto/gün
    const r = calcWeeklyMinutes([
      arbeiten("2026-01-05", "08:00", "19:00", 60),
      arbeiten("2026-01-06", "08:00", "19:00", 60),
      arbeiten("2026-01-07", "08:00", "19:00", 60),
      arbeiten("2026-01-08", "08:00", "19:00", 60),
      arbeiten("2026-01-09", "08:00", "19:00", 60),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]?.netMinutes).toBe(5 * 10 * 60); // 3000
    expect(r[0]?.isViolation).toBe(true);
  });

  it("Urlaub / Krank / Notdienst günleri hafta toplamına dahil edilmez", () => {
    const r = calcWeeklyMinutes([
      arbeiten("2026-01-05", "08:00", "17:00", 60), // 8h
      mkEntry({ date: "2026-01-06", day_type: "urlaub"    }),
      mkEntry({ date: "2026-01-07", day_type: "krank"     }),
      mkEntry({ date: "2026-01-08", day_type: "feiertag"  }),
      mkEntry({ date: "2026-01-09", day_type: "notdienst" }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]?.netMinutes).toBe(480); // Sadece arbeiten sayılır
  });

  it("cross-year edge — 30 Aralık 2025 (Salı, W01/2026)", () => {
    // ISO 2025 Aralık 29-31 → W01/2026 (Perşembe 1 Ocak 2026 → hafta 2026'ya bağlanır? Hayır: 1 Ocak 2026 Perşembe, W01/2026)
    // Bu bizim isoWeekOf implementasyonunu doğrular
    const r = calcWeeklyMinutes([
      arbeiten("2025-12-30", "08:00", "16:00", 0), // 8h
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]?.isoWeek).toBe("2026-W01");
  });

  it("iki farklı hafta → 2 ayrı entry", () => {
    const r = calcWeeklyMinutes([
      arbeiten("2026-01-05", "08:00", "16:00", 0), // W02
      arbeiten("2026-01-12", "08:00", "16:00", 0), // W03
    ]);
    expect(r).toHaveLength(2);
    expect(r[0]?.isoWeek).toBe("2026-W02");
    expect(r[1]?.isoWeek).toBe("2026-W03");
  });
});

describe("findWeeklyCapViolations", () => {
  it("sadece 48h aşan haftalar döner", () => {
    const v = findWeeklyCapViolations([
      arbeiten("2026-01-05", "08:00", "17:00", 60), // W02 = 8h, OK
      arbeiten("2026-01-12", "06:00", "22:00", 60), // W03 = 15h ARBEITEN violation but weekly
      arbeiten("2026-01-13", "06:00", "22:00", 60), // W03 += 15h = 30h, still not 48h
      arbeiten("2026-01-14", "06:00", "22:00", 60), // 45h
      arbeiten("2026-01-15", "06:00", "22:00", 60), // 60h ← violation
    ]);
    expect(v).toHaveLength(1);
    expect(v[0]?.isoWeek).toBe("2026-W03");
  });
});

describe("getMinRequiredBreak (§4 ArbZG)", () => {
  it("≤6h çalışma → 0 min mola gerekli değil", () => {
    expect(getMinRequiredBreak(0)).toBe(0);
    expect(getMinRequiredBreak(6 * 60)).toBe(0); // 6h tam sınır, aşılmadı
  });
  it("6h-9h arası → 30 min", () => {
    expect(getMinRequiredBreak(6 * 60 + 1)).toBe(30);
    expect(getMinRequiredBreak(8 * 60)).toBe(30);
    expect(getMinRequiredBreak(9 * 60)).toBe(30); // 9h tam sınır, aşılmadı
  });
  it(">9h → 45 min", () => {
    expect(getMinRequiredBreak(9 * 60 + 1)).toBe(45);
    expect(getMinRequiredBreak(10 * 60)).toBe(45);
    expect(getMinRequiredBreak(12 * 60)).toBe(45);
  });
});

describe("isPauseInsufficient", () => {
  it("5h çalışma + 0 mola → OK", () => {
    expect(isPauseInsufficient(5 * 60, 0)).toBe(false);
  });
  it("7h çalışma + 15 min mola → yetersiz (30 gerekli)", () => {
    expect(isPauseInsufficient(7 * 60, 15)).toBe(true);
  });
  it("7h çalışma + 30 min mola → OK", () => {
    expect(isPauseInsufficient(7 * 60, 30)).toBe(false);
  });
  it("10h çalışma + 30 min mola → yetersiz (45 gerekli)", () => {
    expect(isPauseInsufficient(10 * 60, 30)).toBe(true);
  });
  it("10h çalışma + 45 min mola → OK", () => {
    expect(isPauseInsufficient(10 * 60, 45)).toBe(false);
  });
});
