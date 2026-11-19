// @vitest-environment node
import { describe, it, expect } from "vitest";
import { planYearFill, weekFromStandard } from "../yearFill";
import { DEFAULT_STANDARD_TIMES as STD } from "../standardTimes";
import { getFeiertage } from "../feiertage";

describe("planYearFill", () => {
  const rows = planYearFill({ year: 2027, feiertage: getFeiertage(2027, "NI"), week: weekFromStandard(STD) });

  it("Standardzeiten: Mo–Fr ohne Feiertage, Samstag frei, markiert als autofill", () => {
    expect(rows.some((r) => r.date === "2027-01-01")).toBe(false); // Neujahr
    expect(rows.some((r) => r.date === "2027-01-02")).toBe(false); // Samstag
    expect(rows[0]).toMatchObject({ date: "2027-01-04", day_type: "arbeiten", start_time: STD.monThuStart, tags: ["autofill"] });
    expect(rows.find((r) => r.date === "2027-01-08")).toMatchObject({ end_time: STD.friEnd, break_minutes: STD.friPause });
  });

  it("eigener Wochenplan mit Samstag, Sonntag nie", () => {
    const sat = { start: "08:00", end: "12:00", pause: 0 };
    const r = planYearFill({ year: 2027, feiertage: {}, week: { 6: sat } });
    expect(r[0]).toMatchObject({ date: "2027-01-02", start_time: "08:00", end_time: "12:00" });
    expect(r.every((x) => new Date(x.date + "T12:00:00").getDay() === 6)).toBe(true);
  });

  it("skip lässt Tage aus", () => {
    const skipped = planYearFill({ year: 2027, feiertage: {}, week: weekFromStandard(STD), skip: (d) => d < "2027-07-01" });
    expect(skipped[0]!.date).toBe("2027-07-01");
  });
});
