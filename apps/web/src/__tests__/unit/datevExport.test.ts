import { describe, it, expect } from "vitest";
import {
  buildDatevMonthlyCsv,
  splitFullName,
  deNumber,
  csvEscape,
} from "@/lib/export/datevExport";
import type { TimeEntry } from "@workly/shared";

function mkEntry(p: Partial<TimeEntry> & { date: string }): TimeEntry {
  return {
    id:             p.id ?? `e-${p.date}`,
    user_id:        p.user_id ?? "u",
    date:           p.date,
    start_time:     p.start_time ?? null,
    end_time:       p.end_time ?? null,
    break_minutes:  p.break_minutes ?? 0,
    is_night_shift: p.is_night_shift ?? false,
    note:           p.note ?? null,
    tags:           p.tags ?? [],
    day_type:       p.day_type ?? "arbeiten",
    synced_at:      p.synced_at ?? null,
    created_at:     p.created_at ?? "2026-01-01T00:00:00Z",
    updated_at:     p.updated_at ?? "2026-01-01T00:00:00Z",
  };
}

const arbeiten = (date: string, start = "08:00", end = "17:00", brk = 60) =>
  mkEntry({ date, start_time: start, end_time: end, break_minutes: brk, day_type: "arbeiten" });
const urlaub   = (date: string) => mkEntry({ date, day_type: "urlaub" });
const krank    = (date: string) => mkEntry({ date, day_type: "krank" });

describe("splitFullName", () => {
  it("İki kelime → vorname/nachname doğru", () => {
    expect(splitFullName("Ali Yildiz")).toEqual({ vorname: "Ali", nachname: "Yildiz" });
  });
  it("Üç kelime → son kelime nachname, öncekiler vorname", () => {
    expect(splitFullName("Hans Jürgen Meier")).toEqual({ vorname: "Hans Jürgen", nachname: "Meier" });
  });
  it("Tek kelime → vorname'e koyar, nachname boş", () => {
    expect(splitFullName("Ali")).toEqual({ vorname: "Ali", nachname: "" });
  });
  it("Boş → vorname='—', nachname boş", () => {
    expect(splitFullName("")).toEqual({ vorname: "—", nachname: "" });
    expect(splitFullName(null)).toEqual({ vorname: "—", nachname: "" });
    expect(splitFullName(undefined)).toEqual({ vorname: "—", nachname: "" });
  });
});

describe("deNumber", () => {
  it("Virgüllü ondalık", () => {
    expect(deNumber(168.75)).toBe("168,75");
  });
  it("Default 2 decimal", () => {
    expect(deNumber(100)).toBe("100,00");
  });
  it("Custom decimals", () => {
    expect(deNumber(3.14159, 4)).toBe("3,1416");
  });
  it("Negatif", () => {
    expect(deNumber(-12.5)).toBe("-12,50");
  });
});

describe("csvEscape", () => {
  it("Basit string kaçırılmaz", () => {
    expect(csvEscape("Meier")).toBe("Meier");
  });
  it("Semikolon → tırnak", () => {
    expect(csvEscape("Meier; GmbH")).toBe('"Meier; GmbH"');
  });
  it("Çift tırnak → escape", () => {
    expect(csvEscape('a "b" c')).toBe('"a ""b"" c"');
  });
  it("Null → boş string", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });
});

