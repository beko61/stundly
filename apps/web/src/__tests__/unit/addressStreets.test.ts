import { describe, it, expect } from "vitest";
import {
  normalizeStreetName, mergeStreets, orteOf, filterStreets, streetQuery, splitAdresse, joinAdresse,
} from "@/lib/address/streets";

// Ausschnitt echter OpenPLZ-Daten für 30519 (Duplikate = mehrere Straßenabschnitte)
const RAW = [
  { name: "Hildebrand-Weg",    locality: "Hannover" },
  { name: "Hildesheimer Str.", locality: "Hannover" },
  { name: "Hildesheimer Str.", locality: "Hannover" },
  { name: "Wiehbergstr.",      locality: "Hannover" },
  { name: "Wiehbergpark",      locality: "Hannover" },
  { name: "Am Lindenhofe",     locality: "Laatzen" },
];

describe("normalizeStreetName", () => {
  it("schreibt Str./str. am Ende aus", () => {
    expect(normalizeStreetName("Hildesheimer Str.")).toBe("Hildesheimer Straße");
    expect(normalizeStreetName("Wiehbergstr.")).toBe("Wiehbergstraße");
    expect(normalizeStreetName("Straßburger Platz")).toBe("Straßburger Platz");
  });
});

describe("mergeStreets / orteOf", () => {
  const streets = mergeStreets(RAW);
  it("entfernt Duplikate und sortiert", () => {
    expect(streets.map(s => s.name)).toEqual([
      "Am Lindenhofe", "Hildebrand-Weg", "Hildesheimer Straße", "Wiehbergpark", "Wiehbergstraße",
    ]);
  });
  it("häufigster Ort zuerst", () => {
    expect(orteOf(streets)).toEqual(["Hannover", "Laatzen"]);
  });
});

describe("filterStreets", () => {
  const streets = mergeStreets(RAW);
  it("Teilwort, Groß/klein egal, Wortanfang zuerst", () => {
    expect(filterStreets(streets, "hilde").map(s => s.name)).toEqual(["Hildebrand-Weg", "Hildesheimer Straße"]);
    expect(filterStreets(streets, "heimer").map(s => s.name)).toEqual(["Hildesheimer Straße"]);
  });
  it("Str / str. / strasse / straße sind gleichwertig", () => {
    expect(filterStreets(streets, "wiehbergstr").map(s => s.name)).toEqual(["Wiehbergstraße"]);
    expect(filterStreets(streets, "Hildesheimer Strasse").map(s => s.name)).toEqual(["Hildesheimer Straße"]);
    expect(filterStreets(streets, "Hildesheimer Str.").map(s => s.name)).toEqual(["Hildesheimer Straße"]);
  });
  it("nach Auswahl (exakter Name) keine Liste mehr", () => {
    expect(filterStreets(streets, "Hildesheimer Straße ")).toEqual([]);
  });
  it("sobald eine Hausnummer getippt wird, keine Liste (Klick würde sie überschreiben)", () => {
    expect(streetQuery("Wiehbergstraße 12a")).toBe("Wiehbergstraße");
    expect(streetQuery("Hauptstr. 3-5")).toBe("Hauptstr.");
    expect(filterStreets(streets, "Wiehberg 4")).toEqual([]);
    expect(filterStreets(streets, "Hildesheimer Straße 5")).toEqual([]);
  });
  it("unter 2 Zeichen keine Vorschläge", () => {
    expect(filterStreets(streets, "h")).toEqual([]);
  });
});

describe("splitAdresse / joinAdresse", () => {
  it("zerlegt das gespeicherte Format und setzt es wieder zusammen", () => {
    const p = splitAdresse("Hildesheimer Straße 5, 30519 Hannover");
    expect(p).toEqual({ strasse: "Hildesheimer Straße 5", plz: "30519", ort: "Hannover" });
    expect(joinAdresse(p)).toBe("Hildesheimer Straße 5, 30519 Hannover");
  });
  it("alter Freitext ohne PLZ bleibt unverändert", () => {
    const p = splitAdresse("Hinterhof bei Bäckerei Müller");
    expect(p).toEqual({ strasse: "Hinterhof bei Bäckerei Müller", plz: "", ort: "" });
    expect(joinAdresse(p)).toBe("Hinterhof bei Bäckerei Müller");
  });
  it("leere Teile entfallen", () => {
    expect(joinAdresse({ strasse: "", plz: "30519", ort: "Hannover" })).toBe("30519 Hannover");
    expect(joinAdresse({ strasse: "", plz: "", ort: "" })).toBe("");
    expect(splitAdresse(null)).toEqual({ strasse: "", plz: "", ort: "" });
  });
});
