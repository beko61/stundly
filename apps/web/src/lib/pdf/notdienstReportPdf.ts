/**
 * Notdienst-Bericht als PDF (A4) — Briefkopf wie der Monatsbericht, dann Einsatzdaten,
 * Problem / Ergebnis / Notiz und Unterschriften (Techniker + Kunde).
 * Fotos werden NICHT eingebettet: Auftraggeber wollen sie als einzelne Dateien (zum
 * Weiterleiten) — der Bericht nennt nur die Anzahl, geteilt werden PDF + JPEGs zusammen.
 * Gibt einen Blob zurück; Teilen/Download übernimmt der Aufrufer (lib/share/shareFile).
 */

import { makePdfTextSafe } from "./pdfSafe";

/** Link in der Fußzeile ("Erstellt mit Stundly") */
const STUNDLY_URL = "https://stundly.de";

export interface NotdienstReportInput {
  date:      string;  // YYYY-MM-DD
  start:     string;  // HH:MM
  end:       string;
  duration:  string;  // z.B. "1h 30m"
  kunde:     string;
  telefon:   string;  // Telefon des Kunden
  adresse:   string;
  problem:   string;
  ergebnis:  string;
  note:      string;
  fotoAnzahl: number;                                           // Fotos gehen als separate Dateien mit
  signature: { data: string; name: string; signedAt: string } | null;
  firma: {
    name: string; strasse?: string; plz?: string; ort?: string;
    telefon?: string; email?: string; logo?: string | null;
  };
  techniker: { name: string; signature?: string | null };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function formatDateDE(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function formatDateTimeDE(iso: string): string {
  const t = new Date(iso);
  return `${pad2(t.getDate())}.${pad2(t.getMonth() + 1)}.${t.getFullYear()} ${pad2(t.getHours())}:${pad2(t.getMinutes())}`;
}

/** "PNG" / "JPEG" aus der Data-URL — jsPDF braucht das Format explizit. */
function imgFormat(dataUrl: string): "PNG" | "JPEG" {
  return /^data:image\/png/i.test(dataUrl) ? "PNG" : "JPEG";
}

function kundeSlug(kunde: string): string {
  return kunde.trim()
    .replace(/[äÄ]/g, "ae").replace(/[öÖ]/g, "oe").replace(/[üÜ]/g, "ue").replace(/ß/g, "ss")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

export function reportFileName(date: string, kunde: string): string {
  const slug = kundeSlug(kunde);
  return `Notdienst-Bericht_${date}${slug ? `_${slug}` : ""}.pdf`;
}

/** Foto-Anhang: "Notdienst_2026-09-27_Frau-Kraft_Foto-1.jpg" */
export function fotoFileName(date: string, kunde: string, nr: number, mime = "image/jpeg"): string {
  const slug = kundeSlug(kunde);
  const ext = mime === "image/png" ? "png" : "jpg";
  return `Notdienst_${date}${slug ? `_${slug}` : ""}_Foto-${nr}.${ext}`;
}

export async function generateNotdienstReportPdf(input: NotdienstReportInput): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  const doc = makePdfTextSafe(new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }));
  const W = 210, L = 14, R = 196, CW = R - L, BOTTOM = 280;
  let y = 14;

  const ensure = (need: number) => {
    if (y + need > BOTTOM) { doc.addPage(); y = 16; }
  };

