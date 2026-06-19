import { describe, it, expect } from "vitest";
import { calcMonthStats, countWorkDays } from "@/lib/utils/monthStats";
import type { TimeEntry } from "@workly/shared";

const TARGET = 174;

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
    tags:           p.tags ?? null,
    day_type:       p.day_type ?? "arbeiten",
    created_at:     p.created_at ?? "2026-01-01T00:00:00Z",
    updated_at:     p.updated_at ?? "2026-01-01T00:00:00Z",
  } as TimeEntry;
}

const arbeiten = (date: string, start = "08:00", end = "17:00", brk = 60): TimeEntry =>
  mkEntry({ date, start_time: start, end_time: end, break_minutes: brk, day_type: "arbeiten" });
const urlaub   = (date: string): TimeEntry => mkEntry({ date, day_type: "urlaub" });
const krank    = (date: string): TimeEntry => mkEntry({ date, day_type: "krank" });
const feiertag = (date: string): TimeEntry => mkEntry({ date, day_type: "feiertag" });

describe("countWorkDays", () => {
  it("month: Mo-Fr in Juni 2026 ohne Feiertag", () => {
    // Juni 2026: 30 gün. Cumartesi/Pazar dışında. Manuel say: 22.
    expect(countWorkDays(2026, 6, {})).toBe(22);
  });
  it("month: Feiertag düşürülür", () => {
    // 2026-06-15 Pfingsten kabul edelim — Mo, weekend olmayan günde
    const feiertage = { "2026-06-15": "Pfingstmontag" };
    expect(countWorkDays(2026, 6, feiertage)).toBe(21);
  });
  it("year: 2026 toplam Mo-Fr (Feiertag yok) = 261", () => {
    // 2026: 365 gün, 1 Ocak Perşembe. Çıkışı kontrol et.
    expect(countWorkDays(2026, null, {})).toBe(261);
  });
  it("year + todayISO: sadece bugüne kadar Mo-Fr", () => {
    // Jan 1 .. Jun 19 2026 inclusive — manuel hesap, feiertag yok
    const result = countWorkDays(2026, null, {}, "2026-06-19");
    // 122 weekday Jan 1..Jun 19 2026 — overtime testimizde de doğrulamıştık
    expect(result).toBe(122);
  });
  it("year + todayISO: ileri tarihli Feiertag sayılmaz", () => {
    const feiertage = { "2026-12-25": "Weihnachten" };
    // Aralık Feiertag haziran sonu görünmemeli → countWorkDays haziran sonuna kadar değişmez
    expect(countWorkDays(2026, null, feiertage, "2026-06-19")).toBe(122);
  });
});

describe("calcMonthStats: month mode (legacy)", () => {
  it("tek ay 5 arbeiten günü 8h", () => {
    const entries = [
      arbeiten("2026-06-15"), arbeiten("2026-06-16"), arbeiten("2026-06-17"),
      arbeiten("2026-06-18"), arbeiten("2026-06-19"),
    ];
    const r = calcMonthStats({ entries, feiertage: {}, year: 2026, month: 6, targetHoursPerMonth: TARGET });
    expect(r.workedMin).toBe(5 * 8 * 60); // 2400m = 40h
    expect(r.targetMin).toBe(TARGET * 60); // 10440m
    expect(r.diffMin).toBe(2400 - 10440);
    expect(r.arbeitenEntries).toBe(5);
  });

  it("Urlaub bezahlt 8h, Krank bezahlt 8h", () => {
    const r = calcMonthStats({
      entries: [urlaub("2026-06-15"), krank("2026-06-16")],
      feiertage: {}, year: 2026, month: 6, targetHoursPerMonth: TARGET,
    });
    expect(r.urlaubDays).toBe(1);
    expect(r.krankDays).toBe(1);
    expect(r.workedMin).toBe(2 * 8 * 60);
  });

  it("Auto-Feiertag: DB'de entry yoksa feiertag map'inden gelir", () => {
    const r = calcMonthStats({
      entries: [], feiertage: { "2026-06-15": "Test-Feiertag" },
      year: 2026, month: 6, targetHoursPerMonth: TARGET,
    });
    expect(r.feiertagDays).toBe(1);
    expect(r.workedMin).toBe(8 * 60);
  });

  it("Hafta sonu urlaub 0h (Sollstunden 0)", () => {
    // 2026-06-13 Sa
    const r = calcMonthStats({
      entries: [urlaub("2026-06-13")], feiertage: {}, year: 2026, month: 6, targetHoursPerMonth: TARGET,
    });
    expect(r.workedMin).toBe(0);
    expect(r.urlaubDays).toBe(1); // gün sayısı sayılır, ama 0h çünkü weekend
  });
});

describe("calcMonthStats: year mode without todayISO (legacy / Jahresende)", () => {
  it("12 ay hedefi: TARGET × 12 × 60", () => {
    const r = calcMonthStats({
      entries: [], feiertage: {},
      year: 2026, month: null, targetHoursPerMonth: TARGET,
    });
    expect(r.targetMin).toBe(TARGET * 12 * 60);
    expect(r.workedMin).toBe(0);
    expect(r.diffMin).toBe(0 - r.targetMin);
  });

  it("yıl tamamı feiertage workedMin'e auto eklenir", () => {
    const feiertage = { "2026-12-25": "Weihnachten", "2026-01-01": "Neujahr" };
    const r = calcMonthStats({
      entries: [], feiertage,
      year: 2026, month: null, targetHoursPerMonth: TARGET,
    });
    // 01-01 Donnerstag, 12-25 Freitag — ikisi de weekday
    expect(r.feiertagDays).toBe(2);
    expect(r.workedMin).toBe(2 * 8 * 60);
  });
});

