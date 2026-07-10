import { describe, it, expect } from "vitest";
import { getFeiertage, BUNDESLAENDER } from "@/lib/utils/feiertage";

describe("getFeiertage — nationwide holidays", () => {
  it("Neujahr, Tag der Arbeit, Tag der Deutschen Einheit, Weihnachten 2026", () => {
    const f = getFeiertage(2026, "NI");
    expect(f["2026-01-01"]).toBe("Neujahr");
    expect(f["2026-05-01"]).toBe("Tag der Arbeit");
    expect(f["2026-10-03"]).toBe("Tag der Deutschen Einheit");
    expect(f["2026-12-25"]).toBe("1. Weihnachtstag");
    expect(f["2026-12-26"]).toBe("2. Weihnachtstag");
  });

  it("Karfreitag + Ostermontag 2026 (Ostersonntag NUR in BB, siehe unten)", () => {
    // 2026: Karfreitag 3 Nisan, Ostersonntag 5 Nisan, Ostermontag 6 Nisan
    const f = getFeiertage(2026, "NI");
    expect(f["2026-04-03"]).toBe("Karfreitag");
    expect(f["2026-04-06"]).toBe("Ostermontag");
    // Ostersonntag NI'de gesetzlich Feiertag DEĞİLDİR (sadece Sonntag).
    expect(f["2026-04-05"]).toBeUndefined();
  });

  it("Easter 2025 = 20 April — Karfreitag + Ostermontag NI (Ostersonntag NUR BB)", () => {
    const f = getFeiertage(2025, "NI");
    expect(f["2025-04-18"]).toBe("Karfreitag");
    expect(f["2025-04-21"]).toBe("Ostermontag");
    expect(f["2025-04-20"]).toBeUndefined();
  });

  it("Pfingstmontag nationwide, Pfingstsonntag NUR BB", () => {
    // 2026: Pfingstsonntag 24 Mai, Pfingstmontag 25 Mai
    const f = getFeiertage(2026, "NI");
    expect(f["2026-05-25"]).toBe("Pfingstmontag");
    // Pfingstsonntag NI'de gesetzlich Feiertag DEĞİLDİR (sadece Sonntag).
    expect(f["2026-05-24"]).toBeUndefined();
  });

  it("Ostersonntag + Pfingstsonntag NUR Brandenburg (L4 fix)", () => {
    // Brandenburg spesifik: hem Ostersonntag hem Pfingstsonntag gesetzlich Feiertag
    const bb = getFeiertage(2026, "BB");
    expect(bb["2026-04-05"]).toBe("Ostersonntag");
    expect(bb["2026-05-24"]).toBe("Pfingstsonntag");
    expect(bb["2026-04-04"]).toBe("Karsamstag"); // BB'ye özgü zaten
  });

  it("Christi Himmelfahrt = Easter + 39", () => {
    // 2026: 14 Mai
    const f = getFeiertage(2026, "NI");
    expect(f["2026-05-14"]).toBe("Christi Himmelfahrt");
  });
});

describe("getFeiertage — Bundesland-specific", () => {
  it("Heilige Drei Könige (06.01) sadece BW/BY/ST", () => {
    expect(getFeiertage(2026, "BY")["2026-01-06"]).toBe("Heilige Drei Könige");
    expect(getFeiertage(2026, "BW")["2026-01-06"]).toBe("Heilige Drei Könige");
    expect(getFeiertage(2026, "ST")["2026-01-06"]).toBe("Heilige Drei Könige");
    expect(getFeiertage(2026, "NI")["2026-01-06"]).toBeUndefined();
    expect(getFeiertage(2026, "BE")["2026-01-06"]).toBeUndefined();
  });

  it("Fronleichnam (Easter+60) sadece katolik Bundesland'larda", () => {
    // 2026: 4 Haziran
    expect(getFeiertage(2026, "BY")["2026-06-04"]).toBe("Fronleichnam");
    expect(getFeiertage(2026, "NW")["2026-06-04"]).toBe("Fronleichnam");
    expect(getFeiertage(2026, "NI")["2026-06-04"]).toBeUndefined();
  });

  it("Reformationstag (31.10) sadece protestan Bundesland'larda", () => {
    expect(getFeiertage(2026, "NI")["2026-10-31"]).toBe("Reformationstag");
    expect(getFeiertage(2026, "SN")["2026-10-31"]).toBe("Reformationstag");
    expect(getFeiertage(2026, "BY")["2026-10-31"]).toBeUndefined();
    expect(getFeiertage(2026, "BW")["2026-10-31"]).toBeUndefined();
  });

  it("Buß- und Bettag sadece Sachsen", () => {
    // 2026: 18 Kasım (Çarşamba, 23 Kasım'dan önceki Çarşamba)
    const f = getFeiertage(2026, "SN");
    expect(f["2026-11-18"]).toBe("Buß- und Bettag");
    expect(getFeiertage(2026, "NI")["2026-11-18"]).toBeUndefined();
  });

  it("Weltkindertag (20.09) sadece Thüringen", () => {
    expect(getFeiertage(2026, "TH")["2026-09-20"]).toBe("Weltkindertag");
    expect(getFeiertage(2026, "NI")["2026-09-20"]).toBeUndefined();
  });

  it("Allerheiligen (01.11) sadece katolik Bundesland'lar", () => {
    expect(getFeiertage(2026, "BY")["2026-11-01"]).toBe("Allerheiligen");
    expect(getFeiertage(2026, "NI")["2026-11-01"]).toBeUndefined();
  });

  it("lowercase bundesland desteklenir", () => {
    expect(getFeiertage(2026, "by")["2026-01-06"]).toBe("Heilige Drei Könige");
  });
});

describe("BUNDESLAENDER constant", () => {
  it("tüm 16 Bundesland mevcut", () => {
    expect(Object.keys(BUNDESLAENDER)).toHaveLength(16);
    expect(BUNDESLAENDER.NI).toBe("Niedersachsen");
    expect(BUNDESLAENDER.BY).toBe("Bayern");
  });
});