  // ── Briefkopf ───────────────────────────────────────────────
  if (input.firma.logo) {
    try {
      doc.addImage(input.firma.logo, imgFormat(input.firma.logo), (W - 22) / 2, y, 22, 22);
      y += 25;
    } catch { /* Logo defekt → ohne */ }
  }
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text(input.firma.name || "Stundly", W / 2, y + 4, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  const kopf = [
    input.firma.strasse,
    [input.firma.plz, input.firma.ort].filter(Boolean).join(" "),
    input.firma.telefon ? `Tel.: ${input.firma.telefon}` : "",
    input.firma.email,
  ].filter((s): s is string => !!s && s.trim() !== "");
  for (const line of kopf) { doc.text(line, W / 2, y + 3, { align: "center" }); y += 4; }
  y += 4;
  doc.setDrawColor(80); doc.setLineWidth(0.4); doc.line(L, y, R, y); y += 8;

  // ── Titel ───────────────────────────────────────────────────
  doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text("NOTDIENST-BERICHT", W / 2, y, { align: "center" });
  y += 9;

  // ── Einsatzdaten (Label | Wert) ─────────────────────────────
  const rows: Array<[string, string]> = [
    ["Datum",    formatDateDE(input.date)],
    ["Uhrzeit",  `${input.start} – ${input.end} Uhr  (${input.duration})`],
    ["Kunde",    input.kunde],
    ["Telefon",  input.telefon],
    ["Adresse",  input.adresse],
    ["Techniker", input.techniker.name],
    ["Fotos",    input.fotoAnzahl > 0 ? `${input.fotoAnzahl} (als separate Dateien angehängt)` : ""],
  ];
  doc.setFontSize(10);
  for (const [label, value] of rows) {
    if (!value.trim()) continue;
    const lines = doc.splitTextToSize(value, CW - 32) as string[];
    ensure(lines.length * 5 + 1);
    doc.setFont("helvetica", "bold"); doc.text(`${label}:`, L, y);
    doc.setFont("helvetica", "normal"); doc.text(lines, L + 32, y);
    y += lines.length * 5 + 1;
  }
  y += 3;

  // ── Textabschnitte ──────────────────────────────────────────
  const section = (title: string, body: string, bullets = false) => {
    const text = body.trim();
    if (!text) return;
    ensure(14);
    doc.setDrawColor(200); doc.setLineWidth(0.2); doc.line(L, y - 2, R, y - 2);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(title, L, y + 3);
    y += 9;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const paras = bullets ? text.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [text];
    for (const p of paras) {
      const lines = doc.splitTextToSize(p, bullets ? CW - 6 : CW) as string[];
      ensure(lines.length * 5 + 1);
      if (bullets) doc.text("•", L + 1, y);
      doc.text(lines, bullets ? L + 6 : L, y);
      y += lines.length * 5 + 1;
    }
    y += 3;
  };
  section("Problem", input.problem);
  section("Ergebnis / Feststellungen", input.ergebnis, true);
  section("Notiz", input.note);

  // ── Unterschriften ──────────────────────────────────────────
  ensure(40);
  y += 6;
  const lineY = y + 20;
  const colW = 80;
  // Unterschrift in eine 70×18 mm-Box einpassen (Seitenverhältnis erhalten, unten bündig)
  const sig = (data: string | null | undefined, x: number) => {
    if (!data) return;
    try {
      const p = doc.getImageProperties(data);
      const s = Math.min((colW - 10) / p.width, 18 / p.height);
      const w = p.width * s, h = p.height * s;
      doc.addImage(data, imgFormat(data), x + (colW - w) / 2, y + 18 - h, w, h);
    } catch { /* ohne Bild */ }
  };
  sig(input.techniker.signature, L);
  sig(input.signature?.data, R - colW);
  doc.setDrawColor(80); doc.setLineWidth(0.3);
  doc.line(L, lineY, L + colW, lineY);
  doc.line(R - colW, lineY, R, lineY);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(`Techniker: ${input.techniker.name}`, L + colW / 2, lineY + 4, { align: "center" });
  const kundeLabel = input.signature
    ? `Kunde: ${input.signature.name || input.kunde} — ${formatDateTimeDE(input.signature.signedAt)}`
    : "Kunde — Datum";
  doc.text(kundeLabel, R - colW / 2, lineY + 4, { align: "center" });
  y = lineY + 12;

  // ── Fußzeile auf jeder Seite ────────────────────────────────
  const pages = doc.getNumberOfPages();
  const erstellt = formatDateTimeDE(new Date().toISOString());
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7); doc.setTextColor(140);
    const footer = `Erstellt am ${erstellt} mit Stundly · stundly.de · Seite ${p}/${pages}`;
    doc.text(footer, W / 2, 292, { align: "center" });
    // Fußzeile klickbar → stundly.de (Empfänger des Berichts lernen Stundly kennen)
    const fw = doc.getTextWidth(footer);
    doc.link(W / 2 - fw / 2, 289.5, fw, 3.5, { url: STUNDLY_URL });
  }

  return doc.output("blob");
}
