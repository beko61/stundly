/**
 * Notdienstpauschale netto: Was bleibt von der Pauschale übrig?
 *
 * Die Pauschale ist normaler Arbeitslohn (lohnsteuer- und sozialversicherungspflichtig, BFH VI R 61/14).
 * Sie kommt zum Monatsgehalt dazu, deshalb gilt der persönliche Grenzsteuersatz:
 *   Netto der Pauschale = Netto(Gehalt + Pauschale) − Netto(Gehalt)
 * Steuer/SV: calcNettoFromBrutto (Näherung, ±2 %). Einsätze → Rufbereitschaft-Rechner.
 */

import { calcNettoFromBrutto, type Steuerklasse, type KirchensteuerRate } from "@workly/shared";

export interface NotdienstNettoInput {
  grundBrutto:       number;  // Monatsgehalt brutto ohne Notdienst
  pauschaleProWoche: number;  // € pro Notdienst-Woche
  wochen:            number;  // Notdienst-Wochen im Monat
  steuerklasse:      Steuerklasse;
  kirchensteuer:     KirchensteuerRate;
  hatKinder:         boolean;
  year:              number;
}

export interface NotdienstNettoResult {
  notdienstBrutto: number;
  notdienstNetto:  number;
  abzug:           number;  // Steuer + SV auf die Pauschale
  abzugProzent:    number;  // ganze Prozent
}

const pos = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);
const cent = (v: number) => Math.round(v * 100) / 100;

export function calcNotdienstNetto(i: NotdienstNettoInput): NotdienstNettoResult {
  const grund = pos(i.grundBrutto);
  const brutto = cent(pos(i.pauschaleProWoche) * pos(i.wochen));
  const netto = (monthBrutto: number) => calcNettoFromBrutto({
    monthBrutto, steuerklasse: i.steuerklasse, kirchensteuer: i.kirchensteuer,
    hatKinder: i.hatKinder, taxMode: "auto", year: i.year,
  }).netto;

  const notdienstNetto = cent(netto(grund + brutto) - netto(grund));
  const abzug = cent(brutto - notdienstNetto);
  return {
    notdienstBrutto: brutto,
    notdienstNetto,
    abzug,
    abzugProzent: brutto > 0 ? Math.round((abzug / brutto) * 100) : 0,
  };
}
