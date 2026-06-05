/** Computus — Gregorian anonymous algorithm */
function calcEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function fmt(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

/** Wednesday before Nov 23 = Buß- und Bettag (Sachsen only) */
function bussBettag(year: number): Date {
  const nov23 = new Date(year, 10, 23);
  const dow = nov23.getDay(); // 0=Sun
  // Go back to the previous Wednesday (dow=3)
  const diff = (dow >= 3) ? dow - 3 : dow + 4;
  return addDays(nov23, -diff);
}

export const BUNDESLAENDER: Record<string, string> = {
  BW: "Baden-Württemberg",
  BY: "Bayern",
  BE: "Berlin",
  BB: "Brandenburg",
  HB: "Bremen",
  HH: "Hamburg",
  HE: "Hessen",
  MV: "Mecklenburg-Vorpommern",
  NI: "Niedersachsen",
  NW: "Nordrhein-Westfalen",
  RP: "Rheinland-Pfalz",
  SL: "Saarland",
  SN: "Sachsen",
  ST: "Sachsen-Anhalt",
  SH: "Schleswig-Holstein",
  TH: "Thüringen",
};

/**
 * Returns map of { "YYYY-MM-DD": "Feiertagname" } for the given year and Bundesland.
 * @param year  Full year number (e.g. 2026)
 * @param bundesland  Two-letter code, defaults to "NI" (Niedersachsen)
 */
export function getFeiertage(year: number, bundesland = "NI"): Record<string, string> {
  const easter = calcEaster(year);
  const bl = bundesland.toUpperCase();

  const holidays: Record<string, string> = {
    // ── Nationwide ────────────────────────────────────────────────
    [`${year}-01-01`]:              "Neujahr",
    [fmt(addDays(easter, -2))]:     "Karfreitag",
    [fmt(easter)]:                  "Ostersonntag",
    [fmt(addDays(easter,  1))]:     "Ostermontag",
    [`${year}-05-01`]:              "Tag der Arbeit",
    [fmt(addDays(easter, 39))]:     "Christi Himmelfahrt",
    [fmt(addDays(easter, 49))]:     "Pfingstsonntag",
    [fmt(addDays(easter, 50))]:     "Pfingstmontag",
    [`${year}-10-03`]:              "Tag der Deutschen Einheit",
    [`${year}-12-25`]:              "1. Weihnachtstag",
    [`${year}-12-26`]:              "2. Weihnachtstag",
  };

  // ── State-specific ────────────────────────────────────────────

  // Heilige Drei Könige (Jan 6): BW, BY, ST
  if (["BW","BY","ST"].includes(bl)) {
    holidays[`${year}-01-06`] = "Heilige Drei Könige";
  }

  // Internationaler Frauentag (Mar 8): BE, MV
  if (["BE","MV"].includes(bl)) {
    holidays[`${year}-03-08`] = "Internationaler Frauentag";
  }

  // Karsamstag (Holy Saturday): BB only
  if (bl === "BB") {
    holidays[fmt(addDays(easter, -1))] = "Karsamstag";
  }

  // Fronleichnam (Corpus Christi, 60 days after Easter): BW, BY, HE, NW, RP, SL + parts of SN/TH
  if (["BW","BY","HE","NW","RP","SL","SN","TH"].includes(bl)) {
    holidays[fmt(addDays(easter, 60))] = "Fronleichnam";
  }

  // Maria Himmelfahrt (Aug 15): BY, SL
  if (["BY","SL"].includes(bl)) {
    holidays[`${year}-08-15`] = "Maria Himmelfahrt";
  }

  // Weltkindertag (Sep 20): TH
  if (bl === "TH") {
    holidays[`${year}-09-20`] = "Weltkindertag";
  }

  // Reformationstag (Oct 31): BB, HB, HH, MV, NI, SN, ST, SH, TH
  if (["BB","HB","HH","MV","NI","SN","ST","SH","TH"].includes(bl)) {
    holidays[`${year}-10-31`] = "Reformationstag";
  }

  // Allerheiligen (Nov 1): BW, BY, NW, RP, SL
  if (["BW","BY","NW","RP","SL"].includes(bl)) {
    holidays[`${year}-11-01`] = "Allerheiligen";
  }

  // Buß- und Bettag (Wednesday before Nov 23): SN only
  if (bl === "SN") {
    holidays[fmt(bussBettag(year))] = "Buß- und Bettag";
  }

  return holidays;
}
