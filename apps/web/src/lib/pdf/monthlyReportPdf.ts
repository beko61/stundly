/**
 * Monatsbericht PDF — Almanya iş saati aylık raporu
 * Ported & adapted from internettesiz HTML's generateMonthPDF.
 *
 * İçerik:
 *   1. Header (firma + adres)
 *   2. Başlık (Monatsbericht + ay/yıl + Mitarbeiter)
 *   3. ZUSAMMENFASSUNG (5 satır özet)
 *   4. TAGESÜBERSICHT (gün gün tablo, hafta sonu zebra)
 *   5. NOTDIENST-DETAILS (varsa)
 *   6. UNTERSCHRIFT (imza alanı)
 */

import type { TimeEntry } from "@workly/shared";

const MONTHS_DE = [
  "Januar","Februar","März","April","Mai","Juni",
  "Juli","August","September","Oktober","November","Dezember"
];
const TAGE_KURZ = ["So","Mo","Di","Mi","Do","Fr","Sa"];

export interface NotdienstEntry {
  date:       string;
  start_time: string;
  end_time:   string;
  hours?:     string;      // "HH:MM" — opsiyonel, hesaplanır
  erledigt?:  boolean;     // ödendi/tamamlandı
  bezahlt?:   boolean;     // alternatif isim
  note?:      string | null;
  kunde?:     string | null;
}

export interface ProfileInfo {
  vorname?:        string;
  nachname?:       string;
  personal_nr?:    string;
  company_name?:   string;
  company_address?: string;
  company_phone?:   string;
  company_email?:   string;
  logo_data?:      string | null;  // base64
}

export interface MonthlyReportInput {
  year:       number;
  month:      number; // 1-12
  entries:    TimeEntry[];
  notdienst:  NotdienstEntry[];
  feiertage:  Record<string, string>;
  profile:    ProfileInfo;
  /** Wochen-Soll: Mo-Do, Fr default (Hannover standard) */
  standardTimes?: {
    monThu: { startMin: number; pauseMin: number; endMin: number };
    fri:    { startMin: number; pauseMin: number; endMin: number };
  };
}

// ───────────────────────────────────────────────────────────────
// Yardımcı fonksiyonlar
// ───────────────────────────────────────────────────────────────

function timeToMins(t: string | null | undefined): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minsToTime(m: number): string {
  const sign  = m < 0 ? "-" : "";
  const abs   = Math.abs(m);
  const h     = Math.floor(abs / 60);
  const mm    = abs % 60;
  return `${sign}${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function calcEntryMinutes(e: TimeEntry): number {
  if (!e.start_time || !e.end_time) return 0;
  const s = timeToMins(e.start_time);
  let n = timeToMins(e.end_time) - s;
  if (n < 0) n += 24 * 60; // overnight
  return Math.max(0, n - (e.break_minutes ?? 0));
}

function getDayStdMins(dow: number, std: NonNullable<MonthlyReportInput["standardTimes"]>): number {
  if (dow === 0 || dow === 6) return 0; // hafta sonu
  if (dow === 5) return std.fri.endMin - std.fri.startMin - std.fri.pauseMin;
  return std.monThu.endMin - std.monThu.startMin - std.monThu.pauseMin;
}

const DEFAULT_STD = {
  monThu: { startMin: 7 * 60 + 45, pauseMin: 60, endMin: 17 * 60 },        // 07:45-17:00 mit 60 Pause = 8:15
  fri:    { startMin: 7 * 60 + 45, pauseMin: 30, endMin: 14 * 60 + 30 },   // 07:45-14:30 mit 30 Pause = 6:15
};

// ───────────────────────────────────────────────────────────────
// Aylık istatistik hesabı
// ───────────────────────────────────────────────────────────────

interface MonthStats {
  arbeitstage:  number;
  workedMins:   number;
  standardMins: number;
  diffMins:     number;
  urlaub:       number;
  krank:        number;
  notdienstCount: number;
  ndPaid:       number;
  feiertage:    number;
  ndMins:       number;
}

function calcMonthStats(input: MonthlyReportInput): MonthStats {
  const std = input.standardTimes ?? DEFAULT_STD;
  const daysInMonth = new Date(input.year, input.month, 0).getDate();
  const entryMap = new Map(input.entries.map(e => [e.date, e]));

  let arbeitstage = 0;
  let workedMins = 0;
  let standardMins = 0;
  let urlaub = 0;
  let krank = 0;
  let feiertage = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${input.year}-${pad2(input.month)}-${pad2(d)}`;
    const dow = new Date(input.year, input.month - 1, d).getDay();
    const e = entryMap.get(dateStr);
    const isFeiertag = !!input.feiertage[dateStr];

    if (dow !== 0 && dow !== 6 && !isFeiertag) {
      arbeitstage++;
      standardMins += getDayStdMins(dow, std);
    }

    if (isFeiertag) feiertage++;
    if (!e) continue;

    switch (e.day_type) {
      case "arbeiten":
        workedMins += calcEntryMinutes(e);
        break;
      case "urlaub":
        urlaub++;
        workedMins += getDayStdMins(dow, std);
        break;
      case "krank":
        krank++;
        workedMins += getDayStdMins(dow, std);
        break;
      case "feiertag":
        // Bayramda saat eklemek yerine sadece flag (zaten standardMins'a kayıtlı)
        break;
    }
  }

  const ndMins = input.notdienst.reduce((sum, nd) => {
    const start = timeToMins(nd.start_time);
    let n = timeToMins(nd.end_time) - start;
    if (n < 0) n += 24 * 60;
    return sum + Math.max(0, n);
  }, 0);

  const notdienstCount = input.notdienst.length;
  const ndPaid = input.notdienst.filter(nd => nd.erledigt || nd.bezahlt).length;

  return {
    arbeitstage,
    workedMins,
    standardMins,
    diffMins: workedMins + ndMins - standardMins,
    urlaub,
    krank,
    notdienstCount,
    ndPaid,
    feiertage,
    ndMins,
  };
}

