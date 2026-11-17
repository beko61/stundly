import { describe, it, expect } from "vitest";
import { filterNewNotdienst, type StundlyNotdienstInsert } from "../internetsizImport";

const nd = (date: string, start: string, end: string): StundlyNotdienstInsert => ({
  date, start_time: start, end_time: end, kunde: null, adresse: null, note: null, problem: null, ergebnis: null, erledigt: false,
});

describe("filterNewNotdienst", () => {
  it("überspringt Einsätze, die es schon gibt (zweiter Import derselben Datei)", () => {
    const rows = [nd("2026-10-03", "18:00", "20:00"), nd("2026-10-04", "09:00", "11:00")];
    const existing = [{ date: "2026-10-03", start_time: "18:00:00", end_time: "20:00:00" }]; // Postgres liefert Sekunden
    expect(filterNewNotdienst(rows, existing)).toEqual({ rows: [rows[1]], skipped: 1 });
  });

  it("zwei verschiedene Einsätze am selben Tag bleiben beide", () => {
    const rows = [nd("2026-10-03", "08:00", "09:00"), nd("2026-10-03", "18:00", "20:00")];
    expect(filterNewNotdienst(rows, [])).toEqual({ rows, skipped: 0 });
  });

  it("doppelte Zeilen innerhalb der Datei nur einmal", () => {
    const a = nd("2026-10-03", "18:00", "20:00");
    expect(filterNewNotdienst([a, { ...a }], [])).toEqual({ rows: [a], skipped: 1 });
  });

  it("alles schon da → nichts zu importieren", () => {
    const rows = [nd("2026-10-03", "18:00", "20:00")];
    expect(filterNewNotdienst(rows, [{ date: "2026-10-03", start_time: "18:00", end_time: "20:00" }]))
      .toEqual({ rows: [], skipped: 1 });
  });
});
