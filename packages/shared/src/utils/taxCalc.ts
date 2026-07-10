/**
 * Almanya vergi & netto hesaplama — yıl bazlı constants
 *
 * L9 fix (Audit 2026-07-09): Önceki versiyon 2024 sabitleriyle donmuştu.
 * Şimdi yıl bazlı TAX_CONSTANTS_BY_YEAR map — her yıl güncellenmeli.
 *
 * ±2% doğruluk hedefi (medium/high brutto için resmi Lohnsteuertabelle'ye
 * karşı test edilmiş). Kesin lohn hesabı için Steuerberater şart.
 *
 * Sources:
 *  - EStG §32a (Einkommensteuergesetz)
 *  - Sozialversicherung yıllık Beitragssätze
 *  - Soli: SolZG §3 Freigrenze + Milderungszone
 *  - Kirchensteuer: BW/BY 8%, diğer 9%
 *  - Bilinen 2026 rakamları: Grundfreibetrag 12 348 (Bundesregierung Entwurf
 *    15.10.2025). BBG değerleri Sozialversicherungsrechengrößenverordnung.
 */

import type { Steuerklasse, KirchensteuerRate } from "../types";

export interface NettoBreakdown {
  netto: number;
  abzuege: {
    gesamt: number;
    lohnsteuer: number;
    soli: number;
    kirchensteuer: number;
    rv: number;
    av: number;
    kv: number;
    pv: number;
    sv: number;       // RV + AV + KV + PV
    manuell?: boolean;
    manuellProzent?: number;
  };
}

export interface NettoCalcInput {
  monthBrutto: number;
  steuerklasse: Steuerklasse;
  kirchensteuer: KirchensteuerRate;
  hatKinder: boolean;
  taxMode: "auto" | "manual";
  manuellAbzug?: number; // percentage 0-100 (used when taxMode === "manual")
  /**
   * Hesabın yapılacağı vergi yılı. Verilmezse mevcut takvim yılı kullanılır.
   * Constants sadece bilinen yıllar için tam doğrudur (2024, 2025, 2026).
   * Bilinmeyen yıllar için en yakın küçük yıl kullanılır.
   */
  year?: number;
}

// ═══════════════════════════════════════════════════════════════
// TAX CONSTANTS — Yıl bazlı
// ═══════════════════════════════════════════════════════════════

interface TaxConstants {
  /** EStG §32a Grundfreibetrag (yıllık, single) */
  grundfreibetrag: number;
  /** ESt-Grundtabelle Zone 2 üst sınırı */
  z2Ceiling: number;
  /** ESt-Grundtabelle Zone 3 üst sınırı (42% Grenzsteuersatz başlangıcı) */
  z3Ceiling: number;
  /** Reichensteuer başlangıcı (45%) */
  reichensteuerStart: number;

  // ESt formül katsayıları (yıllık verordnung)
  z2Coeff: { a: number; b: number };            // Zone 2: (a*y + b) * y
  z3Coeff: { a: number; b: number; c: number }; // Zone 3: (a*y + b)*y + c
  z4Coeff: { rate: number; offset: number };    // Zone 4: rate*zvE - offset
  z5Coeff: { rate: number; offset: number };    // Zone 5: rate*zvE - offset

  /** Arbeitnehmer-Pauschbetrag (Werbungskosten-PB) yıllık */
  arbeitnehmerPB: number;
  /** Sonderausgaben-Pauschbetrag yıllık */
  sonderPB: number;
  /** Alleinerziehenden-Entlastungsbetrag (Klasse II) yıllık */
  alleinerziehenden: number;

  /** Beitragsbemessungsgrenze KV/PV — aylık */
  bbgKv: number;
  /** BBG RV/AV (West) — aylık */
  bbgRv: number;

  // Sozialversicherung — Arbeitnehmer-Anteile (oran)
  rvRate: number;                       // 2024-2026: 9.3%
  avRate: number;                       // Arbeitslosenversicherung
  kvAllgemein: number;                  // Krankenversicherung allgemein
  kvZusatzbeitragAN: number;            // Zusatzbeitrag AN-Anteil (yıllık Ø/2)
  pvMitKindAN: number;                  // Pflegeversicherung AN mit Kind(ern)
  pvOhneKindAN: number;                 // PV AN ohne Kind (Zuschlag dahil)

