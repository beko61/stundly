import { describe, it, expect } from "vitest";
import { calcNettoFromBrutto } from "@workly/shared";
import { calcNotdienstNetto, type NotdienstNettoInput } from "../notdienstNetto";

const base: NotdienstNettoInput = {
  grundBrutto: 3200, pauschaleProWoche: 150, wochen: 2,
  steuerklasse: "I", kirchensteuer: 0, hatKinder: false, year: 2026,
};

const netto = (monthBrutto: number, steuerklasse: NotdienstNettoInput["steuerklasse"] = "I") =>
  calcNettoFromBrutto({ monthBrutto, steuerklasse, kirchensteuer: 0, hatKinder: false, taxMode: "auto", year: 2026 }).netto;

describe("calcNotdienstNetto", () => {
  it("Netto der Pauschale = Netto(Gehalt + Pauschale) − Netto(Gehalt)", () => {
    const r = calcNotdienstNetto(base);
    expect(r.notdienstBrutto).toBe(300);
    expect(r.notdienstNetto).toBeCloseTo(netto(3500) - netto(3200), 1);
    expect(r.abzug).toBeCloseTo(300 - r.notdienstNetto, 2);
    expect(r.notdienstNetto).toBeGreaterThan(0);
    expect(r.notdienstNetto).toBeLessThan(300);
  });

  it("Steuerklasse V behält weniger von der Pauschale als Steuerklasse III", () => {
    const v   = calcNotdienstNetto({ ...base, steuerklasse: "V" });
    const iii = calcNotdienstNetto({ ...base, steuerklasse: "III" });
    expect(v.notdienstNetto).toBeLessThan(iii.notdienstNetto);
  });

  it("leere/negative Eingaben zählen als 0", () => {
    const r = calcNotdienstNetto({ ...base, pauschaleProWoche: NaN, wochen: -1 });
    expect(r).toEqual({ notdienstBrutto: 0, notdienstNetto: 0, abzug: 0, abzugProzent: 0 });
  });
});
