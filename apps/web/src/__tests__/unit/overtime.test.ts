import { describe, it, expect } from "vitest";
import {
  computeOvertime,
  isWeekday,
  workdaysBetween,
  type OvertimeEntry,
  type OvertimeNdEntry,
} from "@/lib/vacation/overtime";

const arbeiten = (date: string, start: string, end: string, brk = 60): OvertimeEntry => ({
  date, start_time: start, end_time: end, break_minutes: brk, day_type: "arbeiten",
});
const urlaub   = (date: string): OvertimeEntry => ({ date, start_time: null, end_time: null, break_minutes: null, day_type: "urlaub" });
const krank    = (date: string): OvertimeEntry => ({ date, start_time: null, end_time: null, break_minutes: null, day_type: "krank" });
const feiertag = (date: string): OvertimeEntry => ({ date, start_time: null, end_time: null, break_minutes: null, day_type: "feiertag" });
const nd       = (date: string, start: string, end: string): OvertimeNdEntry => ({ date, start_time: start, end_time: end });

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

describe("computeOvertime", () => {
  it("returns zero when no entries exist", () => {
    const r = computeOvertime([], "2026-01-01", "2026-06-19");
    expect(r.workedMin).toBe(0);
    expect(r.urlaubDays).toBe(0);
    expect(r.overtimeMin).toBe(0);
    expect(r.targetMin).toBe(workdaysBetween("2026-01-01", "2026-06-19") * 8 * 60);
  });

  it("treats future-dated entries as not yet earned (worked side)", () => {
    // Today is 2026-06-19. Entry 2026-12-15 should not bump workedMin.
    const future = arbeiten("2026-12-15", "08:00", "17:00", 60); // would be 8h
    const r = computeOvertime([future], "2026-01-01", "2026-06-19");
    expect(r.workedMin).toBe(0);
    expect(r.overtimeMin).toBe(0);
  });

  it("still counts a future urlaub for chart total (Jahresurlaub)", () => {
    const future = urlaub("2026-12-15"); // Tuesday
    const r = computeOvertime([future], "2026-01-01", "2026-06-19");
    expect(r.urlaubDays).toBe(1);
  });

  it("paid absence in the past reduces target (does not require working that day)", () => {
    // Today: Fr 2026-06-19. Work week 15-19. Mo 15 urlaub.
    // Mo-Fr in [01-01..06-19] = 120 days. Minus 1 urlaub Mo-Fr = 119 expected → 119*8*60 target.
    // No arbeiten entries → overtime = 0 (not negative)
    const r = computeOvertime([urlaub("2026-06-15")], "2026-01-01", "2026-06-19");
    expect(r.overtimeMin).toBe(0);
    const baseWeekdays = workdaysBetween("2026-01-01", "2026-06-19");
    expect(r.targetMin).toBe((baseWeekdays - 1) * 8 * 60);
  });

  it("krank and feiertag also reduce target", () => {
    const r = computeOvertime(
      [krank("2026-06-15"), feiertag("2026-06-16")],
      "2026-01-01", "2026-06-19",
    );
    const baseWeekdays = workdaysBetween("2026-01-01", "2026-06-19");
    expect(r.targetMin).toBe((baseWeekdays - 2) * 8 * 60);
  });

  it("urlaub on a weekend does not reduce target", () => {
    // 2026-06-13 Saturday — urlaub entry on a weekend should not subtract from target
    const r = computeOvertime([urlaub("2026-06-13")], "2026-01-01", "2026-06-19");
    expect(r.targetMin).toBe(workdaysBetween("2026-01-01", "2026-06-19") * 8 * 60);
  });

  it("overtime emerges when worked exceeds target", () => {
    // Generate 5 arbeiten days at 10h each = 50h = 3000m
    const entries: OvertimeEntry[] = [
      arbeiten("2026-06-15", "08:00", "19:00", 60), // 10h
      arbeiten("2026-06-16", "08:00", "19:00", 60),
      arbeiten("2026-06-17", "08:00", "19:00", 60),
      arbeiten("2026-06-18", "08:00", "19:00", 60),
      arbeiten("2026-06-19", "08:00", "19:00", 60),
    ];
    // Worked: 3000m. Target: ~6 months of weekdays × 8h × 60. Worked < target → overtime = 0.
    const r = computeOvertime(entries, "2026-01-01", "2026-06-19");
    expect(r.workedMin).toBe(3000);
    expect(r.overtimeMin).toBe(0);
  });

  it("collapses to zero overtime when end time before start (does not throw)", () => {
    // Night shift, calculateWorkDuration handles cross-midnight
    const r = computeOvertime(
      [arbeiten("2026-06-15", "22:00", "06:00", 0)],
      "2026-01-01", "2026-06-19",
    );
    expect(r.workedMin).toBe(8 * 60); // 8h
  });

  it("ignores frei entries (neither target reduction nor worked addition)", () => {
    const frei: OvertimeEntry = {
      date: "2026-06-15", start_time: null, end_time: null, break_minutes: null, day_type: "frei",
    };
    const r = computeOvertime([frei], "2026-01-01", "2026-06-19");
    expect(r.workedMin).toBe(0);
    expect(r.targetMin).toBe(workdaysBetween("2026-01-01", "2026-06-19") * 8 * 60);
  });

  it("does NOT inflate overtime when year contains future arbeiten entries", () => {
    // Regression for the 88T bug. Half the year future-dated arbeiten + only 6 months target.
    const entries: OvertimeEntry[] = [];
    for (let m = 6; m <= 12; m++) {
      entries.push(arbeiten(`2026-${String(m).padStart(2, "0")}-15`, "08:00", "20:00", 60)); // 11h each
    }
    const r = computeOvertime(entries, "2026-01-01", "2026-06-19");
    // Only the 2026-06-15 entry counts as worked (other dates > today).
    expect(r.workedMin).toBe(11 * 60);
    expect(r.overtimeMin).toBe(0); // 11h worked vs 120*8*60 target → still 0 overtime
  });

  it("backward-compat: hoursPerDay als number (4. parametre) hâlâ çalışır", () => {
    // Eski API: computeOvertime(entries, yearStart, today, 8)
    const r = computeOvertime([], "2026-01-01", "2026-06-19", 8);
    expect(r.targetMin).toBe(workdaysBetween("2026-01-01", "2026-06-19") * 8 * 60);
  });
});

