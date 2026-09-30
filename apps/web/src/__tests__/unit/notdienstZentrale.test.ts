import { describe, it, expect } from "vitest";
import {
  addDays, autoDistribute, berlinNowLocal, einsaetzeCsv, mondayOf, restUntil, upcomingWeeks,
} from "@/lib/company/notdienstZentrale";

describe("Wochen", () => {
  it("mondayOf / upcomingWeeks", () => {
    expect(mondayOf("2026-09-30")).toBe("2026-09-28");
    expect(mondayOf("2026-10-04")).toBe("2026-09-28"); // Sonntag gehört zur Woche davor
    expect(mondayOf("2026-09-28")).toBe("2026-09-28");
    expect(upcomingWeeks("2026-12-30", 3)).toEqual(["2026-12-28", "2027-01-04", "2027-01-11"]);
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
  });
});

describe("autoDistribute", () => {
  const W = ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"];
  it("verteilt reihum, fährt nach der Vorwoche fort", () => {
    expect(autoDistribute(W, ["a", "b", "c"], {}, "b").map((x) => x.user_id)).toEqual(["c", "a", "b", "c"]);
  });
  it("vorhandene Einteilungen bleiben, danach geht es mit dem Nächsten weiter", () => {
    const out = autoDistribute(W, ["a", "b", "c"], { "2026-10-12": "a" });
    expect(out).toEqual([
      { week_start: "2026-10-05", user_id: "a" },
      { week_start: "2026-10-19", user_id: "b" },
      { week_start: "2026-10-26", user_id: "c" },
    ]);
  });
  it("ohne Mitarbeiter nichts", () => {
    expect(autoDistribute(W, [], {})).toEqual([]);
  });
});

describe("restUntil (§5 ArbZG)", () => {
  const nd = (user_id: string, date: string, s: string, e: string) => ({ user_id, date, start_time: `${s}:00`, end_time: `${e}:00` });
  it("Einsatz bis 23:40 → Ruhe bis 10:40 am Folgetag", () => {
    const r = restUntil([nd("t", "2026-09-29", "22:30", "23:40")], "2026-09-30T07:00");
    expect(r.get("t")).toBe("2026-09-30T10:40");
  });
  it("Einsatz über Mitternacht", () => {
    const r = restUntil([nd("t", "2026-09-29", "23:00", "01:30")], "2026-09-30T08:00");
    expect(r.get("t")).toBe("2026-09-30T12:30");
  });
  it("Ruhe vorbei oder Einsatz läuft noch → kein Eintrag", () => {
    expect(restUntil([nd("t", "2026-09-29", "18:00", "19:00")], "2026-09-30T07:00").size).toBe(0);
    expect(restUntil([nd("t", "2026-09-30", "06:00", "09:00")], "2026-09-30T07:00").size).toBe(0);
  });
  it("spätester Einsatz zählt", () => {
    const r = restUntil([nd("t", "2026-09-29", "19:00", "20:00"), nd("t", "2026-09-29", "22:00", "23:00")], "2026-09-30T06:00");
    expect(r.get("t")).toBe("2026-09-30T10:00");
  });
});

describe("berlinNowLocal", () => {
  it("Sommerzeit UTC+2, Winterzeit UTC+1", () => {
    expect(berlinNowLocal(new Date("2026-09-29T22:30:00Z"))).toBe("2026-09-30T00:30");
    expect(berlinNowLocal(new Date("2026-12-31T23:10:00Z"))).toBe("2027-01-01T00:10");
  });
});

describe("einsaetzeCsv", () => {
  it("Semikolon, deutsche Zahlen, Anführungszeichen bei Sonderzeichen, BOM", () => {
    const csv = einsaetzeCsv([{
      date: "2026-09-12", name: "Tim", start_time: "18:10:00", end_time: "19:40:00", minutes: 90,
      kunde: 'Fam. "Weber"; 2. OG', kunde_telefon: null, adresse: "Lister Meile 12", problem: "Heizung\naus", ergebnis: null, erledigt: false,
    }], 80);
    expect(csv.startsWith("﻿Datum;Mitarbeiter;")).toBe(true);
    const line = csv.split("\r\n")[1]!;
    expect(line).toBe('12.09.2026;Tim;18:10;19:40;1,50;"Fam. ""Weber""; 2. OG";;Lister Meile 12;Heizung / aus;;nein;80,00');
  });
});