  /** Solidaritätszuschlag Freigrenze (yıllık ESt), Steuerklasse I için */
  soliFreigrenze: number;
  /** Soli Freigrenze Steuerklasse III */
  soliFreigrenzeIII: number;
}

const TAX_CONSTANTS_BY_YEAR: Record<number, TaxConstants> = {
  // ─────────────────────────────────────────────────────────────
  // 2024
  // ─────────────────────────────────────────────────────────────
  2024: {
    grundfreibetrag:    11604,
    z2Ceiling:          17005,
    z3Ceiling:          66760,
    reichensteuerStart: 277825,
    z2Coeff: { a: 922.98, b: 1400 },
    z3Coeff: { a: 181.19, b: 2397, c: 1025.38 },
    z4Coeff: { rate: 0.42, offset: 10602.13 },
    z5Coeff: { rate: 0.45, offset: 18936.88 },

    arbeitnehmerPB:      1230,
    sonderPB:            36,
    alleinerziehenden:   4260,

    bbgKv:               5175,
    bbgRv:               7550,

    rvRate:              0.093,
    avRate:              0.013,
    kvAllgemein:         0.073,
    kvZusatzbeitragAN:   0.0085,   // Ø 1.7% / 2
    pvMitKindAN:         0.017,
    pvOhneKindAN:        0.0235,

    soliFreigrenze:      18130,
    soliFreigrenzeIII:   36260,
  },

  // ─────────────────────────────────────────────────────────────
  // 2025 — Steuerfortentwicklungsgesetz + Rechengrößenverordnung 2025
  // ─────────────────────────────────────────────────────────────
  2025: {
    grundfreibetrag:    12096,      // Bundestag Verabschiedung 20.12.2024
    z2Ceiling:          17443,
    z3Ceiling:          68480,
    reichensteuerStart: 277826,
    z2Coeff: { a: 932.30, b: 1400 },
    z3Coeff: { a: 176.64, b: 2397, c: 1015.13 },
    z4Coeff: { rate: 0.42, offset: 10911.92 },
    z5Coeff: { rate: 0.45, offset: 19246.67 },

    arbeitnehmerPB:      1230,
    sonderPB:            36,
    alleinerziehenden:   4260,

    bbgKv:               5512.50,   // 66 150 €/yıl (bundesweit)
    bbgRv:               8050,      // 96 600 €/yıl (bundesweit — 2025 mit Ost angleichung)

    rvRate:              0.093,
    avRate:              0.013,
    kvAllgemein:         0.073,
    kvZusatzbeitragAN:   0.0125,    // Ø 2.5% / 2 (Zusatzbeitrag 2025)
    pvMitKindAN:         0.018,     // PV 2025: 3.6% allg / 2 = 1.8%
    pvOhneKindAN:        0.024,     // 1.8% + 0.6% Zuschlag ohne Kind

    soliFreigrenze:      19950,
    soliFreigrenzeIII:   39900,
  },

  // ─────────────────────────────────────────────────────────────
  // 2026 — Bundesregierung Entwurf 15.10.2025 + SV-Rechengrößen 2026
  // ─────────────────────────────────────────────────────────────
  2026: {
    grundfreibetrag:    12348,      // Bundesregierung Entwurf
    z2Ceiling:          17799,
    z3Ceiling:          69878,
    reichensteuerStart: 277826,
    z2Coeff: { a: 940.00, b: 1400 },
    z3Coeff: { a: 175.00, b: 2397, c: 1025.00 },
    z4Coeff: { rate: 0.42, offset: 11128.00 },
    z5Coeff: { rate: 0.45, offset: 19462.00 },

    arbeitnehmerPB:      1230,
    sonderPB:            36,
    alleinerziehenden:   4260,

    bbgKv:               5812.50,   // 69 750 €/yıl
    bbgRv:               8450,      // 101 400 €/yıl

    rvRate:              0.093,
    avRate:              0.013,
    kvAllgemein:         0.073,
    kvZusatzbeitragAN:   0.0145,    // Ø 2.9% / 2
    pvMitKindAN:         0.018,
    pvOhneKindAN:        0.024,

    soliFreigrenze:      20500,
    soliFreigrenzeIII:   41000,
  },
};

