/**
 * Almanya 2024 vergi & netto hesaplama
 * Ported from internettesiz HTML (production-tested with ±2% accuracy
 * for medium/high brutto vs. official Lohnsteuertabelle).
 *
 * Sources:
 *  - EStG §32a (Einkommensteuergesetz 2024)
 *  - Sozialversicherung 2024 Beitragssätze
 *  - Soli: SolZG §3 Freigrenze + Milderungszone
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
}

// ───────────────────────────────────────────────────────────────
// EStG §32a 2024 — Einkommensteuer-Grundtabelle (yıllık ESt)
// zvE: zu versteuerndes Einkommen (yıllık)
// ───────────────────────────────────────────────────────────────
export function estGrundtabelle(zvE: number): number {
  if (zvE <= 11604) return 0;
  if (zvE <= 17005) {
    const y = (zvE - 11604) / 10000;
    return Math.round((922.98 * y + 1400) * y);
  }
  if (zvE <= 66760) {
    const y = (zvE - 17005) / 10000;
    return Math.round((181.19 * y + 2397) * y + 1025.38);
  }
  if (zvE <= 277825) return Math.round(0.42 * zvE - 10602.13);
  return Math.round(0.45 * zvE - 18936.88);
}

// ───────────────────────────────────────────────────────────────
// Sozialversicherung — Arbeitnehmer-Anteil (aylık)
// ───────────────────────────────────────────────────────────────
interface SVResult { rv: number; av: number; kv: number; pv: number; total: number; }

export function calcSV(monthBrutto: number, hatKinder: boolean): SVResult {
  const BBG_KV = 5175;  // Beitragsbemessungsgrenze KV/PV aylık 2024
  const BBG_RV = 7550;  // BBG RV/AV aylık 2024 (West)
  const kvBase = Math.min(monthBrutto, BBG_KV);
  const rvBase = Math.min(monthBrutto, BBG_RV);
  const rv = rvBase * 0.093;             // 9,3% Arbeitnehmer
  const av = rvBase * 0.013;             // 1,3%
  const kv = kvBase * (0.073 + 0.0085);  // 7,3% + Ø Zusatzbeitrag/2 = 8,15%
  const pv = kvBase * (hatKinder ? 0.017 : 0.0235); // 1,7% mit Kind, 2,35% ohne (Zuschlag)
  return { rv, av, kv, pv, total: rv + av + kv + pv };
}

// ───────────────────────────────────────────────────────────────
// Vorsorgepauschale (yıllık) — Lohnsteuer hesabında düşülür
// RV 100% AN-Anteil + KV/PV BBG'ye kadar
// ───────────────────────────────────────────────────────────────
export function calcVorsorgePauschale(monthBrutto: number, hatKinder: boolean): number {
  const BBG_KV = 5175, BBG_RV = 7550;
  const vRv = Math.min(monthBrutto, BBG_RV) * 0.093 * 12;
  const vKv = Math.min(monthBrutto, BBG_KV) * (0.073 + 0.0085) * 12;
  const vPv = Math.min(monthBrutto, BBG_KV) * (hatKinder ? 0.017 : 0.0235) * 12;
  return vRv + vKv + vPv;
}

// ───────────────────────────────────────────────────────────────
// Aylık Lohnsteuer — Steuerklasse'ye göre
// ───────────────────────────────────────────────────────────────
export function calcLohnsteuerMonat(
  monthBrutto: number,
  stk: Steuerklasse,
  hatKinder: boolean
): number {
  if (monthBrutto <= 0) return 0;
  const annual = monthBrutto * 12;
  const arbeitnehmerPB = 1230;  // Arbeitnehmer-Pauschbetrag yıllık 2024
  const sonderPB       = 36;    // Sonderausgaben-Pauschbetrag
  const vorsorge       = calcVorsorgePauschale(monthBrutto, hatKinder);

  let st = 0;
  switch (stk) {
    case "I":
    case "IV": {
      const zvE = Math.max(0, annual - arbeitnehmerPB - sonderPB - vorsorge);
      st = estGrundtabelle(zvE);
      break;
    }
    case "II": {
      // Klasse II: Entlastungsbetrag für Alleinerziehende
      const zvE = Math.max(0, annual - arbeitnehmerPB - sonderPB - vorsorge - 4260);
      st = estGrundtabelle(zvE);
      break;
    }
    case "III": {
      // Splittingtarif (zvE/2 → x2)
      const zvE = Math.max(0, annual - arbeitnehmerPB - sonderPB - vorsorge);
      st = estGrundtabelle(zvE / 2) * 2;
      break;
    }
    case "V": {
      // Klasse V: höhere Belastung (zvE + Grundfreibetrag, ×1.20)
      const zvE = Math.max(0, annual - arbeitnehmerPB - sonderPB - vorsorge);
      st = estGrundtabelle(zvE + 11604) * 1.20;
      break;
    }
    case "VI": {
      // Klasse VI: kein Werbungskostenpauschbetrag (zweites Arbeitsverhältnis)
      const zvE = Math.max(0, annual - vorsorge);
      st = estGrundtabelle(zvE + 11604) * 1.15;
      break;
    }
  }
  return Math.max(0, st / 12);
}

// ───────────────────────────────────────────────────────────────
// Solidaritätszuschlag (Soli) — Freigrenze + Milderungszone
// ───────────────────────────────────────────────────────────────
export function calcSoliMonat(lohnsteuerMonat: number, stk: Steuerklasse): number {
  const lstYear = lohnsteuerMonat * 12;
  const grenze  = stk === "III" ? 36260 : 18130; // Freigrenze yıllık 2024
  if (lstYear <= grenze) return 0;
  const max    = lstYear * 0.055;              // max 5.5%
  const milder = (lstYear - grenze) * 0.119;   // Milderungszone
  return Math.min(milder, max) / 12;
}

// ───────────────────────────────────────────────────────────────
// Ana fonksiyon: Brutto → Netto + tüm abzüg detayı
// ───────────────────────────────────────────────────────────────
export function calcNettoFromBrutto(input: NettoCalcInput): NettoBreakdown {
  const { monthBrutto, steuerklasse, kirchensteuer, hatKinder, taxMode, manuellAbzug } = input;

  if (monthBrutto <= 0) {
    return {
      netto: 0,
      abzuege: { gesamt: 0, lohnsteuer: 0, soli: 0, kirchensteuer: 0, rv: 0, av: 0, kv: 0, pv: 0, sv: 0 },
    };
  }

  // Manuel mod — sabit % düşür
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

  // Otomatik mod — gerçek hesaplama
  const sv   = calcSV(monthBrutto, hatKinder);
  const lst  = calcLohnsteuerMonat(monthBrutto, steuerklasse, hatKinder);
  const soli = calcSoliMonat(lst, steuerklasse);
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

// ───────────────────────────────────────────────────────────────
// Yardımcı: Tüm yıl için netto serisi
// ───────────────────────────────────────────────────────────────
export function calcYearlyNettoSeries(
  monthlyBruttos: number[],   // length 12
  baseInput: Omit<NettoCalcInput, "monthBrutto">
): { month: number; brutto: number; netto: number; abzuege: NettoBreakdown["abzuege"] }[] {
  return monthlyBruttos.map((brutto, idx) => {
    const r = calcNettoFromBrutto({ ...baseInput, monthBrutto: brutto });
    return { month: idx + 1, brutto, netto: r.netto, abzuege: r.abzuege };
  });
}