// ───────────────────────────────────────────────────────────────
// Ana fonksiyon — PDF üret + indir
// ───────────────────────────────────────────────────────────────

export async function generateMonthlyReportPDF(input: MonthlyReportInput): Promise<void> {
  const { default: jsPDF } = await import("jspdf");

  const std = input.standardTimes ?? DEFAULT_STD;
  const stats = calcMonthStats(input);
  const gesamtMit = stats.workedMins + stats.ndMins;
  const daysInMonth = new Date(input.year, input.month, 0).getDate();
  const entryMap = new Map(input.entries.map(e => [e.date, e]));

  const maName = [input.profile.vorname, input.profile.nachname].filter(Boolean).join(" ") || "Mitarbeiter";

  const heute = new Date();
  const heuteStr = `${pad2(heute.getDate())}.${pad2(heute.getMonth()+1)}.${heute.getFullYear()}`;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, L = 14, R = 196, CW = R - L;
  let y = 14;

  const checkPage = (need: number) => {
    if (y + need > 285) { doc.addPage(); y = 16; }
  };

  // Logo
  if (input.profile.logo_data) {
    try {
      doc.addImage(input.profile.logo_data, "PNG", W/2 - 7, y, 14, 14);
      y += 16;
    } catch { y += 2; }
  }

  // Firma adı + adres
  doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
  doc.text(input.profile.company_name || "Stundly", W/2, y, { align: "center" });
  y += 4.5;
  if (input.profile.company_address || input.profile.company_phone || input.profile.company_email) {
    doc.setFontSize(7); doc.setFont("helvetica", "normal");
    const parts = [
      input.profile.company_address,
      input.profile.company_phone ? `Tel. ${input.profile.company_phone}` : null,
      input.profile.company_email,
    ].filter(Boolean).join(" | ");
    doc.text(parts, W/2, y, { align: "center" });
    y += 4;
  }
  doc.setDrawColor(80); doc.setLineWidth(0.4); doc.line(L, y, R, y); y += 7;

  // Başlık
  doc.setFontSize(14); doc.setFont("helvetica", "bold");
  doc.text("MONATSBERICHT ARBEITSZEIT", W/2, y, { align: "center" }); y += 6;
  doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text(`${MONTHS_DE[input.month - 1]} ${input.year}`, W/2, y, { align: "center" }); y += 5;
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  const headerInfo = `Mitarbeiter: ${maName}` + (input.profile.personal_nr ? `   Pers-Nr.: ${input.profile.personal_nr}` : "");
  doc.text(headerInfo, W/2, y, { align: "center" }); y += 8;

  // Section helper
  const secTitle = (t: string) => {
    checkPage(12);
    doc.setFillColor(60, 60, 60);
    doc.rect(L, y - 4, CW, 6, "F");
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(255);
    doc.text(t, L + 2, y); doc.setTextColor(0); y += 7;
  };

  // ===== ZUSAMMENFASSUNG =====
  secTitle("ZUSAMMENFASSUNG");
  const sumRow = (l1: string, v1: string | number, l2: string, v2: string | number) => {
    doc.setFontSize(8.5); doc.setFont("helvetica", "normal");
    doc.text(l1, L + 2, y); doc.setFont("helvetica", "bold");
    doc.text(String(v1), L + 48, y);
    doc.setFont("helvetica", "normal"); doc.text(l2, L + 98, y);
    doc.setFont("helvetica", "bold"); doc.text(String(v2), L + 150, y);
    doc.setDrawColor(225); doc.setLineWidth(0.1); doc.line(L, y + 1.5, R, y + 1.5); y += 5.5;
  };
  sumRow("Arbeitstage:", stats.arbeitstage, "Gearbeitet:", `${minsToTime(stats.workedMins)} Std`);
  sumRow("Soll-Stunden:", `${minsToTime(stats.standardMins)} Std`, "Differenz:", `${stats.diffMins >= 0 ? "+" : ""}${minsToTime(stats.diffMins)}`);
  sumRow("Notdienst:", `${stats.notdienstCount}x  (${minsToTime(stats.ndMins)} Std)`, "davon bezahlt:", `${stats.ndPaid} / ${stats.notdienstCount}`);
  sumRow("Urlaub:", `${stats.urlaub} Tage`, "Krank:", `${stats.krank} Tage`);
  sumRow("Feiertage:", `${stats.feiertage} Tage`, "GESAMT mit Nd:", `${minsToTime(gesamtMit)} Std`);
  y += 4;

  // ===== TAGESÜBERSICHT =====
  secTitle("TAGESUEBERSICHT");
  const cx = [L + 1, L + 18, L + 30, L + 72, L + 96, L + 120, L + 150];
  const thRow = () => {
    doc.setFillColor(235, 235, 235); doc.rect(L, y - 4, CW, 5.5, "F");
    doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(40);
    doc.text("Datum", cx[0]!, y); doc.text("Tag", cx[1]!, y); doc.text("Status", cx[2]!, y);
    doc.text("Start", cx[3]!, y); doc.text("Pause", cx[4]!, y); doc.text("Ende", cx[5]!, y);
    doc.text("Std", cx[6]!, y);
    doc.setTextColor(0); y += 5.5;
  };
  thRow();
  doc.setFontSize(7.5);

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${input.year}-${pad2(input.month)}-${pad2(d)}`;
    const dow = new Date(input.year, input.month - 1, d).getDay();
    const weekend = dow === 0 || dow === 6;
    const isFeiertag = !!input.feiertage[dateStr];
    const e = entryMap.get(dateStr);

    checkPage(6);
    if (y === 16) { thRow(); doc.setFontSize(7.5); }

    let status = "Frei";
    if (e?.day_type === "arbeiten")     status = "Arbeiten";
    else if (e?.day_type === "urlaub")  status = "Urlaub";
    else if (e?.day_type === "krank")   status = "Krank";
    else if (isFeiertag || e?.day_type === "feiertag") status = "Feiertag";
    else if (weekend) status = "Wochenende";

    if (weekend) {
      doc.setFillColor(247, 247, 247); doc.rect(L, y - 3.6, CW, 5, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(weekend ? 130 : 0);

    doc.text(`${pad2(d)}.${pad2(input.month)}.`, cx[0]!, y);
    doc.text(TAGE_KURZ[dow]!, cx[1]!, y);
    doc.text(status, cx[2]!, y);

    const showTimes = e?.day_type === "arbeiten" && e.start_time;
    if (showTimes && e) {
      doc.text(e.start_time ?? "-", cx[3]!, y);
      doc.text(e.break_minutes != null ? `${pad2(Math.floor(e.break_minutes/60))}:${pad2(e.break_minutes%60)}` : "-", cx[4]!, y);
      doc.text(e.end_time ?? "-", cx[5]!, y);
    } else {
      doc.text("-", cx[3]!, y); doc.text("-", cx[4]!, y); doc.text("-", cx[5]!, y);
    }

    // Std column
    let dStd = "";
    if (status === "Arbeiten" && e) {
      dStd = minsToTime(calcEntryMinutes(e));
    } else if (status === "Urlaub" || status === "Krank" || status === "Feiertag") {
      dStd = minsToTime(getDayStdMins(dow, std));
    }
    doc.setFont("helvetica", "bold");
    doc.text(dStd || "-", cx[6]!, y);
    doc.setTextColor(0);
    y += 4.8;
  }

  // Summe-Zeile
  checkPage(8);
  doc.setDrawColor(80); doc.setLineWidth(0.3); doc.line(L, y - 1, R, y - 1); y += 3;
  doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
  doc.text("Summe Arbeitszeit (ohne Notdienst):", cx[0]!, y);
  doc.text(`${minsToTime(stats.workedMins)} Std`, cx[6]! - 4, y);
  y += 8;

  // ===== NOTDIENST-DETAILS =====
  if (input.notdienst.length > 0) {
    checkPage(20);
    secTitle(`NOTDIENST-DETAILS (${input.notdienst.length} Einsaetze)`);
    const nx = [L + 1, L + 16, L + 28, L + 58, L + 74, L + 92];
    doc.setFillColor(235, 235, 235); doc.rect(L, y - 4, CW, 5.5, "F");
    doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(40);
    doc.text("Datum", nx[0]!, y); doc.text("Tag", nx[1]!, y); doc.text("Zeit", nx[2]!, y);
    doc.text("Std", nx[3]!, y); doc.text("Bezahlt", nx[4]!, y); doc.text("Kunde / Notiz", nx[5]!, y);
    doc.setTextColor(0); y += 5.5;
    doc.setFontSize(7.5);

    let ndSum = 0;
    for (const nd of input.notdienst) {
      checkPage(6);
      const sMin = timeToMins(nd.start_time);
      let durMin = timeToMins(nd.end_time) - sMin;
      if (durMin < 0) durMin += 24 * 60;
      ndSum += durMin;
      const std = minsToTime(durMin);
      const dateParts = nd.date.split("-");
      const dayNum = parseInt(dateParts[2] ?? "1", 10);
      const dow = new Date(input.year, input.month - 1, dayNum).getDay();
      const paid = nd.erledigt ?? nd.bezahlt ?? false;

      doc.setFont("helvetica", "normal");
      doc.text(`${pad2(dayNum)}.${pad2(input.month)}.`, nx[0]!, y);
      doc.text(TAGE_KURZ[dow]!, nx[1]!, y);
      doc.text(`${nd.start_time || "--"}-${nd.end_time || "--"}`, nx[2]!, y);
      doc.setFont("helvetica", "bold"); doc.text(std, nx[3]!, y);
      doc.setFont("helvetica", "normal");
      if (paid) doc.setTextColor(20, 120, 40); else doc.setTextColor(200, 50, 40);
      doc.text(paid ? "JA" : "NEIN", nx[4]!, y);
      doc.setTextColor(0);
      const kunde = (nd.kunde || nd.note || "").substring(0, 52);
      doc.text(kunde, nx[5]!, y);
      y += 4.8;
    }
    checkPage(8);
    doc.setDrawColor(80); doc.setLineWidth(0.3); doc.line(L, y - 1, R, y - 1); y += 3;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
    doc.text("Summe Notdienst:", nx[0]!, y);
    doc.text(`${minsToTime(ndSum)} Std   (${stats.ndPaid} bezahlt, ${stats.notdienstCount - stats.ndPaid} offen)`, nx[3]! - 2, y);
    y += 8;
  }

  // ===== UNTERSCHRIFT =====
  checkPage(28);
  y = Math.max(y, 265);
  doc.setDrawColor(80); doc.setLineWidth(0.3);
  doc.line(L, y, L + 70, y);
  doc.line(R - 70, y, R, y);
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
  doc.text(`Mitarbeiter/in — ${heuteStr}`, L + 35, y + 4, { align: "center" });
  doc.text("Vorgesetzte/r — Datum", R - 35, y + 4, { align: "center" });
  y += 12;
  doc.setFontSize(6.5); doc.setTextColor(140);
  doc.text(`Erstellt am ${heuteStr} mit Stundly`, W/2, y, { align: "center" });

  doc.save(`Monatsbericht_${MONTHS_DE[input.month - 1]}_${input.year}.pdf`);
}
