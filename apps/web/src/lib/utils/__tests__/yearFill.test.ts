// @vitest-environment node
import { describe, it, expect } from "vitest";
import { planYearFill } from "../yearFill";
import { DEFAULT_STANDARD_TIMES as STD } from "../standardTimes";
import { getFeiertage } from "../feiertage";

describe("planYearFill", () => {
  const rows = planYearFill({ year: 2027, feiertage: getFeiertage(2027, "NI"), std: STD });

  it("nur Mo–Fr ohne Feiertage, markiert als autofill", () => {
    expect(rows.some((r) => r.date === "2027-01-01")).toBe(false); // Neujahr
    expect(rows.some((r) => r.date === "2027-01-02")).toBe(false); // Samstag
    expect(rows[0]).toMatchObject({ date: "2027-01-04", day_type: "arbeiten", start_time: STD.monThuStart, tags: ["autofill"] });
    expect(rows.find((r) => r.date === "2027-01-08")).toMatchObject({ end_time: STD.friEnd, break_minutes: STD.friPause });
  });

  it("skip lässt Tage aus", () => {
    const skipped = planYearFill({ year: 2027, feiertage: {}, std: STD, skip: (d) => d < "2027-07-01" });
    expect(skipped[0]!.date).toBe("2027-07-01");
  });
});
