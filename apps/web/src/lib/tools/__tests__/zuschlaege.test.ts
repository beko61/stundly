import { describe, it, expect } from "vitest";
import { calcZuschlaege } from "../zuschlaege";

const run = (date: string, start: string, end: string, stundenlohn = 20, bundesland = "NI") =>
  calcZuschlaege({ date, start, end, stundenlohn, bundesland })!;
const mins = (r: ReturnType<typeof run>) => Object.fromEntries(r.rows.map((x) => [x.art, x.minutes]));

describe("calcZuschlaege (§ 3b EStG)", () => {
  it("Sonntag 21–1 Uhr: Nacht 25 %, nach 0 Uhr 40 %, Sonntag gilt bis 4 Uhr des Folgetags weiter", () => {
    const r = run("2026-10-04", "21:00", "01:00"); // Sonntag
    expect(r.totalMin).toBe(240);
    expect(mins(r)).toEqual({ nacht25: 180, nacht40: 60, sonntag: 240 });
    expect(r.steuerfreiEuro).toBe(15 + 8 + 40);
    expect(r.grundEuro).toBe(80);
  });

  it("Werktag tagsüber: keine Zuschläge", () => {
    const r = run("2026-10-06", "10:00", "14:00");
    expect(r.rows).toEqual([]);
    expect(r.steuerfreiEuro).toBe(0);
  });

  it("Beginn nach 0 Uhr: nur 25 % Nachtzuschlag", () => {
    expect(mins(run("2026-10-06", "01:00", "03:00"))).toEqual({ nacht25: 120 });
  });

  it("Heiligabend erst ab 14 Uhr 150 %", () => {
    expect(mins(run("2026-12-24", "12:00", "16:00"))).toEqual({ feiertag150: 120 });
  });

  it("Sonntag zugleich Feiertag: nur der Feiertagssatz (Pfingstsonntag nur in Brandenburg Feiertag)", () => {
    expect(mins(run("2026-05-24", "10:00", "12:00", 20, "BB"))).toEqual({ feiertag: 120 });
    expect(mins(run("2026-05-24", "10:00", "12:00", 20, "NI"))).toEqual({ sonntag: 120 });
  });

  it("Grundlohn gedeckelt: 50 € (Steuer), 25 € (Sozialversicherung)", () => {
    const r = run("2026-10-06", "22:00", "23:00", 60);
    expect(r.steuerfreiEuro).toBe(12.5);
    expect(r.svFreiEuro).toBe(6.25);
    expect(r.grundEuro).toBe(60);
  });

  it("ungültige Eingaben → null", () => {
    expect(calcZuschlaege({ date: "x", start: "10:00", end: "11:00", stundenlohn: 20, bundesland: "NI" })).toBeNull();
    expect(calcZuschlaege({ date: "2026-10-06", start: "25:00", end: "11:00", stundenlohn: 20, bundesland: "NI" })).toBeNull();
  });
});
