import { describe, it, expect } from "vitest";
import type { TimeEntry } from "@workly/shared";
import { computeLohnRows, dec, hm, lohnCsv } from "@/lib/company/lohn";
import { buildLohnMailHtml, buildTeamDigestHtml, escapeHtml, lohnFileName } from "@/lib/email/companyMails";

const te = (user_id: string, date: string, day_type: string, start: string | null, end: string | null, pause = 60) =>
  ({ user_id, date, day_type, start_time: start, end_time: end, break_minutes: pause }) as unknown as TimeEntry & { user_id: string };

// September 2026: 22 Werktage, keine Feiertage (für den Test leeres Feiertags-Objekt)
const emp = (user_id: string, name: string, targetHours = 173.33) => ({ user_id, name, personal_nr: null, targetHours, feiertage: {} });

describe("computeLohnRows", () => {
  const rows = computeLohnRows({
    employees: [emp("a", "Ali"), emp("t", "Tim", 100)],
    entries: [
      te("a", "2026-09-01", "arbeiten", "07:00", "16:00"),        // 8h
      te("a", "2026-09-02", "urlaub", null, null),                  // 8h Soll
      te("a", "2026-09-03", "krank", null, null),                   // 8h Soll
      te("a", "2026-08-31", "arbeiten", "07:00", "16:00"),        // anderer Monat — zählt nicht
      te("t", "2026-09-01", "arbeiten", "06:00", "18:00", 30),    // 11,5h
    ],
    ndEntries: [
      { user_id: "a", date: "2026-09-12", start_time: "18:00", end_time: "20:00", erledigt: false },
      { user_id: "a", date: "2026-09-29", start_time: "18:00", end_time: "19:00", erledigt: false }, // Woche endet 04.10. → Oktober
      { user_id: "t", date: "2026-08-31", start_time: "20:00", end_time: "21:00", erledigt: true },  // Woche endet 06.09. → September
    ],
    closings: new Map([["a", "approved" as const]]),
    year: 2026, month: 9, pauschale: 80,
  });
  const [ali, tim] = rows;

  it("rechnet wie beim Mitarbeiter (Arbeit, bezahlte Abwesenheit, Notdienst per Wochen-Sonntag)", () => {
    expect(ali).toMatchObject({
      name: "Ali", status: "approved", arbeitMin: 480, bezahltAbwMin: 960, istMin: 1440,
      ndCount: 1, ndMin: 120, ndOffen: 1, urlaubDays: 1, krankDays: 1, pauschaleSum: 80,
    });
    expect(ali!.sollMin).toBe(Math.round(173.33 * 60));
    expect(ali!.diffMin).toBe(1440 + 120 - Math.round(173.33 * 60));
  });

  it("Notdienst aus dem Vormonat-Datum zählt, wenn der Sonntag im Monat liegt; Status offen", () => {
    expect(tim).toMatchObject({ status: null, arbeitMin: 690, ndCount: 1, ndOffen: 0, sollMin: 6000 });
  });

  it("CSV: Kopfzeile zuerst, Dezimalstunden mit Komma, BOM", () => {
    const csv = lohnCsv(rows);
    const lines = csv.slice(1).split("\r\n");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lines[0]).toMatch(/^Personalnr\.;Mitarbeiter;Status;Soll \(h\)/);
    expect(lines[1]).toBe(`;Ali;freigegeben;173,33;8,00;16,00;24,00;2,00;1;1;${dec(ali!.diffMin)};1;1;0;80,00`);
    expect(lines[2]!.split(";")[2]).toBe("offen");
  });
});

describe("Formatierung", () => {
  it("hm / dec", () => {
    expect(hm(750)).toBe("12:30");
    expect(hm(-195)).toBe("-3:15");
    expect(dec(750)).toBe("12,50");
    expect(dec(-20)).toBe("-0,33");
  });
  it("Dateiname ohne Umlaute/Sonderzeichen", () => {
    expect(lohnFileName("Müller & Söhne GmbH", 2026, 9)).toBe("Lohn-Vorbereitung_Mueller-Soehne-GmbH_2026-09.csv");
  });
});

describe("Mails", () => {
  it("escaped Namen (kein HTML aus Nutzereingaben)", () => {
    expect(escapeHtml(`<b>"x"&'`)).toBe("&lt;b&gt;&quot;x&quot;&amp;&#39;");
    const html = buildLohnMailHtml({
      firma: "<Firma>", monthLabel: "September 2026", sender: "Chef",
      rows: [{ user_id: "a", name: "<script>", personal_nr: null, status: null, sollMin: 0, arbeitMin: 0, bezahltAbwMin: 0, istMin: 0, ndCount: 0, ndMin: 0, ndOffen: 0, diffMin: 0, urlaubDays: 0, krankDays: 0, feiertagDays: 0, pauschaleSum: null }],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("noch nicht vom Betrieb freigegeben");
  });
  it("Montags-Überblick: Aufgaben oder 'Nichts offen'", () => {
    const base = { firma: "Wa", weekLabel: "22.09. – 28.09.", teamMin: 600, ndCount: 2, onDuty: "Tim" };
    expect(buildTeamDigestHtml("Anna Admin", { ...base, tasks: [] })).toContain("Nichts offen");
    const html = buildTeamDigestHtml("Anna Admin", { ...base, tasks: ["2 Urlaubsanträge offen"] });
    expect(html).toContain("Guten Morgen, Anna");
    expect(html).toContain("2 Urlaubsanträge offen");
    expect(html).toContain("10:00 h");
  });
});
