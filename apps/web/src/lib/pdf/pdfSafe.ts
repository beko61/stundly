import type { jsPDF } from "jspdf";

/**
 * jsPDF-Standardschriften (Helvetica & Co.) können nur Latin-1 (U+0000–U+00FF).
 * Alles darüber wird STILL entfernt — "18:10 – 19:40" wurde zu "18:10  19:40",
 * "Name — Datum" zu "Name  Datum", Anführungszeichen/€ aus Nutzertexten verschwanden.
 * Typografische Zeichen deshalb auf Latin-1-Entsprechungen abbilden.
 */
const MAP: Record<string, string> = {
  "–": "-", "—": "-", "‒": "-", "−": "-", "‑": "-",  // – — ‒ − ‑
  "•": "·", "‣": "·", "●": "·",                // • ‣ ● → ·
  "…": "...",                                                             // …
  "„": "\"", "“": "\"", "”": "\"", "«": "\"", "»": "\"", // „ “ ” (« » sind Latin-1, trotzdem vereinheitlicht)
  "‚": "'", "‘": "'", "’": "'",                                 // ‚ ‘ ’
  "€": "EUR",                                                             // €
  "→": "->", "←": "<-",                                              // → ←
  "✓": "x", "✔": "x", "✅": "x",                                 // ✓ ✔ ✅
  " ": " ", " ": " ", "​": "",                                  // schmale/ Null-Leerzeichen
};

export function pdfSafe(text: string): string {
  return text.replace(/[^\u0000-ÿ]/gu, ch => MAP[ch] ?? "");
}

/** doc.text / splitTextToSize so umhüllen, dass jeder Text automatisch pdfSafe ist. */
export function makePdfTextSafe(doc: jsPDF): jsPDF {
  const text = doc.text.bind(doc);
  const split = doc.splitTextToSize.bind(doc);
  const clean = (t: string | string[]) => (Array.isArray(t) ? t.map(pdfSafe) : pdfSafe(t));
  doc.text = ((t: string | string[], ...rest: unknown[]) =>
    (text as (...a: unknown[]) => jsPDF)(clean(t), ...rest)) as jsPDF["text"];
  doc.splitTextToSize = ((t: string, ...rest: unknown[]) =>
    (split as (...a: unknown[]) => string[])(pdfSafe(t), ...rest)) as jsPDF["splitTextToSize"];
  return doc;
}
