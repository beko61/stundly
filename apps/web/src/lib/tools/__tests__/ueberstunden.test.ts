// @vitest-environment node
import { describe, it, expect } from "vitest";
import { parseHours, dayMinutes, calcUeberstunden } from "../ueberstunden";

describe("parseHours", () => {
  it("Komma, Punkt, Stunden:Minuten", () => {
    expect(parseHours("38")).toBe(2280);
    expect(parseHours("38,5")).toBe(2310);
    expect(parseHours("38.25")).toBe(2295);
    expect(parseHours("38:30")).toBe(2310);
    expect(parseHours(" 7:05 ")).toBe(425);
  });
  it("ungültig → null", () => {
    expect(parseHours("")).toBeNull();
    expect(parseHours("abc")).toBeNull();
    expect(parseHours("38:75")).toBeNull();
    expect(parseHours("-5")).toBeNull();
  });
});

describe("dayMinutes", () => {
  it("normaler Tag und Nachtschicht", () => {
    expect(dayMinutes("07:00", "16:00", 60)).toBe(480);
    expect(dayMinutes("22:00", "06:00", 30)).toBe(450);
  });
  it("unvollständig oder Start = Ende → 0", () => {
    expect(dayMinutes("", "16:00", 0)).toBe(0);
    expect(dayMinutes("07:00", "07:00", 0)).toBe(0);
    expect(dayMinutes("25:00", "16:00", 0)).toBe(0);
  });
});

describe("calcUeberstunden", () => {
  it("Woche: 45 h bei 40-h-Vertrag = +5 h = 0,625 Tage", () => {
    const r = calcUeberstunden({ istMin: 45 * 60, wochenStunden: 40, zeitraum: "woche" });
    expect(r).toEqual({ sollMin: 2400, diffMin: 300, tage: 0.625, wertEuro: null });
  });

  it("Monat: Soll = Wochenstunden × 52/12", () => {
    const r = calcUeberstunden({ istMin: 180 * 60, wochenStunden: 40, zeitraum: "monat" });
    expect(r.sollMin).toBe(10400); // 173h 20m
    expect(r.diffMin).toBe(400);
  });

  it("Wert mit Stundenlohn und Zuschlag, nur bei Überstunden", () => {
    expect(calcUeberstunden({ istMin: 2700, wochenStunden: 40, zeitraum: "woche", stundenlohn: 20, zuschlagPct: 25 }).wertEuro)
      .toBe(125); // 5 h × 20 € × 1,25
    expect(calcUeberstunden({ istMin: 2100, wochenStunden: 40, zeitraum: "woche", stundenlohn: 20 }).wertEuro).toBeNull();
  });
});