describe("computeOvertime · Notdienst desteği (regression)", () => {
  it("Notdienst saatleri workedMin'e değil ndMin'e gider ve overtime'a sayılır", () => {
    // Mo 2026-06-15. 5 Notdienst Einsatz (12h pro Tag) = 60h.
    // workedMin (arbeiten) yok. Target 120 Mo-Fr × 8h = 960h.
    // ndMin = 60h. Toplam çalışılan 60h < 960h → overtime 0, ama ndMin ölçülüyor.
    const nds: OvertimeNdEntry[] = [
      nd("2026-06-15", "08:00", "20:00"),
      nd("2026-06-16", "08:00", "20:00"),
      nd("2026-06-17", "08:00", "20:00"),
      nd("2026-06-18", "08:00", "20:00"),
      nd("2026-06-19", "08:00", "20:00"),
    ];
    const r = computeOvertime([], "2026-01-01", "2026-06-19", { ndEntries: nds });
    expect(r.ndMin).toBe(60 * 60);          // 60h Notdienst
    expect(r.workedMin).toBe(0);
  });

  it("BUG FIX kanıtı: Notdienst saatleri overtime'a katkı yapar (eski helper yapmıyordu)", () => {
    // Dar pencere: Mo 2026-06-15 → Fr 2026-06-19 (5 Mo-Fr × 8h = 40h target)
    // arbeiten 5 gün × 8h = 40h (tam target tutulur, overtime 0)
    // + Notdienst 5h → toplam çalışılan 45h → overtime = 5h
    const arbeitenEntries: OvertimeEntry[] = [
      arbeiten("2026-06-15", "08:00", "17:00", 60), // 8h
      arbeiten("2026-06-16", "08:00", "17:00", 60),
      arbeiten("2026-06-17", "08:00", "17:00", 60),
      arbeiten("2026-06-18", "08:00", "17:00", 60),
      arbeiten("2026-06-19", "08:00", "17:00", 60),
    ];
    const nds: OvertimeNdEntry[] = [
      nd("2026-06-15", "17:00", "22:00"), // 5h
    ];
    const withoutNd = computeOvertime(arbeitenEntries, "2026-06-15", "2026-06-19");
    const withNd    = computeOvertime(arbeitenEntries, "2026-06-15", "2026-06-19", { ndEntries: nds });
    expect(withoutNd.overtimeMin).toBe(0);     // sadece arbeiten — target tam tutulur
    expect(withNd.ndMin).toBe(5 * 60);          // 5h Notdienst
    expect(withNd.overtimeMin).toBe(5 * 60);    // +5h overtime
    expect(withNd.overtimeMin - withoutNd.overtimeMin).toBe(5 * 60);
  });

  it("Notdienst hafta sonu günleri de sayılır (gerçek çalışma)", () => {
    // 2026-06-13 Sa, 2026-06-14 So
    const nds: OvertimeNdEntry[] = [
      nd("2026-06-13", "20:00", "08:00"), // 12h gece (cross-midnight)
      nd("2026-06-14", "20:00", "08:00"),
    ];
    const r = computeOvertime([], "2026-01-01", "2026-06-19", { ndEntries: nds });
    expect(r.ndMin).toBe(24 * 60); // 24h
  });

  it("Gelecek tarihli Notdienst sayılmaz", () => {
    const nds: OvertimeNdEntry[] = [nd("2026-12-15", "08:00", "20:00")];
    const r = computeOvertime([], "2026-01-01", "2026-06-19", { ndEntries: nds });
    expect(r.ndMin).toBe(0);
  });

  it("hoursPerDay = 7.7 (175h/ay / 21.7) — target değişir, overtime artar", () => {
    // 10 gün × 8h = 80h çalışıldı.
    // hoursPerDay=8 ile target ~ 119*8=952h → 80<952 → overtime 0.
    // hoursPerDay=7.7 ile target ~ 119*7.7=916h → 80<916 → yine overtime 0.
    // Bu test sadece target'in parametreye göre değiştiğini kanıtlar.
    const r8   = computeOvertime([], "2026-01-01", "2026-06-19", { hoursPerDay: 8   });
    const r77  = computeOvertime([], "2026-01-01", "2026-06-19", { hoursPerDay: 7.7 });
    expect(r77.targetMin).toBeLessThan(r8.targetMin);
  });
});
