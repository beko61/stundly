// @vitest-environment node
import { describe, it, expect } from "vitest";
import { overtimeCarry, manualCarryHours } from "../overtimeCarry";

const r2026 = { valid_from: "2026-06-10", created_at: "2026-06-10T00:00:00Z", ueberstunden_uebertrag: null };
const r2027 = (h: number | null) => ({ valid_from: "2027-01-01", created_at: "2026-11-19T00:00:00Z", ueberstunden_uebertrag: h });

describe("Überstunden-Übertrag", () => {
  it("automatisch: Saldo des Vorjahres", () => {
    expect(overtimeCarry([r2026], 2027, 1200)).toEqual({ carryMin: 1200, autoMin: 1200, manual: false });
  });

  it("korrigiert: gesetzter Wert gilt, Vorschlag bleibt sichtbar", () => {
    expect(overtimeCarry([r2026, r2027(12.5)], 2027, 1200)).toEqual({ carryMin: 750, autoMin: 1200, manual: true });
    expect(overtimeCarry([r2026, r2027(0)], 2027, 1200).carryMin).toBe(0); // ausgezahlt
  });

  it("Minusstunden werden übertragen", () => {
    expect(overtimeCarry([r2026], 2027, -300).carryMin).toBe(-300);
  });

  it("gesetzter Übertrag des Vorjahres fließt ins Folgejahr", () => {
    const rows = [r2026, r2027(10)];
    expect(overtimeCarry(rows, 2028, 120)).toMatchObject({ carryMin: 10 * 60 + 120, manual: false });
  });

  it("Wert einer älteren Zeile gilt nicht für ein Jahr ohne eigene Zeile", () => {
    expect(manualCarryHours([{ ...r2026, ueberstunden_uebertrag: 5 }], 2027)).toBeNull();
    expect(manualCarryHours([{ ...r2026, ueberstunden_uebertrag: "7.50" }], 2026)).toBe(7.5);
  });
});
