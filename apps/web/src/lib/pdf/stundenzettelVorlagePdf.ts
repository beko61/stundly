/**
 * Stundenzettel-Vorlage (öffentliche SEO-Seite /stundenzettel-vorlage) — leerer Monats-
 * Stundenzettel zum Ausdrucken und Ausfüllen. Wochenenden grau, Feiertage vorbelegt,
 * Summen- und Unterschriftsfelder. Fußzeile verlinkt stundly.de.
 *
 * Nimmt den jsPDF-Konstruktor entgegen: die Seite lädt jsPDF beim Öffnen vor, damit der
 * Download direkt im Klick passiert (iOS blockiert Downloads nach einem await).
 */

import type { jsPDF as JsPDF } from "jspdf";
import { makePdfTextSafe } from "./pdfSafe";
import { getFeiertage } from "@/lib/utils/feiertage";

export const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const STUNDLY_URL = "https://stundly.de";

export interface VorlageInput {
  year:        number;
  month:       number;          // 1–12
  name?:       string;
  firma?:      string;
  bundesland?: string | null;   // null/leer → keine Feiertage
}

export function vorlageFileName(i: VorlageInput): string {
  return `Stundenzettel_${MONATE[i.month - 1]}_${i.year}.pdf`.replace(/ä/g, "ae");
}

const pad = (n: number) => String(n).padStart(2, "0");

export function buildStundenzettelVorlage(JsPDFCtor: typeof JsPDF, i: VorlageInput): JsPDF {
  const doc = makePdfTextSafe(new JsPDFCtor({ unit: "mm", format: "a4" }));
  const W = 210, L = 12, R = W - 12;
  const feiertage = i.bundesland ? getFeiertage(i.year, i.bundesland) : {};
  const days = new Date(i.year, i.month, 0).getDate();

  // ── Kopf ──
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(20);
  doc.text("Stundenzettel", L, 18);
  doc.setFontSize(12);
  doc.text(`${MONATE[i.month - 1]} ${i.year}`, R, 18, { align: "right" });

  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60);
  const field = (label: string, value: string | undefined, x: number, w: number, y: number) => {
    doc.text(label, x, y);
    if (value?.trim()) {
      doc.setTextColor(20); doc.text(value.trim(), x + 24, y); doc.setTextColor(60);
    }
    doc.setDrawColor(170); doc.line(x + 23, y + 1, x + w, y + 1);
  };
  field("Name:", i.name, L, 110, 28);
  field("Personal-Nr.:", undefined, L + 116, R - L - 116, 28);
  field("Firma:", i.firma, L, 110, 35);
  field("Abteilung:", undefined, L + 116, R - L - 116, 35);

  // ── Tabelle ──
  const cols = [
    { h: "Datum", w: 16 }, { h: "Tag", w: 10 }, { h: "Beginn", w: 17 }, { h: "Ende", w: 17 },
    { h: "Pause", w: 15 }, { h: "Stunden", w: 17 }, { h: "Tätigkeit / Baustelle / Notiz", w: R - L - 92 },
  ];
  const top = 42, headH = 7;
  const rowH = Math.min(6.4, 196 / (days + 1));
  let x = L;
  doc.setFillColor(40, 40, 52); doc.rect(L, top, R - L, headH, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(255);
  for (const c of cols) { doc.text(c.h, x + 1.5, top + 4.8); x += c.w; }

  doc.setFont("helvetica", "normal"); doc.setTextColor(30);
  let y = top + headH;
  for (let d = 1; d <= days; d++) {
    const date = new Date(i.year, i.month - 1, d);
    const dow = date.getDay();
    const iso = `${i.year}-${pad(i.month)}-${pad(d)}`;
    const feiertag = feiertage[iso];
    if (dow === 0 || dow === 6 || feiertag) {
      doc.setFillColor(feiertag ? 255 : 238, feiertag ? 244 : 238, feiertag ? 214 : 242);
      doc.rect(L, y, R - L, rowH, "F");
    }
    doc.setFontSize(8);
    doc.text(`${pad(d)}.${pad(i.month)}.`, L + 1.5, y + rowH - 1.9);
    doc.text(WT[dow]!, L + 17.5, y + rowH - 1.9);
    if (feiertag) {
      doc.setFont("helvetica", "italic"); doc.setTextColor(150, 100, 0);
      doc.text(feiertag, L + 93.5, y + rowH - 1.9);
      doc.setFont("helvetica", "normal"); doc.setTextColor(30);
    }
    doc.setDrawColor(205); doc.line(L, y + rowH, R, y + rowH);
    y += rowH;
  }
  // Summenzeile
  doc.setFillColor(40, 40, 52); doc.rect(L, y, R - L, rowH + 1, "F");
  doc.setFont("helvetica", "bold"); doc.setTextColor(255);
  doc.text("Summe", L + 1.5, y + rowH - 1.4);
  // Spaltenlinien
  doc.setDrawColor(190);
  x = L;
  for (const c of cols.slice(0, -1)) { x += c.w; doc.line(x, top, x, y); }
  doc.rect(L, top, R - L, y + rowH + 1 - top);
  y += rowH + 8;

  // ── Zusammenfassung + Unterschriften ──
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60);
  const boxes = ["Soll-Stunden:", "Überstunden:", "Urlaubstage:", "Krankheitstage:"];
  const bw = (R - L) / boxes.length;
  boxes.forEach((b, k) => {
    doc.text(b, L + k * bw, y);
    doc.setDrawColor(170); doc.line(L + k * bw, y + 6, L + (k + 1) * bw - 6, y + 6);
  });
  y += 20;
  doc.line(L, y, L + 80, y); doc.line(R - 80, y, R, y);
  doc.setFontSize(8);
  doc.text("Datum, Unterschrift Mitarbeiter/in", L, y + 4);
  doc.text("Datum, Unterschrift Vorgesetzte/r", R - 80, y + 4);

  // ── Fußzeile mit Link ──
  const footer = "Vorlage von Stundly · stundly.de — Arbeitszeit, Überstunden und Notdienste einfach am Handy erfassen";
  doc.setFontSize(7); doc.setTextColor(140);
  doc.text(footer, W / 2, 290, { align: "center" });
  const fw = doc.getTextWidth(footer);
  doc.link(W / 2 - fw / 2, 287.5, fw, 3.5, { url: STUNDLY_URL });

  return doc;
}