describe("calcMonthStats: year mode WITH todayISO (YTD)", () => {
  const today = "2026-06-19";

  it("hedef = bugüne kadar Mo-Fr × 8h (122 gün)", () => {
    const r = calcMonthStats({
      entries: [], feiertage: {},
      year: 2026, month: null, targetHoursPerMonth: TARGET,
      todayISO: today,
    });
    expect(r.targetMin).toBe(122 * 8 * 60);
    expect(r.workedMin).toBe(0);
  });

  it("gelecek tarihli arbeiten workedMin'e dahil değil", () => {
    const r = calcMonthStats({
      entries: [
        arbeiten("2026-03-15"),                            // geçmiş → 8h sayılır
        arbeiten("2026-09-15", "08:00", "20:00", 60),      // gelecek → sayılmaz
      ],
      feiertage: {},
      year: 2026, month: null, targetHoursPerMonth: TARGET,
      todayISO: today,
    });
    expect(r.workedMin).toBe(8 * 60);   // sadece Mart
    expect(r.arbeitenEntries).toBe(1);
  });

  it("gelecek tarihli urlaub urlaubDays'e dahil değil (YTD anlamı)", () => {
    const r = calcMonthStats({
      entries: [urlaub("2026-04-10"), urlaub("2026-09-15")],
      feiertage: {},
      year: 2026, month: null, targetHoursPerMonth: TARGET,
      todayISO: today,
    });
    expect(r.urlaubDays).toBe(1); // Sadece Nisan
  });

  it("gelecek tarihli auto-feiertag sayılmaz", () => {
    const feiertage = {
      "2026-01-01": "Neujahr",       // geçmiş, weekday → +8h
      "2026-12-25": "Weihnachten",   // gelecek → 0
    };
    const r = calcMonthStats({
      entries: [], feiertage,
      year: 2026, month: null, targetHoursPerMonth: TARGET,
      todayISO: today,
    });
    expect(r.feiertagDays).toBe(1);
    expect(r.workedMin).toBe(8 * 60);
  });

  it("regresyon: workedMin yıl boyunca, target 6 ay → ezberden büyük diff bug'ı YOK", () => {
    // Eski bug: tüm yıl arbeiten saatleri var, hedef 12 ay × 174 sabit.
    // Yeni davranış: gelecek arbeiten hesaplanmaz, hedef todayISO'ya kadar.
    const entries: TimeEntry[] = [];
    for (let month = 1; month <= 12; month++) {
      // Her ayın 15'i için 11 saat arbeiten
      entries.push(arbeiten(`2026-${String(month).padStart(2, "0")}-15`, "08:00", "20:00", 60));
    }
    const r = calcMonthStats({
      entries, feiertage: {},
      year: 2026, month: null, targetHoursPerMonth: TARGET,
      todayISO: today,
    });
    // Sadece Jan-Jun 15'leri (6 entry) × 11h = 66h = 3960m
    expect(r.workedMin).toBe(6 * 11 * 60);
    expect(r.arbeitenEntries).toBe(6);
    expect(r.targetMin).toBe(122 * 8 * 60); // YTD target
  });

  it("diffMin doğru işaret (worked < target → negatif)", () => {
    const r = calcMonthStats({
      entries: [arbeiten("2026-06-15"), arbeiten("2026-06-16")], // 16h
      feiertage: {},
      year: 2026, month: null, targetHoursPerMonth: TARGET,
      todayISO: today,
    });
    expect(r.diffMin).toBeLessThan(0);
    expect(r.diffMin).toBe(16 * 60 - 122 * 8 * 60);
  });

  it("ndEntries gelecek tarihli sayılmaz", () => {
    const r = calcMonthStats({
      entries: [],
      ndEntries: [
        { date: "2026-03-10", start_time: "18:00", end_time: "22:00", erledigt: true },  // 4h, geçmiş
        { date: "2026-09-10", start_time: "18:00", end_time: "22:00", erledigt: false }, // 4h, gelecek
      ],
      feiertage: {},
      year: 2026, month: null, targetHoursPerMonth: TARGET,
      todayISO: today,
    });
    expect(r.ndCount).toBe(1);
    expect(r.ndMin).toBe(4 * 60);
  });
});

describe("calcMonthStats: todayISO month mode'da yok sayılır", () => {
  it("month != null → todayISO görmezden gelinir", () => {
    const r = calcMonthStats({
      entries: [arbeiten("2026-06-25")], // todayISO sonrası ama month=6
      feiertage: {}, year: 2026, month: 6, targetHoursPerMonth: TARGET,
      todayISO: "2026-06-19",
    });
    expect(r.arbeitenEntries).toBe(1);
    expect(r.workedMin).toBe(8 * 60);
  });
});
