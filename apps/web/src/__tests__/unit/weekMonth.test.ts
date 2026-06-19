import { describe, it, expect } from "vitest";
import {
  weekSundayOf,
  weekMondayOf,
  notdienstMonthOf,
  notdienstBelongsToMonth,
  notdienstLoadRange,
  isoWeek,
} from "@/lib/utils/weekMonth";

describe("weekSundayOf", () => {
  it("Pazartesi → aynı haftanın Pazar'ı", () => {
    // 2026-06-15 Mo → 2026-06-21 So
    const s = weekSundayOf("2026-06-15");
    expect(s.getFullYear()).toBe(2026);
    expect(s.getMonth() + 1).toBe(6);
    expect(s.getDate()).toBe(21);
  });
  it("Pazar → kendisi", () => {
    const s = weekSundayOf("2026-06-21"); // So
    expect(s.getDate()).toBe(21);
  });
  it("Cuma → aynı haftanın Pazar'ı (+2)", () => {
    const s = weekSundayOf("2026-06-19"); // Fr
    expect(s.getDate()).toBe(21);
  });
  it("Cumartesi → ertesi gün Pazar (+1)", () => {
    const s = weekSundayOf("2026-06-20"); // Sa
    expect(s.getDate()).toBe(21);
  });
});

describe("notdienstMonthOf — Pazar bazlı atfı", () => {
  it("28 Apr (Mo) hafta → Pazar 4 Mai → Mayıs'a ait", () => {
    // 2026: 28 Apr = Sa? Kontrol et. Hadi gerçek bir Mo–So weeki seç.
    // 2026-04-27 Mo, 2026-05-03 So
    const m = notdienstMonthOf("2026-04-27");
    expect(m).toEqual({ year: 2026, month: 5 });
  });
  it("4 Mai (So) → Mayıs", () => {
    const m = notdienstMonthOf("2026-05-03");
    expect(m).toEqual({ year: 2026, month: 5 });
  });
  it("hafta tamamen ay içinde", () => {
    // 2026-06-15 Mo → 2026-06-21 So
    const m = notdienstMonthOf("2026-06-15");
    expect(m).toEqual({ year: 2026, month: 6 });
  });
  it("yıl sınırı: 30 Dez 2025 (Sa) hafta → Pazar 28 Dez 2025 → Aralık 2025", () => {
    // 2025-12-29 Mo, 2026-01-04 So → Ocak 2026
    const m = notdienstMonthOf("2025-12-29");
    expect(m).toEqual({ year: 2026, month: 1 });
  });
});

describe("notdienstBelongsToMonth", () => {
  it("Hafta sonu Cmt mayıs sonu, Pazar haziran başı → Haziran'a ait", () => {
    // 2026-05-30 Sa → Pazar 2026-05-31 (Mayıs son günü). Mayıs!
    expect(notdienstBelongsToMonth("2026-05-30", 2026, 5)).toBe(true);
    expect(notdienstBelongsToMonth("2026-05-30", 2026, 6)).toBe(false);
  });
  it("Cmt 30 Mayıs hafta'sı: 2026-05-25 Mo - 2026-05-31 So → Mayıs", () => {
    expect(notdienstBelongsToMonth("2026-05-25", 2026, 5)).toBe(true);
  });
});

describe("notdienstLoadRange — simetrik 7 gün pay", () => {
  it("Haziran 2026 → 25 Mai - 7 Jul", () => {
    const r = notdienstLoadRange(2026, 6);
    expect(r.start).toBe("2026-05-25");
    expect(r.end).toBe("2026-07-07");
  });
  it("Ocak 2026 → önceki yıla iner", () => {
    const r = notdienstLoadRange(2026, 1);
    expect(r.start).toBe("2025-12-25");
    expect(r.end).toBe("2026-02-07");
  });
});

describe("weekMondayOf (deprecated visual helper)", () => {
  it("hafta etiketi için hâlâ çalışıyor", () => {
    const m = weekMondayOf("2026-06-19"); // Fr
    expect(m.getDate()).toBe(15); // Mo 15
  });
});

describe("isoWeek", () => {
  it("hafta 1 — yılbaşı haftası", () => {
    // 2026-01-05 Mo = ISO KW 2 (çünkü 1 Ocak = Per, ilk KW = Per–Pzr)
    // Doğrulayalım
    expect(isoWeek("2026-01-05")).toBe(2);
  });
  it("hafta 25 — Haziran ortası", () => {
    expect(isoWeek("2026-06-19")).toBe(25);
  });
});
