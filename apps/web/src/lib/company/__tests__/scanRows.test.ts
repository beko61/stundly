import { describe, it, expect } from "vitest";
import { toRows, weekHint, mondayOf } from "../scanRows";

const team = [{ user_id: "u1", full_name: "Max Müller" }, { user_id: "u2", full_name: "Ayşe Yılmaz" }];

describe("toRows (KI-Antwort Firma → Tabelle)", () => {
  it("flache Zeilen, Mitarbeiter-Vorschlag, Typen, Zeitformat", () => {
    const rows = toRows({ personen: [
      { name: "Müller", tage: [["2026-11-03", "7:00", "15:30", 30, "A"], ["2026-11-04", "", "", 0, "U"]] },
      { name: "A. Yilmaz", tage: [["2026-11-03", "06:00", "14:00", 45.4, "a"]] },
      { name: "Unbekannt Person", tage: [["2026-11-03", "08:00", "16:00", 0, "K"]] },
    ] }, team);
    expect(rows).toEqual([
      { name: "Müller", userId: "u1", date: "2026-11-03", day_type: "arbeiten", start_time: "07:00", end_time: "15:30", break_minutes: 30 },
      { name: "Müller", userId: "u1", date: "2026-11-04", day_type: "urlaub", start_time: null, end_time: null, break_minutes: 0 },
      { name: "A. Yilmaz", userId: "u2", date: "2026-11-03", day_type: "arbeiten", start_time: "06:00", end_time: "14:00", break_minutes: 45 },
      { name: "Unbekannt Person", userId: null, date: "2026-11-03", day_type: "krank", start_time: null, end_time: null, break_minutes: 0 },
    ]);
  });

  it("verwirft Arbeitstage ohne Zeiten, kaputte Daten → leeres Datum, Unsinn → []", () => {
    const rows = toRows({ personen: [{ name: "Max Müller", tage: [["2026-11-05", "", "", 0, "A"], ["5.11.", "07:00", "15:00"]] }] }, team);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: "", start_time: "07:00", break_minutes: 0 });
    expect(toRows(null, team)).toEqual([]);
    expect(toRows({ personen: "x" }, team)).toEqual([]);
  });
});

describe("weekHint (Wochenliste: Wochentag → Datum)", () => {
  it("beliebiger Tag der Woche → Montag + feste Daten Mo–So, auch über Monatsgrenze", () => {
    const h = weekHint("2026-11-04")!; // Mittwoch
    expect(h).toContain("Woche ab Montag 2026-11-02");
    expect(h).toContain("Mo=2026-11-02");
    expect(h).toContain("Fr=2026-11-06");
    expect(h).toContain("So=2026-11-08");
    expect(weekHint("2026-11-30")).toContain("Do=2026-12-03");
  });
  it("ungültig → null", () => {
    expect(weekHint("")).toBeNull();
    expect(weekHint("2026-02-31")).toBeNull();
  });
  it("mondayOf", () => {
    expect(mondayOf(new Date(2026, 10, 8))).toBe("2026-11-02"); // Sonntag
    expect(mondayOf(new Date(2026, 10, 9))).toBe("2026-11-09"); // Montag
  });
});
