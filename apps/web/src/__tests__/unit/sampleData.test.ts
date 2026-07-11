import { describe, it, expect } from "vitest";
import { generateSampleData } from "@/lib/onboarding/sampleData";

describe("generateSampleData", () => {
  it("Haziran 2026 için ~20 arbeiten, 2 urlaub, 1 krank döner", () => {
    const { entries } = generateSampleData(2026, 6);
    const arbeiten = entries.filter((e) => e.day_type === "arbeiten").length;
    const urlaub   = entries.filter((e) => e.day_type === "urlaub").length;
    const krank    = entries.filter((e) => e.day_type === "krank").length;
    expect(arbeiten).toBeGreaterThanOrEqual(18);
    expect(arbeiten).toBeLessThanOrEqual(22);
    expect(urlaub).toBe(2);
    expect(krank).toBe(1);
  });

  it("Weekend günleri arbeiten olarak eklenmez (Sa/So)", () => {
    const { entries } = generateSampleData(2026, 6);
    for (const e of entries) {
      const dt = new Date(e.date);
      if (e.day_type === "arbeiten") {
        expect(dt.getDay()).not.toBe(0);
        expect(dt.getDay()).not.toBe(6);
      }
    }
  });

  it("Tüm entries `sample` tag'ıyla işaretli", () => {
    const { entries } = generateSampleData(2026, 6);
    for (const e of entries) {
      expect(e.tags).toContain("sample");
    }
  });

  it("Notdienst-Wochenende Fri+Sat, note 'Beispieldatensatz' içeriyor", () => {
    const { notdienst } = generateSampleData(2026, 6);
    expect(notdienst.length).toBeGreaterThanOrEqual(1);
    expect(notdienst.length).toBeLessThanOrEqual(2);
    for (const n of notdienst) {
      expect(n.note).toContain("Beispieldatensatz");
    }
    // İlk Notdienst Cuma olmalı
    const firstFriday = new Date(notdienst[0]!.date).getDay();
    expect(firstFriday).toBe(5);
  });

  it("Aynı ay için deterministic (aynı çağrı = aynı çıktı)", () => {
    const a = generateSampleData(2026, 6);
    const b = generateSampleData(2026, 6);
    expect(a.entries.map((e) => e.date)).toEqual(b.entries.map((e) => e.date));
    expect(a.notdienst).toEqual(b.notdienst);
  });

  it("Şubat (28 gün) için de doğru sayıda entry", () => {
    const { entries } = generateSampleData(2026, 2);
    const arbeiten = entries.filter((e) => e.day_type === "arbeiten").length;
    // Şubat 2026: 28 gün. Weekend hariç ~20 Werktag. Urlaub 2 + Krank 1 = 3 hariç.
    expect(arbeiten).toBeGreaterThanOrEqual(15);
    expect(arbeiten).toBeLessThanOrEqual(20);
  });

  it("Arbeiten entries `is_night_shift=false`, start/end doldurulmuş", () => {
    const { entries } = generateSampleData(2026, 6);
    for (const e of entries.filter((x) => x.day_type === "arbeiten")) {
      expect(e.is_night_shift).toBe(false);
      expect(e.start_time).toMatch(/^\d{2}:\d{2}$/);
      expect(e.end_time).toMatch(/^\d{2}:\d{2}$/);
      expect(e.break_minutes).toBeGreaterThanOrEqual(0);
    }
  });

  it("Urlaub/Krank entries start/end null", () => {
    const { entries } = generateSampleData(2026, 6);
    for (const e of entries.filter((x) => x.day_type === "urlaub" || x.day_type === "krank")) {
      expect(e.start_time).toBeNull();
      expect(e.end_time).toBeNull();
      expect(e.break_minutes).toBe(0);
    }
  });
});
