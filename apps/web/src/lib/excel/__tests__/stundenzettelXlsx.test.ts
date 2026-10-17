import { describe, it, expect } from "vitest";
import { crc32, zipStore } from "../zipStore";
import { arbeitstage, buildStundenzettelXlsx, buildStundenzettelXlsxFiles, summenZeilen } from "../stundenzettelXlsx";
import { getFeiertage } from "@/lib/utils/feiertage";

const input = { year: 2027, bundesland: "NI", name: "Max & Co", firma: "" };

describe("zipStore", () => {
  it("crc32 stimmt mit dem Standard-Prüfwert überein", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("schreibt Signaturen und Einträge", () => {
    const z = zipStore([{ name: "a.txt", data: new TextEncoder().encode("hi") }]);
    const v = new DataView(z.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint32(z.length - 22, true)).toBe(0x06054b50);
    expect(v.getUint16(z.length - 22 + 10, true)).toBe(1);
  });
});

describe("Stundenzettel-Excel", () => {
  it("Arbeitstage: Mo–Fr ohne Feiertage (Januar 2027, Neujahr ist Freitag)", () => {
    expect(arbeitstage(2027, 1, getFeiertage(2027, "NI"))).toBe(20);
    expect(arbeitstage(2027, 1, {})).toBe(21);
  });

  it("Jahr + 12 Monatsblätter, Feiertag markiert, Formeln mit Mitternacht, Pause, Urlaub/Krank", () => {
    const f = buildStundenzettelXlsxFiles(input);
    expect(f["xl/workbook.xml"]).toContain('<sheet name="Jahr"');
    expect(f["xl/workbook.xml"]).toContain('<sheet name="März"');
    expect(f["xl/worksheets/sheet13.xml"]).toBeDefined();

    const mai = f["xl/worksheets/sheet6.xml"]!;
    expect(mai).toContain("Tag der Arbeit");
    expect(mai).toContain("<f>IF(OR(H6=&quot;Urlaub&quot;,H6=&quot;Krank&quot;),Jahr!$B$4,IF(OR(C6=&quot;&quot;,D6=&quot;&quot;),&quot;&quot;,MOD(D6-C6,1)*24-N(E6)/60))</f>");

    // Jahresblatt verweist auf die richtigen Summenzeilen (Februar 2027: 28 Tage)
    const z = summenZeilen(2027, 2);
    expect(z.summe).toBe(6 + 28 - 1 + 2);
    expect(f["xl/worksheets/sheet1.xml"]).toContain(`<f>'Februar'!F${z.ueber}</f>`);
    expect(f["xl/worksheets/sheet3.xml"]).toContain(`<f>F${z.summe}-F${z.soll}</f>`);
  });

  it("Eingaben werden für XML maskiert", () => {
    const f = buildStundenzettelXlsxFiles(input);
    expect(f["xl/worksheets/sheet1.xml"]).toContain("Max &amp; Co");
  });

  it("ohne Bundesland keine Feiertage", () => {
    const f = buildStundenzettelXlsxFiles({ ...input, bundesland: null });
    expect(f["xl/worksheets/sheet6.xml"]).not.toContain("Tag der Arbeit");
    expect(f["xl/worksheets/sheet1.xml"]).toContain("keine eingetragen");
  });

  it("erzeugt ein ZIP", () => {
    const bytes = buildStundenzettelXlsx(input);
    expect(new DataView(bytes.buffer).getUint32(0, true)).toBe(0x04034b50);
  });
});