describe("buildDatevMonthlyCsv", () => {
  it("UTF-8 BOM ile başlar", () => {
    const csv = buildDatevMonthlyCsv({ year: 2026, month: 6, rows: [] });
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });

  it("Başlık satırı doğru", () => {
    const csv = buildDatevMonthlyCsv({ year: 2026, month: 6, rows: [] });
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toContain("Personalnummer;Nachname;Vorname;Abrechnungsmonat");
    expect(lines[0]).toContain("Bruttolohn_Gesamt_EUR");
  });

  it("Tek mitarbeiter, 5 arbeiten günü, doğru toplam", () => {
    const rows = [
      {
        personalNummer:        "EMP-001",
        vorname:               "Ali",
        nachname:              "Yildiz",
        entries: [
          arbeiten("2026-06-15"), arbeiten("2026-06-16"), arbeiten("2026-06-17"),
          arbeiten("2026-06-18"), arbeiten("2026-06-19"),
        ], // 5 × 8h = 40h
        notdienst: [],
        stundenlohn:           20,
        notdienstBonus:        50,
        monatlicheSollstunden: 174,
      },
    ];
    const csv = buildDatevMonthlyCsv({ year: 2026, month: 6, rows });
    const lines = csv.slice(1).split("\r\n");
    const row = lines[1]!.split(";");
    expect(row[0]).toBe("EMP-001");
    expect(row[1]).toBe("Yildiz");
    expect(row[2]).toBe("Ali");
    expect(row[3]).toBe("06.2026");
    expect(row[4]).toBe("40,00"); // Arbeitsstunden
    expect(row[5]).toBe("0");     // Urlaubstage
    expect(row[6]).toBe("0");     // Krankheitstage
    expect(row[7]).toBe("0");     // Notdiensttage
    expect(row[9]).toBe("3480,00"); // Grundlohn = 174 × 20
    expect(row[10]).toBe("3480,00"); // Bruttolohn = Grundlohn (Notdienstbonus 0)
  });

  it("Urlaub/Krank sayıları doğru", () => {
    const rows = [
      {
        personalNummer:        "EMP-001",
        vorname: "Ali", nachname: "Y",
        entries: [
          arbeiten("2026-06-01"),
          urlaub("2026-06-15"), urlaub("2026-06-16"),
          krank("2026-06-17"),
        ],
        notdienst: [],
        stundenlohn: 15, notdienstBonus: 0, monatlicheSollstunden: 160,
      },
    ];
    const csv = buildDatevMonthlyCsv({ year: 2026, month: 6, rows });
    const lines = csv.slice(1).split("\r\n");
    const row = lines[1]!.split(";");
    expect(row[5]).toBe("2"); // Urlaub
    expect(row[6]).toBe("1"); // Krank
    expect(row[4]).toBe("8,00"); // sadece 1 arbeiten günü
  });

  it("Notdienst bonusu doğru", () => {
    const rows = [
      {
        personalNummer: "EMP-002",
        vorname: "B", nachname: "M",
        entries: [],
        notdienst: [
          { date: "2026-06-15", start_time: "18:00", end_time: "22:00" },
          { date: "2026-06-16", start_time: "18:00", end_time: "22:00" },
        ], // 2 gün × 4h = 8h
        stundenlohn: 20, notdienstBonus: 50, monatlicheSollstunden: 174,
      },
    ];
    const csv = buildDatevMonthlyCsv({ year: 2026, month: 6, rows });
    const row = csv.slice(1).split("\r\n")[1]!.split(";");
    expect(row[4]).toBe("8,00");   // 8h Notdienst dahil
    expect(row[7]).toBe("2");      // 2 Notdiensttage
    expect(row[8]).toBe("100,00"); // 2 × 50
    expect(row[10]).toBe("3580,00"); // 3480 + 100
  });

  it("Çoklu mitarbeiter her biri ayrı satır", () => {
    const rows = [
      {
        personalNummer: "EMP-A", vorname: "A", nachname: "A",
        entries: [arbeiten("2026-06-15")],
        notdienst: [],
        stundenlohn: 15, notdienstBonus: 0, monatlicheSollstunden: 160,
      },
      {
        personalNummer: "EMP-B", vorname: "B", nachname: "B",
        entries: [arbeiten("2026-06-15"), arbeiten("2026-06-16")],
        notdienst: [],
        stundenlohn: 20, notdienstBonus: 0, monatlicheSollstunden: 174,
      },
    ];
    const csv = buildDatevMonthlyCsv({ year: 2026, month: 6, rows });
    const lines = csv.slice(1).split("\r\n");
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[1]).toContain("EMP-A");
    expect(lines[2]).toContain("EMP-B");
  });

  it("Nachname'de semikolon → CSV escape", () => {
    const rows = [
      {
        personalNummer: "EMP-1",
        vorname: "Test", nachname: "Meier; GmbH & Co",
        entries: [], notdienst: [],
        stundenlohn: 0, notdienstBonus: 0, monatlicheSollstunden: 0,
      },
    ];
    const csv = buildDatevMonthlyCsv({ year: 2026, month: 6, rows });
    expect(csv).toContain('"Meier; GmbH & Co"');
  });

  it("Boş rows → sadece header + BOM", () => {
    const csv = buildDatevMonthlyCsv({ year: 2026, month: 6, rows: [] });
    const noBom = csv.slice(1);
    expect(noBom.split("\r\n")).toHaveLength(1);
    expect(noBom).toContain("Personalnummer");
  });
});