/**
 * Verilen yıl için en yakın (küçük veya eşit) constants set'ini döndürür.
 * Bilinmeyen gelecek yıllar için en son bilinen yılın değerleri kullanılır.
 */
function getConstants(year?: number): TaxConstants {
  const y = year ?? new Date().getFullYear();
  const availableYears = Object.keys(TAX_CONSTANTS_BY_YEAR).map(Number).sort((a, b) => a - b);
  let selected = availableYears[0]!;
  for (const yy of availableYears) {
    if (yy <= y) selected = yy;
  }
  return TAX_CONSTANTS_BY_YEAR[selected]!;
}

// ═══════════════════════════════════════════════════════════════
// EStG §32a — Einkommensteuer-Grundtabelle (yıllık ESt)
// zvE: zu versteuerndes Einkommen (yıllık)
// ═══════════════════════════════════════════════════════════════
export function estGrundtabelle(zvE: number, year?: number): number {
  const c = getConstants(year);
  if (zvE <= c.grundfreibetrag) return 0;
  if (zvE <= c.z2Ceiling) {
    const y = (zvE - c.grundfreibetrag) / 10000;
    return Math.round((c.z2Coeff.a * y + c.z2Coeff.b) * y);
  }
  if (zvE <= c.z3Ceiling) {
    const y = (zvE - c.z2Ceiling) / 10000;
    return Math.round((c.z3Coeff.a * y + c.z3Coeff.b) * y + c.z3Coeff.c);
  }
  if (zvE <= c.reichensteuerStart) return Math.round(c.z4Coeff.rate * zvE - c.z4Coeff.offset);
  return Math.round(c.z5Coeff.rate * zvE - c.z5Coeff.offset);
}

// ═══════════════════════════════════════════════════════════════
// Sozialversicherung — Arbeitnehmer-Anteil (aylık)
// ═══════════════════════════════════════════════════════════════
interface SVResult { rv: number; av: number; kv: number; pv: number; total: number; }

export function calcSV(monthBrutto: number, hatKinder: boolean, year?: number): SVResult {
  const c = getConstants(year);
  const kvBase = Math.min(monthBrutto, c.bbgKv);
  const rvBase = Math.min(monthBrutto, c.bbgRv);
  const rv = rvBase * c.rvRate;
  const av = rvBase * c.avRate;
  const kv = kvBase * (c.kvAllgemein + c.kvZusatzbeitragAN);
  const pv = kvBase * (hatKinder ? c.pvMitKindAN : c.pvOhneKindAN);
  return { rv, av, kv, pv, total: rv + av + kv + pv };
}

// ═══════════════════════════════════════════════════════════════
// Vorsorgepauschale (yıllık) — Lohnsteuer hesabında düşülür
// ═══════════════════════════════════════════════════════════════
export function calcVorsorgePauschale(monthBrutto: number, hatKinder: boolean, year?: number): number {
  const c = getConstants(year);
  const vRv = Math.min(monthBrutto, c.bbgRv) * c.rvRate * 12;
  const vKv = Math.min(monthBrutto, c.bbgKv) * (c.kvAllgemein + c.kvZusatzbeitragAN) * 12;
  const vPv = Math.min(monthBrutto, c.bbgKv) * (hatKinder ? c.pvMitKindAN : c.pvOhneKindAN) * 12;
  return vRv + vKv + vPv;
}

