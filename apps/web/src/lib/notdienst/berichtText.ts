/**
 * Betreff + Mail-Text zum Notdienst-Bericht — geht beim Teilen als Text mit
 * (Outlook/Mail übernehmen ihn in den Mail-Text), zusätzlich zu PDF + Fotos als Anhang.
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

export function buildBerichtText(b: BerichtTextInput): { subject: string; body: string } {
  const subject = [`Notdienst-Bericht ${dateDE(b.date)}`, b.kunde.trim(), b.adresse.trim()]
    .filter(Boolean).join(" – ");

  const ergebnis = b.ergebnis.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(s => `• ${s}`).join("\n");
  const anhaenge = b.fotoAnzahl > 0
    ? `Anhänge: Bericht (PDF) + ${b.fotoAnzahl} Foto${b.fotoAnzahl === 1 ? "" : "s"}`
    : "Anhang: Bericht (PDF)";

  const body = [
    `Datum: ${dateDE(b.date)}`,
    `Uhrzeit: ${b.start} – ${b.end} Uhr (${b.duration})`,
    b.kunde.trim()   ? `Kunde: ${b.kunde.trim()}`     : "",
    b.telefon.trim() ? `Telefon: ${b.telefon.trim()}` : "",
    b.adresse.trim() ? `Adresse: ${b.adresse.trim()}` : "",
    b.problem.trim() ? `\nProblem:\n${b.problem.trim()}` : "",
    ergebnis         ? `\nErgebnis / Feststellungen:\n${ergebnis}` : "",
    b.note.trim()    ? `\nNotiz: ${b.note.trim()}` : "",
    `\n${anhaenge}`,
  ].filter(Boolean).join("\n");

  return { subject, body };
}
