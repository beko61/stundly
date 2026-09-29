import { describe, it, expect } from "vitest";
import { checkMonth, type CheckEntry } from "@/lib/company/monthCheck";

const arb = (date: string, start: string, end: string, pause = 30, tags: string[] = []): CheckEntry =>
  ({ date, day_type: "arbeiten", start_time: `${start}:00`, end_time: `${end}:00`, break_minutes: pause, tags });

// September 2026: 1. = Dienstag. "Heute" = 03.09. → nur 01. + 02. sind Vergangenheit
const base = { year: 2026, month: 9, feiertage: {}, todayISO: "2026-09-03", ndEntries: [] };
const kinds = (f: ReturnType<typeof checkMonth>) => f.map((x) => `${x.kind}@${x.date}`);

describe("checkMonth", () => {
  it("sauberer Monat → keine Auffälligkeiten", () => {
    const f = checkMonth({ ...base, entries: [arb("2026-09-01", "07:00", "16:00", 60), arb("2026-09-02", "07:00", "15:30", 30)] });
    expect(f).toEqual([]);
  });

  it("§3 ArbZG: mehr als 10 h netto", () => {
    const f = checkMonth({ ...base, entries: [arb("2026-09-01", "06:00", "18:00", 60), arb("2026-09-02", "07:00", "15:00")] });
    expect(kinds(f)).toEqual(["over10h@2026-09-01"]);
  });

  it("§4 ArbZG: > 6 h ohne 30 min, > 9 h ohne 45 min Pause", () => {
    const f = checkMonth({ ...base, entries: [arb("2026-09-01", "07:00", "14:00", 15), arb("2026-09-02", "07:00", "17:00", 30)] });
    expect(kinds(f)).toEqual(["pause@2026-09-01", "pause@2026-09-02"]);
    expect(f[1]!.text).toMatch(/mind\. 45/);
  });

  it("§5 ArbZG: Ruhezeit nach spätem Notdienst", () => {
    const f = checkMonth({
      ...base,
      entries: [arb("2026-09-01", "07:00", "15:00"), arb("2026-09-02", "07:00", "15:00")],
      ndEntries: [{ date: "2026-09-01", start_time: "22:30:00", end_time: "23:40:00" }],
    });
    expect(kinds(f)).toEqual(["ruhezeit@2026-09-02"]);
    expect(f[0]!.text).toMatch(/7h 20m Ruhe nach Notdienst-Ende/);
  });

  it("Ruhezeit: Notdienst über Mitternacht zählt am Folgetag", () => {
    const f = checkMonth({
      ...base,
      entries: [arb("2026-09-02", "06:00", "14:00")],
      ndEntries: [{ date: "2026-09-01", start_time: "23:00:00", end_time: "01:30:00" }],
    });
    expect(kinds(f)).toContain("ruhezeit@2026-09-02");
  });

  it("Ruhezeit am 1. prüft den Vortag (Vormonat)", () => {
    const f = checkMonth({
      ...base,
      entries: [arb("2026-08-31", "12:00", "22:00", 60), arb("2026-09-01", "06:00", "14:00"), arb("2026-09-02", "07:00", "15:00")],
    });
    expect(kinds(f)).toEqual(["ruhezeit@2026-09-01"]);
  });

  it("fehlende Werktage nur in der Vergangenheit, ohne Feiertage und vor Beschäftigungsbeginn", () => {
    expect(kinds(checkMonth({ ...base, entries: [] }))).toEqual(["missing@2026-09-01", "missing@2026-09-02"]);
    expect(checkMonth({ ...base, entries: [], feiertage: { "2026-09-01": "Test" } }).map((x) => x.date)).toEqual(["2026-09-02"]);
    expect(checkMonth({ ...base, entries: [], startDate: "2026-09-02" }).map((x) => x.date)).toEqual(["2026-09-02"]);
  });

  it("automatisch befüllte Tage → eine Sammelmeldung", () => {
    const f = checkMonth({
      ...base,
      entries: [arb("2026-09-01", "07:00", "16:00", 60, ["autofill"]), arb("2026-09-02", "07:00", "16:00", 60, ["autofill"])],
    });
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ kind: "autofill", date: "2026-09-01" });
    expect(f[0]!.text).toMatch(/2 Tage automatisch/);
  });

  it("Urlaub/Krank zählen als eingetragen", () => {
    const f = checkMonth({
      ...base,
      entries: [
        { date: "2026-09-01", day_type: "urlaub", start_time: null, end_time: null, break_minutes: 0 },
        { date: "2026-09-02", day_type: "krank",  start_time: null, end_time: null, break_minutes: 0 },
      ],
    });
    expect(f).toEqual([]);
  });
});
