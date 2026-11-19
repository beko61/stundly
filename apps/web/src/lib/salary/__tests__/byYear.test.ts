// @vitest-environment node
import { describe, it, expect } from "vitest";
import { rowForYear, ownRowForYear, rowsForYearByUser, localSettingsForYear } from "../byYear";

const A = { id: "a", user_id: "u", valid_from: "2026-06-10", created_at: "2026-06-10T08:00:00Z", h: 174 };
const B = { id: "b", user_id: "u", valid_from: "2027-01-01", created_at: "2026-11-19T08:00:00Z", h: 160 };

describe("Lohn-Einstellungen je Jahr", () => {
  it("2027 geändert → 2026 bleibt", () => {
    expect(rowForYear([A, B], 2026)?.h).toBe(174);
    expect(rowForYear([A, B], 2027)?.h).toBe(160);
  });

  it("späteres Jahr ohne eigene Zeile übernimmt das letzte, früheres die älteste", () => {
    expect(rowForYear([A, B], 2028)?.h).toBe(160);
    expect(rowForYear([A, B], 2025)?.h).toBe(174);
    expect(rowForYear([], 2026)).toBeNull();
  });

  it("gespeichert wird nur in die Zeile des Jahres", () => {
    expect(ownRowForYear([A, B], 2026)?.id).toBe("a");
    expect(ownRowForYear([A], 2027)).toBeNull();
  });

  it("mehrere Nutzer", () => {
    const m = rowsForYearByUser([A, B, { ...A, id: "c", user_id: "v", h: 100 }], 2026);
    expect(m.get("u")?.id).toBe("a");
    expect(m.get("v")?.h).toBe(100);
  });

  it("Browser-Stand nur für das eigene Jahr", () => {
    expect(localSettingsForYear(JSON.stringify({ monthly_target_hours: 160, _year: 2027 }), 2026)).toBeNull();
    expect(localSettingsForYear(JSON.stringify({ monthly_target_hours: 160, _year: 2027 }), 2027)).toMatchObject({ monthly_target_hours: 160 });
    expect(localSettingsForYear(JSON.stringify({ monthly_target_hours: 160 }), 2026)).toBeNull(); // alter Stand ohne Jahr
  });
});
