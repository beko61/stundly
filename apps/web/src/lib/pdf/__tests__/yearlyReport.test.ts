import { describe, it, expect } from "vitest";
import type { TimeEntry } from "@workly/shared";
import { calcYearRows } from "../yearlyReportPdf";
import { calcMonthStats } from "../monthlyReportPdf";

const e = (date: string, start = "07:45", end = "17:00", pause = 60, day_type = "arbeiten"): TimeEntry =>
  ({ id: date, user_id: "u", date, start_time: start, end_time: end, break_minutes: pause, day_type,
     is_night_shift: false, note: null, tags: [], created_at: "", updated_at: "", synced_at: null } as unknown as TimeEntry);

describe("calcYearRows (Jahresbericht = Summe der Monatsberichte)", () => {
  const entries = [e("2025-01-06"), e("2025-01-07", "07:45", "18:00"), e("2025-03-03", "", "", 0, "urlaub"), e("2025-12-01")];
  // So 02.02.2025 → Woche gehört zum Februar; Mo 27.01. derselben Woche ebenfalls Februar
  const notdienst = [
    { date: "2025-01-27", start_time: "18:00", end_time: "20:00" },
    { date: "2025-03-10", start_time: "08:00", end_time: "09:00" },
  ];
  const input = { year: 2025, entries, notdienst, feiertage: {}, today: new Date(2026, 0, 15) };

  it("vergangenes Jahr: 12 Monate, jeder Monat = calcMonthStats, Saldo läuft auf", () => {
    const { rows, totals } = calcYearRows(input);
    expect(rows).toHaveLength(12);
    expect(totals.monate).toBe(12);
    const jan = calcMonthStats({ year: 2025, month: 1, entries: entries.slice(0, 2), notdienst: [], feiertage: {} });
    expect(rows[0]!.stats).toEqual(jan);
    expect(rows[1]!.stats!.ndMins).toBe(120);       // Notdienst 27.01. zählt im Februar
    expect(rows[2]!.stats!.urlaub).toBe(1);
    expect(rows[11]!.saldoMins).toBe(totals.diffMins);
    expect(totals.diffMins).toBe(rows.reduce((s, r) => s + r.stats!.diffMins, 0));
    expect(totals.workedMins).toBe(rows.reduce((s, r) => s + r.stats!.workedMins, 0));
    expect(totals.ndMins).toBe(180);
    expect(totals.notdienstCount).toBe(2);
  });

  it("laufendes Jahr: Monate nach heute zählen nicht (kein Soll ohne Ist)", () => {
    const { rows, totals } = calcYearRows({ ...input, today: new Date(2025, 2, 20) });
    expect(totals.monate).toBe(3);
    expect(rows.slice(3).every(r => r.stats === null)).toBe(true);
    expect(rows[11]!.saldoMins).toBe(rows[2]!.saldoMins);
    expect(totals.workedMins).not.toBe(calcYearRows(input).totals.workedMins); // Dezember fehlt
  });

  it("zukünftiges Jahr: nichts gezählt", () => {
    const { totals } = calcYearRows({ ...input, today: new Date(2024, 5, 1) });
    expect(totals).toMatchObject({ monate: 0, standardMins: 0, diffMins: 0 });
  });
});
