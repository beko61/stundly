import { describe, it, expect } from "vitest";
import { nameParts } from "../personName";

describe("nameParts — Name für PDFs, wenn nur full_name gespeichert ist", () => {
  it("vorhandene Vor-/Nachnamen haben Vorrang", () => {
    expect(nameParts({ vorname: "Max", nachname: "Muster", full_name: "Anders Name" })).toEqual({ vorname: "Max", nachname: "Muster" });
  });
  it("aus full_name: letztes Wort = Nachname, Rest = Vorname", () => {
    expect(nameParts({ full_name: "  Hans  Peter   Müller " })).toEqual({ vorname: "Hans Peter", nachname: "Müller" });
    expect(nameParts({ vorname: "", nachname: null, full_name: "Ayse Yilmaz" })).toEqual({ vorname: "Ayse", nachname: "Yilmaz" });
  });
  it("ein Wort → nur Vorname; nichts → leer", () => {
    expect(nameParts({ full_name: "Mehmet" })).toEqual({ vorname: "Mehmet", nachname: "" });
    expect(nameParts(null)).toEqual({ vorname: "", nachname: "" });
  });
});
