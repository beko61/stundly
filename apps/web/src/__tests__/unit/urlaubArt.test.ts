import { describe, it, expect } from "vitest";
import type { TimeEntry } from "@workly/shared";
import { urlaubEntryFor, gehoertZuAntrag, zaehltZumUrlaubskonto, entfaelltSoll } from "@/lib/vacation/urlaubArt";
import { urlaubskontoFor } from "@/lib/vacation/urlaubskonto";
import { notdienstDaysForBilling, hasHourlyRate } from "@/lib/salary/settings";
import { calcMonthStats } from "@/lib/utils/monthStats";

function mk(date: string, day_type: string, tags: string[] | null = null, start: string | null = null, end: string | null = null): TimeEntry {
  return {
    id: `e-${date}`, user_id: "u", date, day_type, tags,
    start_time: start, end_time: end, break_minutes: start ? 60 : 0,
    is_night_shift: false, note: null,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  } as TimeEntry;
}

describe("urlaubEntryFor — Urlaubsart → Tageseintrag", () => {
  it("Erholungsurlaub: urlaub ohne Tag", () => {
    expect(urlaubEntryFor("Erholungsurlaub")).toEqual({ day_type: "urlaub", tags: [] });
  });
  it("Sonder-/Bildungsurlaub: urlaub + Tag, nicht vom Konto", () => {
    const e = urlaubEntryFor("Sonderurlaub");
    expect(e.day_type).toBe("urlaub");
    expect(zaehltZumUrlaubskonto(e)).toBe(false);
    expect(zaehltZumUrlaubskonto(urlaubEntryFor("Bildungsurlaub"))).toBe(false);
    expect(zaehltZumUrlaubskonto(urlaubEntryFor("Erholungsurlaub"))).toBe(true);
  });
  it("Unbezahlt/Elternzeit: frei, Soll entfällt; Überstundenabbau: frei, Soll bleibt", () => {
    expect(entfaelltSoll(urlaubEntryFor("Unbezahlter Urlaub"))).toBe(true);
    expect(entfaelltSoll(urlaubEntryFor("Elternzeit"))).toBe(true);
    const abbau = urlaubEntryFor("Überstundenabbau");
    expect(abbau.day_type).toBe("frei");
    expect(entfaelltSoll(abbau)).toBe(false);
  });
});

describe("gehoertZuAntrag — Antrag löschen entfernt nur seine Einträge", () => {
  it("passende Art und alte Einträge (urlaub ohne Tag) gehören dazu", () => {
    expect(gehoertZuAntrag(mk("2026-06-15", "frei", ["unbezahlt"]), "Unbezahlter Urlaub")).toBe(true);
    expect(gehoertZuAntrag(mk("2026-06-15", "urlaub", []), "Unbezahlter Urlaub")).toBe(true);
  });
  it("normales frei ohne Tag oder andere Art gehört nicht dazu", () => {
    expect(gehoertZuAntrag(mk("2026-06-15", "frei", []), "Überstundenabbau")).toBe(false);
    expect(gehoertZuAntrag(mk("2026-06-15", "frei", ["elternzeit"]), "Unbezahlter Urlaub")).toBe(false);
  });
});

describe("calcMonthStats — Urlaubsarten", () => {
  it("Unbezahlter Urlaub: kein Minus (Soll entfällt), keine Gutschrift", () => {
    // Juni 2026, 174 h Soll; 1 Tag unbezahlt (Mo 15.06.) → Soll −8 h
    const r = calcMonthStats({
      entries: [mk("2026-06-15", "frei", ["unbezahlt"])],
      year: 2026, month: 6, targetHoursPerMonth: 174,
    });
    expect(r.sollEntfallenMin).toBe(8 * 60);
    expect(r.targetMin).toBe(174 * 60 - 8 * 60);
    expect(r.workedMin).toBe(0);
  });
  it("Sonderurlaub zählt als Urlaubstag, aber nicht fürs Konto", () => {
    const r = calcMonthStats({
      entries: [mk("2026-06-15", "urlaub", ["sonderurlaub"]), mk("2026-06-16", "urlaub", [])],
      year: 2026, month: 6, targetHoursPerMonth: 174,
    });
    expect(r.urlaubDays).toBe(2);
    expect(r.urlaubKontoDays).toBe(1);
  });
});

describe("urlaubskontoFor — eine Zahl für alle Seiten", () => {
  const entries = [
    mk("2026-06-15", "urlaub"),                    // Mo — zählt
    mk("2026-06-16", "urlaub", ["sonderurlaub"]),  // zählt nicht
    mk("2026-06-20", "urlaub"),                    // Sa — zählt nicht
    mk("2025-12-30", "urlaub"),                    // anderes Jahr — zählt nicht
  ];
  it("zählt nur Erholungsurlaub Mo–Fr im Jahr", () => {
    const r = urlaubskontoFor({ settings: { urlaub_anspruch: 30 }, yearEntries: entries, year: 2026, todayISO: "2026-06-30" });
    expect(r.usedThisYear).toBe(1);
    expect(r.konto.remaining).toBe(29);
  });
  it("Zwölftelung bei Eintritt im Jahr + Übertrag bis 31.03.", () => {
    const r = urlaubskontoFor({
      settings: { urlaub_anspruch: "24", employment_start_date: "2026-07-01", urlaub_carry_over: 5 },
      yearEntries: [], year: 2026, todayISO: "2026-02-01",
    });
    expect(r.entitlement.anspruch).toBe(12);       // 6/12 von 24
    expect(r.konto.totalEntitlement).toBe(17);     // + 5 Übertrag (vor 31.03.)
  });
  it("Firmenvertrag hat Vorrang", () => {
    const r = urlaubskontoFor({
      settings: { urlaub_anspruch: 30 }, yearEntries: [], year: 2026, todayISO: "2026-06-30",
      contract: { vacation_days: 28, start_date: null },
    });
    expect(r.konto.totalEntitlement).toBe(28);
  });
});

describe("Gehalt: Notdienst des Vormonats, Lohn eingetragen?", () => {
  it("Januar rechnet die Dezember-Notdienste des Vorjahres ab", () => {
    const dates = ["2025-12-28", "2025-12-29", "2026-01-05", "2026-02-02"];
    expect(notdienstDaysForBilling(dates, 2026, 1)).toBe(2);
    expect(notdienstDaysForBilling(dates, 2026, 2)).toBe(1);
  });
  it("ohne Zeile oder mit 0 €/h: kein Lohn", () => {
    expect(hasHourlyRate(null)).toBe(false);
    expect(hasHourlyRate({ hourly_rate: 0 } as never)).toBe(false);
    expect(hasHourlyRate({ hourly_rate: "17.5" } as never)).toBe(true);
  });
});
