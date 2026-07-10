import { describe, it, expect } from "vitest";
import {
  SFN_LST_CAP_PER_HOUR,
  SFN_SV_CAP_PER_HOUR,
  SFN_NIGHT_PERCENT,
  SFN_SONNTAG_PERCENT,
  SFN_FEIERTAG_PERCENT,
  classifyEntryMinutes,
  classifyEntryMinutesWithFeiertagMap,
  calcSfnZuschlag,
  calcMonthlySfn,
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

describe("§3b EStG constants", () => {
  it("Cap 50 €/h steuerfrei, 25 €/h sv-frei", () => {
    expect(SFN_LST_CAP_PER_HOUR).toBe(50);
    expect(SFN_SV_CAP_PER_HOUR).toBe(25);
  });
  it("Zuschlag-Prozente", () => {
    expect(SFN_NIGHT_PERCENT).toBe(25);
    expect(SFN_SONNTAG_PERCENT).toBe(50);
    expect(SFN_FEIERTAG_PERCENT).toBe(125);
  });
});

describe("classifyEntryMinutes — Kategorisierung", () => {
  it("Mo 08:00–17:00 → alles normal, keine SFN Minuten", () => {
    // 2026-01-05 = Mo
    const m = classifyEntryMinutes("2026-01-05", "08:00", "17:00", false, false);
    expect(m.night).toBe(0);
    expect(m.sonntag).toBe(0);
    expect(m.feiertag).toBe(0);
    expect(m.sonntagNight).toBe(0);
    expect(m.feiertagNight).toBe(0);
  });

  it("Mo 20:00–24:00 (kein overnight) → 4h Nacht", () => {
    // 2026-01-05 = Mo. 20:00-24:00 = 240 min alle Nacht
    // end 24:00 = "00:00" → parse 0 → treated as overnight? Let me use 23:59
    const m = classifyEntryMinutes("2026-01-05", "20:00", "23:59", false, false);
    // 20:00-23:59 = 239 min, alle Nacht (>= 20:00)
    expect(m.night).toBe(239);
  });

  it("Mo 22:00–06:00 overnight → 8h alle Nacht", () => {
    // 2026-01-05 22:00 → 2026-01-06 06:00 (both Mo/Di, kein Sonntag/Feiertag)
    const m = classifyEntryMinutes("2026-01-05", "22:00", "06:00", true, false);
    // Total = (24*60-22*60) + 6*60 = 120 + 360 = 480 min
    // Alle Minuten sind Nacht (22-24 + 00-06 alle in Nacht-Fenster)
    expect(m.night).toBe(480);
  });

  it("So 10:00–18:00 (Tag Sonntag) → 8h Sonntag", () => {
    // 2026-01-04 = So
    const m = classifyEntryMinutes("2026-01-04", "10:00", "18:00", false, false);
    expect(m.sonntag).toBe(8 * 60);
    expect(m.sonntagNight).toBe(0);
    expect(m.night).toBe(0);
  });

  it("So 22:00–24:00 → 2h Sonntag+Nacht", () => {
    // 2026-01-04 = So, 22:00-23:59 = 119 min Sonntag+Nacht
    const m = classifyEntryMinutes("2026-01-04", "22:00", "23:59", false, false);
    expect(m.sonntagNight).toBe(119);
    expect(m.sonntag).toBe(0);
  });

  it("Sa 22:00 → So 06:00 overnight → 2h Nacht + 6h Sonntag+Nacht", () => {
    // 2026-01-03 Sa 22:00, endet 2026-01-04 So 06:00
    const m = classifyEntryMinutes("2026-01-03", "22:00", "06:00", true, false);
    // Sa 22:00-24:00 = 120 min Nacht
    // So 00:00-06:00 = 360 min Sonntag+Nacht
    expect(m.night).toBe(120);
    expect(m.sonntagNight).toBe(360);
    expect(m.sonntag).toBe(0);
    expect(m.feiertag).toBe(0);
  });

  it("Feiertag 09:00–17:00 → 8h Feiertag", () => {
    // isFeiertag=true
    const m = classifyEntryMinutes("2026-01-01", "09:00", "17:00", false, true);
    expect(m.feiertag).toBe(8 * 60);
    expect(m.night).toBe(0);
  });

  it("Feiertag 22:00 → nächster Tag 06:00, aber wir sagen day2 kein Feiertag", () => {
    // 2026-01-01 Feiertag, 22:00 → 2026-01-02 06:00
    const m = classifyEntryMinutes("2026-01-01", "22:00", "06:00", true, true);
    // 01.01 22-24 = 120 min FeiertagNight
    // 02.01 00-06 = 360 min Night (nur, kein Feiertag day2)
    expect(m.feiertagNight).toBe(120);
    expect(m.night).toBe(360);
  });
});

describe("classifyEntryMinutesWithFeiertagMap", () => {
  it("Feiertag map Day2 → FeiertagNight für 00-06 Uhr", () => {
    // 2026-01-01 Feiertag (Neujahr Do), 2026-01-02 nicht Feiertag
    // Shift 2025-12-31 Mi 22:00 → 2026-01-01 06:00
    const feiertage = { "2026-01-01": "Neujahr" };
    const m = classifyEntryMinutesWithFeiertagMap(
      "2025-12-31", "22:00", "06:00", true, feiertage,
    );
    // 31.12 22-24 = 120 min Night (nicht Feiertag)
    // 01.01 00-06 = 360 min FeiertagNight
    expect(m.night).toBe(120);
    expect(m.feiertagNight).toBe(360);
  });

  it("Ohne Feiertag map → gleiche wie flat isFeiertag=false", () => {
    const m = classifyEntryMinutesWithFeiertagMap(
      "2026-01-05", "08:00", "17:00", false, {},
    );
    expect(m.night).toBe(0);
    expect(m.sonntag).toBe(0);
    expect(m.feiertag).toBe(0);
  });
});

describe("calcSfnZuschlag — Grundlohn cap", () => {
  it("Grundlohn 20 €/h, 1h Sonntag → 20*50% = 10 € Zuschlag, alles frei", () => {
    const r = calcSfnZuschlag(
      { night: 0, sonntag: 60, feiertag: 0, sonntagNight: 0, feiertagNight: 0 },
      20,
    );
    expect(r.totalZuschlag).toBeCloseTo(10, 5);
    expect(r.lstFrei).toBeCloseTo(10, 5);   // 20 < 50 cap
    expect(r.svFrei).toBeCloseTo(10, 5);    // 20 < 25 cap
  });

  it("Grundlohn 30 €/h, 1h Sonntag → Zuschlag 15, LSt-frei 15, SV-frei 12.50", () => {
    const r = calcSfnZuschlag(
      { night: 0, sonntag: 60, feiertag: 0, sonntagNight: 0, feiertagNight: 0 },
      30,
    );
    expect(r.totalZuschlag).toBeCloseTo(15, 5);
    expect(r.lstFrei).toBeCloseTo(15, 5);    // 30 < 50 cap → alles frei
    expect(r.svFrei).toBeCloseTo(12.5, 5);   // min(30, 25) * 50% = 12.5
  });

  it("Grundlohn 60 €/h, 1h Feiertag → Cap greift LSt AND SV", () => {
    const r = calcSfnZuschlag(
      { night: 0, sonntag: 0, feiertag: 60, sonntagNight: 0, feiertagNight: 0 },
      60,
    );
    // Total: 60 * 125% = 75 €
    // LSt-frei: min(60,50) * 125% = 62.50
    // SV-frei:  min(60,25) * 125% = 31.25
    expect(r.totalZuschlag).toBeCloseTo(75, 5);
    expect(r.lstFrei).toBeCloseTo(62.5, 5);
    expect(r.svFrei).toBeCloseTo(31.25, 5);
  });

  it("Sonntag+Nacht additiv → 75%", () => {
    const r = calcSfnZuschlag(
      { night: 0, sonntag: 0, feiertag: 0, sonntagNight: 60, feiertagNight: 0 },
      20,
    );
    expect(r.totalZuschlag).toBeCloseTo(20 * 0.75, 5); // 15
  });

  it("Feiertag+Nacht additiv → 150%", () => {
    const r = calcSfnZuschlag(
      { night: 0, sonntag: 0, feiertag: 0, sonntagNight: 0, feiertagNight: 60 },
      20,
    );
    expect(r.totalZuschlag).toBeCloseTo(20 * 1.5, 5); // 30
  });

  it("Alle Kategorien mixed → korrekt aufsummiert", () => {
    const r = calcSfnZuschlag(
      { night: 60, sonntag: 60, feiertag: 60, sonntagNight: 60, feiertagNight: 60 },
      20,
    );
    // 20 × (0.25 + 0.50 + 1.25 + 0.75 + 1.50) = 20 × 4.25 = 85
    expect(r.totalZuschlag).toBeCloseTo(85, 5);
  });

  it("Leer → 0", () => {
    const r = calcSfnZuschlag(
      { night: 0, sonntag: 0, feiertag: 0, sonntagNight: 0, feiertagNight: 0 },
      50,
    );
    expect(r.totalZuschlag).toBe(0);
    expect(r.lstFrei).toBe(0);
    expect(r.svFrei).toBe(0);
  });
});

describe("calcMonthlySfn — Integration", () => {
  it("Nur ARBEITEN Einträge werden gezählt", () => {
    const entries = [
      mkEntry({ date: "2026-01-04", start_time: "10:00", end_time: "18:00", day_type: "arbeiten" }), // So
      mkEntry({ date: "2026-01-05", start_time: "08:00", end_time: "17:00", day_type: "urlaub" }),    // Mo Urlaub — ignore
    ];
    const r = calcMonthlySfn(entries, {}, 20);
    // Sonntag 10-18 = 480 min * 20/60 * 0.5 = 8 * 20 * 0.5 = 80
    expect(r.totalZuschlag).toBeCloseTo(80, 5);
  });

  it("Feiertag map aus tracker page → Feiertag-Minuten zählen", () => {
    const feiertage = { "2026-01-01": "Neujahr" };
    const entries = [
      mkEntry({ date: "2026-01-01", start_time: "09:00", end_time: "17:00", day_type: "arbeiten" }),
    ];
    const r = calcMonthlySfn(entries, feiertage, 20);
    // 8h Feiertag × 125% × 20 = 20 * 8 * 1.25 = 200
    expect(r.totalZuschlag).toBeCloseTo(200, 5);
  });

  it("Leerer Monat → 0", () => {
    const r = calcMonthlySfn([], {}, 20);
    expect(r.totalZuschlag).toBe(0);
  });
});
