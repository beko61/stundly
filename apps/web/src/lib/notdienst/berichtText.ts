/**
 * Betreff + Mail-Text zum Notdienst-Bericht — geht beim Teilen als Text mit
 * (Outlook/Mail übernehmen ihn in den Mail-Text), zusätzlich zu PDF + Fotos als Anhang.
 *
 * Betreff: "ND - TT.MM.JJ - Kunde - Adresse". Er steht zusätzlich als erste Zeile im Text:
 * Outlook auf dem iPhone nimmt den Betreff aus dem geteilten Text, nicht aus dem Titel.
 */

export interface BerichtTextInput {
  date:       string;  // YYYY-MM-DD
  start:      string;
  end:        string;
  duration:   string;
  kunde:      string;
  telefon:    string;
  adresse:    string;
  problem:    string;
  ergebnis:   string;
  note:       string;
  fotoAnzahl: number;
}

function dateDE(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** "2026-09-27" → "27.09.26" (Betreff) */
function dateKurz(iso: string): string {
  const [y = "", m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(-2)}`;
}

export function buildBerichtText(b: BerichtTextInput): { subject: string; body: string } {
  const subject = ["ND", dateKurz(b.date), b.kunde.trim(), b.adresse.trim()]
    .filter(Boolean).join(" - ");

  const ergebnis = b.ergebnis.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(s => `• ${s}`).join("\n");
  const anhaenge = b.fotoAnzahl > 0
    ? `Anhänge: Bericht (PDF) + ${b.fotoAnzahl} Foto${b.fotoAnzahl === 1 ? "" : "s"}`
    : "Anhang: Bericht (PDF)";

  const body = [
    `${subject}\n`,
    `Datum: ${dateDE(b.date)}`,
    `Uhrzeit: ${b.start} – ${b.end} Uhr (${b.duration})`,
    b.kunde.trim()   ? `Kunde: ${b.kunde.trim()}`     : "",
    b.telefon.trim() ? `Telefon: ${b.telefon.trim()}` : "",
    b.adresse.trim() ? `Adresse: ${b.adresse.trim()}` : "",
    b.problem.trim() ? `\nProblem:\n${b.problem.trim()}` : "",
    ergebnis         ? `\nErgebnis / Feststellungen:\n${ergebnis}` : "",
    b.note.trim()    ? `\nNotiz: ${b.note.trim()}` : "",
    `\n${anhaenge}`,
    // Dezente Absenderzeile — Empfänger (Auftraggeber, Kollegen) lernen Stundly kennen
    `\n—\nErstellt mit Stundly · https://stundly.de`,
  ].filter(Boolean).join("\n");

  return { subject, body };
}
