import { describe, it, expect } from "vitest";
import { buildNdWeeks } from "../NotdienstWeekly";

const arbeit = (date: string, start: string, end: string, pause: number) =>
  ({ date, day_type: "arbeiten", start_time: start, end_time: end, break_minutes: pause });

describe("buildNdWeeks — Überstunden je Notdienst-Woche", () => {
  it("Urlaubstag zählt 8h wie in der Monatsübersicht (KW 42/2026: Do Urlaub)", () => {
    const entries = [
      arbeit("2026-10-12", "07:45", "17:00", 60), // 8h 15m
      arbeit("2026-10-13", "07:45", "17:00", 60),
      arbeit("2026-10-14", "07:45", "17:00", 60),
      { date: "2026-10-15", day_type: "urlaub", start_time: null, end_time: null, break_minutes: 0 },
      arbeit("2026-10-16", "07:45", "14:30", 30), // 6h 15m
    ];
    const nd = [{ date: "2026-10-12", start_time: "18:00", end_time: "19:00" }];
    const [w] = buildNdWeeks(entries, nd);
    expect(w!.kw).toBe(42);
    expect(w!.sollMins).toBe(40 * 60);
    expect(w!.workedMins).toBe(3 * 495 + 480 + 375); // 39h — früher fehlte der Urlaubstag (31h)
    expect(w!.ndMins).toBe(60);
  });

  it("gesetzlicher Feiertag ohne Eintrag zählt 8h", () => {
    const entries = ["2026-04-27", "2026-04-28", "2026-04-29", "2026-04-30"].map(d => arbeit(d, "08:00", "16:30", 30));
    const nd = [{ date: "2026-04-30", start_time: "20:00", end_time: "21:00" }];
    const [w] = buildNdWeeks(entries, nd, { "2026-05-01": "Tag der Arbeit" });
    expect(w!.workedMins).toBe(40 * 60);
    expect(w!.workedMins - w!.sollMins + w!.ndMins).toBe(60);
  });
});