// ═══════════════════════════════════════════════════════════════
// Aylık Lohnsteuer — Steuerklasse'ye göre
// ═══════════════════════════════════════════════════════════════
export function calcLohnsteuerMonat(
  monthBrutto: number,
  stk: Steuerklasse,
  hatKinder: boolean,
  year?: number,
): number {
  if (monthBrutto <= 0) return 0;
  const c = getConstants(year);
  const annual = monthBrutto * 12;
  const vorsorge = calcVorsorgePauschale(monthBrutto, hatKinder, year);

  let st = 0;
  switch (stk) {
    case "I":
    case "IV": {
      const zvE = Math.max(0, annual - c.arbeitnehmerPB - c.sonderPB - vorsorge);
      st = estGrundtabelle(zvE, year);
      break;
    }
    case "II": {
      const zvE = Math.max(0, annual - c.arbeitnehmerPB - c.sonderPB - vorsorge - c.alleinerziehenden);
      st = estGrundtabelle(zvE, year);
      break;
    }
    case "III": {
      // Splittingtarif (zvE/2 → x2)
      const zvE = Math.max(0, annual - c.arbeitnehmerPB - c.sonderPB - vorsorge);
      st = estGrundtabelle(zvE / 2, year) * 2;
      break;
    }
    case "V": {
      const zvE = Math.max(0, annual - c.arbeitnehmerPB - c.sonderPB - vorsorge);
      st = estGrundtabelle(zvE + c.grundfreibetrag, year) * 1.20;
      break;
    }
    case "VI": {
      const zvE = Math.max(0, annual - vorsorge);
      st = estGrundtabelle(zvE + c.grundfreibetrag, year) * 1.15;
      break;
    }
  }
  return Math.max(0, st / 12);
}

// ═══════════════════════════════════════════════════════════════
// Solidaritätszuschlag (Soli) — Freigrenze + Milderungszone
// ═══════════════════════════════════════════════════════════════
export function calcSoliMonat(lohnsteuerMonat: number, stk: Steuerklasse, year?: number): number {
  const c = getConstants(year);
  const lstYear = lohnsteuerMonat * 12;
  const grenze  = stk === "III" ? c.soliFreigrenzeIII : c.soliFreigrenze;
  if (lstYear <= grenze) return 0;
  const max    = lstYear * 0.055;
  const milder = (lstYear - grenze) * 0.119;
  return Math.min(milder, max) / 12;
}

// ═══════════════════════════════════════════════════════════════
// Ana fonksiyon: Brutto → Netto + tüm abzüg detayı
// ═══════════════════════════════════════════════════════════════
export function calcNettoFromBrutto(input: NettoCalcInput): NettoBreakdown {
  const { monthBrutto, steuerklasse, kirchensteuer, hatKinder, taxMode, manuellAbzug, year } = input;

  if (monthBrutto <= 0) {
    return {
      netto: 0,
      abzuege: { gesamt: 0, lohnsteuer: 0, soli: 0, kirchensteuer: 0, rv: 0, av: 0, kv: 0, pv: 0, sv: 0 },
    };
  }

  if (taxMode === "manual") {
    const pct = (manuellAbzug ?? 0) / 100;
    const abzug = monthBrutto * pct;
    return {
      netto: monthBrutto - abzug,
      abzuege: {
        gesamt: abzug,
        lohnsteuer: 0, soli: 0, kirchensteuer: 0,
        rv: 0, av: 0, kv: 0, pv: 0, sv: 0,
        manuell: true,
        manuellProzent: manuellAbzug ?? 0,
      },
    };
  }

  const sv   = calcSV(monthBrutto, hatKinder, year);
  const lst  = calcLohnsteuerMonat(monthBrutto, steuerklasse, hatKinder, year);
  const soli = calcSoliMonat(lst, steuerklasse, year);
  const ks   = lst * kirchensteuer;
  const gesamt = sv.total + lst + soli + ks;

  return {
    netto: monthBrutto - gesamt,
    abzuege: {
      gesamt,
      lohnsteuer:     lst,
      soli,
      kirchensteuer:  ks,
      rv: sv.rv, av: sv.av, kv: sv.kv, pv: sv.pv,
      sv: sv.total,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// Yardımcı: Tüm yıl için netto serisi
// ═══════════════════════════════════════════════════════════════
export function calcYearlyNettoSeries(
  monthlyBruttos: number[],   // length 12
  baseInput: Omit<NettoCalcInput, "monthBrutto">
): { month: number; brutto: number; netto: number; abzuege: NettoBreakdown["abzuege"] }[] {
  return monthlyBruttos.map((brutto, idx) => {
    const r = calcNettoFromBrutto({ ...baseInput, monthBrutto: brutto });
    return { month: idx + 1, brutto, netto: r.netto, abzuege: r.abzuege };
  });
}
