import { describe, it, expect } from "vitest";
import { calcRufbereitschaft, type RufInput } from "../rufbereitschaft";

const woche: RufInput = {
  stundenlohn: 20, modell: "stunden", tageWerktag: 5, tageWochenende: 2,
  faktorWerktag: 2, faktorWochenende: 4, euroWerktag: 30, euroWochenende: 60, einsatzMinuten: 360,
};

describe("calcRufbereitschaft", () => {
  it("Woche nach Stundenlohn-Modell (2 / 4 Stundenlöhne pro Tag) + 6 h Einsätze", () => {
    // 5 × 2 × 20 + 2 × 4 × 20 = 200 + 160; Einsätze 6 h × 20
    expect(calcRufbereitschaft(woche)).toEqual({ bereitschaftEuro: 360, einsatzEuro: 120, gesamtEuro: 480 });
  });

  it("feste Euro-Pauschale pro Tag", () => {
    const r = calcRufbereitschaft({ ...woche, modell: "pauschale" });
    expect(r.bereitschaftEuro).toBe(5 * 30 + 2 * 60);
    expect(r.gesamtEuro).toBe(270 + 120);
  });

  it("Einsatzminuten werden anteilig bezahlt, leere/negative Eingaben zählen als 0", () => {
    const r = calcRufbereitschaft({ ...woche, tageWerktag: -1, tageWochenende: NaN, einsatzMinuten: 45, stundenlohn: 18.5 });
    expect(r.bereitschaftEuro).toBe(0);
    expect(r.einsatzEuro).toBe(13.88);
  });
});
