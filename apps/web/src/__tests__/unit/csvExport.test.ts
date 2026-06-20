import { describe, it, expect } from "vitest";
import { buildCsvDetail, buildCsvSummary, type CsvEmployeeMonth } from "@/lib/export/csvExport";
import type { TimeEntry } from "@workly/shared";

function entry(date: string, day_type: TimeEntry["day_type"], start?: string, end?: string, brk = 0, note?: string): TimeEntry {
  return {
    id: `e-${date}`, user_id: "u1", date,
    day_type, start_time: start ?? null, end_time: end ?? null,
    break_minutes: brk, is_night_shift: false,
    note: note ?? null, tags: [],
    synced_at: null,
    created_at: "", updated_at: "",
  };
}

describe("buildCsvDetail", () => {
  it("UTF-8 BOM ile başlar (Excel Almanca açar)", () => {
    const csv = buildCsvDetail({
      year: 2026, month: 6,
      row: { full_name: "Max", email: null, entries: [], notdienst: [] },
    });
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });

  it("DE Semikolon-Trenner kullanır", () => {
    const csv = buildCsvDetail({
      year: 2026, month: 6,
      row: { full_name: "Max", email: null, entries: [], notdienst: [] },
    });
    const lines = csv.split("\r\n");
    // Header satırı: 10 sütun → 9 semikolon
    const headerIdx = lines.findIndex(l => l.startsWith("Mitarbeiter;"));
    expect(headerIdx).toBeGreaterThan(-1);
    expect(lines[headerIdx]!.split(";").length).toBe(10);
  });

  it("Ay metadata header'da görünür", () => {
    const csv = buildCsvDetail({
      year: 2026, month: 6,
      row: { full_name: "Max", email: null, entries: [], notdienst: [] },
    });
    expect(csv).toContain("Juni 2026");
    expect(csv).toContain("Max");
  });

  it("Arbeiten entry net dakika hesaplar ve toplam çıkar", () => {
    const csv = buildCsvDetail({
      year: 2026, month: 6,
      row: {
        full_name: "Max", email: null,
        entries: [
          entry("2026-06-15", "arbeiten", "08:00", "17:00", 60),  // 8h = 480m
          entry("2026-06-16", "arbeiten", "08:00", "16:30", 30),  // 8h = 480m
        ],
        notdienst: [],
      },
    });
    expect(csv).toContain("08:00");
    expect(csv).toContain("Summe Arbeitszeit");
    expect(csv).toContain("16:00"); // 480+480 = 960 = 16:00
  });

  it("Gece vardiyası (end < start) doğru hesaplanır", () => {
    const csv = buildCsvDetail({
      year: 2026, month: 6,
      row: {
        full_name: "Max", email: null,
        entries: [entry("2026-06-15", "arbeiten", "22:00", "06:00", 0)],  // 8h
        notdienst: [],
      },
    });
    expect(csv).toContain("08:00"); // toplam 8h
  });

  it("Notdienst section eklenir varsa", () => {
    const csv = buildCsvDetail({
      year: 2026, month: 6,
      row: {
        full_name: "Max", email: null,
        entries: [],
        notdienst: [{ date: "2026-06-15", start_time: "20:00", end_time: "06:00", erledigt: true, kunde: "Kunde A" }],
      },
    });
    expect(csv).toContain("NOTDIENST");
    expect(csv).toContain("Kunde A");
    expect(csv).toContain("10:00"); // 22:00→06:00 = 10h
    expect(csv).toContain("Ja");    // bezahlt
  });

  it("Notdienst yoksa Notdienst section eklenmez", () => {
    const csv = buildCsvDetail({
      year: 2026, month: 6,
      row: { full_name: "Max", email: null, entries: [], notdienst: [] },
    });
    expect(csv).not.toContain("NOTDIENST");
  });

  it("Semikolon ve tırnak içeren notlar quoted edilir (RFC 4180)", () => {
    const csv = buildCsvDetail({
      year: 2026, month: 6,
      row: {
        full_name: "Max", email: null,
        entries: [entry("2026-06-15", "arbeiten", "08:00", "17:00", 60, "Notiz mit; Semikolon")],
        notdienst: [],
      },
    });
    expect(csv).toContain(`"Notiz mit; Semikolon"`);
  });
});

describe("buildCsvSummary", () => {
  function row(name: string, entries: TimeEntry[] = [], nd: CsvEmployeeMonth["notdienst"] = []): CsvEmployeeMonth {
    return { full_name: name, email: `${name.toLowerCase()}@example.com`, personal_nr: "001", entries, notdienst: nd };
  }

  it("Header bütün KPI sütunlarını içerir", () => {
    const csv = buildCsvSummary({ year: 2026, month: 6, rows: [row("Max")] });
    expect(csv).toContain("Mitarbeiter");
    expect(csv).toContain("Arbeitsstunden (HH:MM)");
    expect(csv).toContain("Notdienst");
  });

  it("Çalışan başına tek satır + agreggate veriler", () => {
    const csv = buildCsvSummary({
      year: 2026, month: 6,
      rows: [
        row("A", [entry("2026-06-15", "arbeiten", "08:00", "17:00", 60)]),
        row("B", [entry("2026-06-15", "urlaub")]),
      ],
    });
    const lines = csv.split("\r\n");
    const dataLines = lines.filter(l => l.startsWith("A;") || l.startsWith("B;"));
    expect(dataLines.length).toBe(2);
    expect(dataLines[0]).toContain("08:00"); // A: 8h work
    expect(dataLines[1]).toContain(";0;0;1;"); // B: 0 work, 0 arbeitstage, 1 urlaub
  });

  it("Notdienst bezahlt + offen sayılır", () => {
    const csv = buildCsvSummary({
      year: 2026, month: 6,
      rows: [row("A", [], [
        { date: "2026-06-15", start_time: "20:00", end_time: "06:00", erledigt: true,  kunde: null },
        { date: "2026-06-16", start_time: "20:00", end_time: "06:00", erledigt: false, kunde: null },
      ])],
    });
    expect(csv).toContain(";2;20:00;1200"); // 2 Einsätze, 20h, 1200m
  });

  it("Boş rows listesi → sadece header", () => {
    const csv = buildCsvSummary({ year: 2026, month: 6, rows: [] });
    const dataLines = csv.split("\r\n").filter(l =>
      l && !l.startsWith("﻿") && !l.startsWith("Monats") && !l.startsWith("Generiert") && !l.startsWith("Mitarbeiter")
    );
    expect(dataLines.length).toBe(0);
  });
});
