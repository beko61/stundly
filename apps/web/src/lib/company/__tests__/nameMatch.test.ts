import { describe, it, expect } from "vitest";
import { matchEmployee, normName } from "../nameMatch";

const team = [
  { user_id: "u1", full_name: "Max Müller" },
  { user_id: "u2", full_name: "Moritz Müller" },
  { user_id: "u3", full_name: "Ayşe Yılmaz" },
  { user_id: "u4", full_name: null, vorname: "Jan", nachname: "Schröder" },
];

describe("matchEmployee (Foto-Import)", () => {
  it("voller Name, Reihenfolge und Umlaute egal", () => {
    expect(matchEmployee("Max Müller", team)).toBe("u1");
    expect(matchEmployee("MUELLER, Max", team)).toBe("u1");
    expect(matchEmployee("Ayse Yilmaz", team)).toBe("u3");
    expect(matchEmployee("Schroeder Jan", team)).toBe("u4");
  });

  it("Initiale unterscheidet", () => {
    expect(matchEmployee("M. Müller", team)).toBeNull();   // Max oder Moritz
    expect(matchEmployee("Mo. Müller", team)).toBeNull();   // "mo" ist kein Namensteil
    expect(matchEmployee("J. Schröder", team)).toBe("u4");
  });

  it("nur Nachname: eindeutig → Treffer, mehrdeutig → null", () => {
    expect(matchEmployee("Yılmaz", team)).toBe("u3");
    expect(matchEmployee("Müller", team)).toBeNull();
    expect(matchEmployee("Moritz", team)).toBe("u2");
  });

  it("unbekannt / leer → null", () => {
    expect(matchEmployee("Peter Klein", team)).toBeNull();
    expect(matchEmployee("  ", team)).toBeNull();
  });

  it("normName", () => {
    expect(normName("  Jörg-Peter  Weiß ")).toBe("joerg peter weiss");
  });
});
