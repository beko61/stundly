/**
 * Rufbereitschaft: was bringt ein Dienst (z.B. eine Notdienst-Woche)?
 *
 * - Bereitschaft selbst: Gesetzlich keine Vergütungspflicht — bezahlt wird, was Arbeits-/Tarifvertrag
 *   vorsehen. Zwei übliche Modelle:
 *     "stunden":   Tagespauschale in Stundenlöhnen (TVöD § 8 Abs. 3: Mo–Fr 2, Sa/So/Feiertag 4)
 *     "pauschale": fester Euro-Betrag pro Tag (Mo–Fr / Sa, So, Feiertag)
 * - Einsätze sind Arbeitszeit → Stundenlohn × Einsatzzeit (mindestens Mindestlohn).
 * Zuschläge für Nacht/Sonntag/Feiertag rechnet der Zuschlagsrechner (§ 3b EStG).
 */

export type RufModell = "stunden" | "pauschale";

export interface RufInput {
  stundenlohn:      number;
  modell:           RufModell;
  tageWerktag:      number;  // Bereitschaftstage Mo–Fr
  tageWochenende:   number;  // Bereitschaftstage Sa, So, Feiertag
  faktorWerktag:    number;  // Stundenlöhne pro Tag (Modell "stunden")
  faktorWochenende: number;
  euroWerktag:      number;  // € pro Tag (Modell "pauschale")
  euroWochenende:   number;
  einsatzMinuten:   number;
}

export interface RufResult {
  bereitschaftEuro: number;
  einsatzEuro:      number;
  gesamtEuro:       number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const n = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);

export function calcRufbereitschaft(i: RufInput): RufResult {
  const lohn = n(i.stundenlohn);
  const proTagWerktag    = i.modell === "stunden" ? n(i.faktorWerktag) * lohn    : n(i.euroWerktag);
  const proTagWochenende = i.modell === "stunden" ? n(i.faktorWochenende) * lohn : n(i.euroWochenende);
  const bereitschaftEuro = round2(n(i.tageWerktag) * proTagWerktag + n(i.tageWochenende) * proTagWochenende);
  const einsatzEuro      = round2(n(i.einsatzMinuten) / 60 * lohn);
  return { bereitschaftEuro, einsatzEuro, gesamtEuro: round2(bereitschaftEuro + einsatzEuro) };
}
