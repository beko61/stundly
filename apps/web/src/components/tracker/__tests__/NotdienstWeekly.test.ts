import { describe, it, expect } from "vitest";
import { buildNdWeeks } from "../NotdienstWeekly";

describe("buildNdWeeks — Notdienste je Kalenderwoche", () => {
  it("zählt Einsätze, Stunden und bezahlte pro KW, sortiert", () => {
    const nd = [
      { date: "2026-10-13", start_time: "18:00", end_time: "19:30", erledigt: true },  // KW 42
      { date: "2026-10-06", start_time: "22:00", end_time: "01:00" },                  // KW 41, über Mitternacht
      { date: "2026-10-12", start_time: "07:00", end_time: "08:00", erledigt: false }, // KW 42
    ];
    expect(buildNdWeeks(nd)).toEqual([
      { kw: 41, ndCount: 1, ndMins: 180, ndPaid: 0 },
      { kw: 42, ndCount: 2, ndMins: 150, ndPaid: 1 },
    ]);
  });

  it("Einträge ohne Uhrzeit werden ignoriert", () => {
    expect(buildNdWeeks([{ date: "2026-10-13", start_time: "", end_time: "" }])).toEqual([]);
  });
});
