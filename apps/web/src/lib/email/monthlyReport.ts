/**
 * Monthly Report Email — retention #2.
 *
 * Vercel Cron her ayın 1'inde 06:00 UTC tetikler
 * (`/api/cron/monthly-report`). Önceki ayın özet raporu.
 *
 * MVP: PDF ek yok — /reports?year=X&month=Y linki ile PDF indirilebilir.
 * PDF ek server-side render (@react-pdf/renderer Node.js OK ama email ek
 * boyutu Resend limit + attachment complexity artıyor).
 */

import { Resend } from "resend";
import type { TimeEntry } from "@workly/shared";
import {
  findDailyCapViolations,
  calcKrankheitEpisodes,
  ENTGFG_KRANKHEIT_LIMIT_DAYS,
} from "@workly/shared";
import { netMinutesForEntry } from "@/lib/company/admin";
import { notdienstBelongsToMonth } from "@/lib/utils/weekMonth";

const FROM = "Stundly <noreply@stundly.de>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const MONTHS_DE = [
  "Januar","Februar","März","April","Mai","Juni",
  "Juli","August","September","Oktober","November","Dezember",
];

export interface MonthlyReportNotdienst {
  date:       string;
  start_time: string | null;
  end_time:   string | null;
}

export interface MonthlyReportInput {
  year:        number;
  month:       number;   // 1-12
  entries:     TimeEntry[];  // O ayın time_entries'i
  notdienst:   MonthlyReportNotdienst[]; // Notdienst-Wochen-Zuordnung UYGULANMIŞ
  yearEntries: TimeEntry[]; // Yıllık — 6-Wochen Krank hesabı için
}

export interface MonthlyReportStats {
  monthLabel:            string;
  monthWorkedMin:        number;
  monthWorkedDays:       number;
  monthUrlaubDays:       number;
  monthKrankDays:        number;
  monthNotdienstDays:    number;
  capViolations:         string[];
  krankheitOverLimit:    number;
  reportUrl:             string;
}

function pad2(n: number): string { return String(n).padStart(2, "0"); }

function minToHhMm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${pad2(m)}m`;
}

/** Verilen ay için özet hesabı. `notdienst` zaten week-Sunday-attribution UYGULANMIŞ olmalı. */
export function computeMonthlyReportStats(input: MonthlyReportInput): MonthlyReportStats {
  const { year, month, entries, notdienst, yearEntries } = input;
  const monthStart = `${year}-${pad2(month)}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${pad2(month)}-${pad2(daysInMonth)}`;

  const monthEntries = entries.filter((e) => e.date >= monthStart && e.date <= monthEnd);
  const monthWorkedMin = monthEntries
    .filter((e) => e.day_type === "arbeiten")
    .reduce((s, e) => s + netMinutesForEntry(e), 0);
  const monthWorkedDays  = monthEntries.filter((e) => e.day_type === "arbeiten").length;
  const monthUrlaubDays  = monthEntries.filter((e) => e.day_type === "urlaub").length;
  const monthKrankDays   = monthEntries.filter((e) => e.day_type === "krank").length;
  const monthNotdienstDays = notdienst
    .filter((n) => notdienstBelongsToMonth(n.date, year, month))
    .length;

  const capViolations = findDailyCapViolations(monthEntries).map((v) => v.date);
  const krankheitOverLimit = calcKrankheitEpisodes(yearEntries)
    .filter((ep) => ep.days > ENTGFG_KRANKHEIT_LIMIT_DAYS)
    .reduce((s, ep) => s + ep.excessDates.length, 0);

  const reportUrl = `${APP_URL}/reports?year=${year}&month=${month}`;
  const monthLabel = `${MONTHS_DE[month - 1]} ${year}`;

  return {
    monthLabel,
    monthWorkedMin, monthWorkedDays,
    monthUrlaubDays, monthKrankDays, monthNotdienstDays,
    capViolations, krankheitOverLimit,
    reportUrl,
  };
}

// ─────────────────────────────────────────────────────────────
// Email template
// ─────────────────────────────────────────────────────────────

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY nicht konfiguriert");
    _resend = new Resend(key);
  }
  return _resend;
}

export interface SendMonthlyReportInput {
  to:    string;
  name:  string;
  stats: MonthlyReportStats;
}

export async function sendMonthlyReportEmail({ to, name, stats }: SendMonthlyReportInput) {
  const settingsUrl = `${APP_URL}/settings#digest`;
  const hasCompliance = stats.capViolations.length > 0 || stats.krankheitOverLimit > 0;

  const complianceBlock = hasCompliance ? `
    <div style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
      <div style="color: #ef4444; font-weight: 700; font-size: 14px; margin-bottom: 8px;">
        ⚠️ Compliance-Hinweise (${stats.monthLabel})
      </div>
      ${stats.capViolations.length > 0 ? `
        <div style="color: #a8a8b8; font-size: 13px; line-height: 1.6; margin-bottom: 6px;">
          🚫 §3 ArbZG: <strong style="color:#e8e8f0">${stats.capViolations.length} Tag${stats.capViolations.length === 1 ? "" : "e"}</strong>
          mit &gt; 10h Arbeitszeit.
        </div>
      ` : ""}
      ${stats.krankheitOverLimit > 0 ? `
        <div style="color: #a8a8b8; font-size: 13px; line-height: 1.6;">
          🩺 §3 EntgFG: <strong style="color:#e8e8f0">${stats.krankheitOverLimit} Tag${stats.krankheitOverLimit === 1 ? "" : "e"}</strong>
          über 6-Wochen-Lohnfortzahlung.
        </div>
      ` : ""}
    </div>` : "";

  const statCard = (label: string, value: string, color = "#c084fc") => `
    <div style="background: #16161d; border: 1px solid #2e2e3d; border-radius: 10px; padding: 14px 16px;">
      <div style="color: #6b6b80; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;">${label}</div>
      <div style="color: ${color}; font-family: 'DM Mono', monospace; font-size: 20px; font-weight: 700; margin-top: 4px;">${value}</div>
    </div>`;

  return getResend().emails.send({
    from: FROM,
    to,
    subject: `📊 Dein Stundly-Monat · ${stats.monthLabel}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f13; color: #e8e8f0; padding: 40px 32px; border-radius: 16px;">
        <div style="color: #c084fc; font-weight: 800; font-size: 18px; letter-spacing: 3px; margin-bottom: 28px;">STUNDLY</div>

        <h1 style="font-size: 22px; font-weight: 800; margin-bottom: 8px;">
          Hallo ${name.split(" ")[0] ?? name} 👋
        </h1>
        <p style="color: #a8a8b8; font-size: 14px; line-height: 1.7; margin-bottom: 28px;">
          Hier ist deine Zusammenfassung für <strong style="color:#e8e8f0">${stats.monthLabel}</strong>.
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
          ${statCard("Arbeitszeit", minToHhMm(stats.monthWorkedMin), "#7c6af7")}
          ${statCard("Arbeitstage", String(stats.monthWorkedDays), "#22c55e")}
          ${statCard("Urlaub",      String(stats.monthUrlaubDays))}
          ${statCard("Krank",       String(stats.monthKrankDays), "#ef4444")}
        </div>

        ${stats.monthNotdienstDays > 0 ? `
          <div style="background: #16161d; border: 1px solid #2e2e3d; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
            <div style="color: #f59e0b; font-size: 13px; font-weight: 700;">
              🚨 ${stats.monthNotdienstDays} Notdienst-Einsatz${stats.monthNotdienstDays === 1 ? "" : "e"}
            </div>
            <div style="color: #6b6b80; font-size: 11px; margin-top: 4px;">
              Wochen-Zuordnung: Woche zählt zum Monat des Sonntags.
            </div>
          </div>
        ` : ""}

        ${complianceBlock}

        <a href="${stats.reportUrl}" style="display: inline-block; background: #7c6af7; color: #fff; padding: 12px 24px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 14px; margin-bottom: 24px;">
          Bericht öffnen → PDF exportieren
        </a>

        <p style="color: #6b6b80; font-size: 11px; margin-top: 32px; border-top: 1px solid #2e2e3d; padding-top: 16px; line-height: 1.6;">
          Du bekommst diese E-Mail, weil du in deinen Einstellungen den Monatsbericht aktiviert hast.
          <a href="${settingsUrl}" style="color: #c084fc;">Abbestellen / Einstellungen</a> ·
          <a href="${APP_URL}/impressum" style="color: #c084fc;">Impressum</a> ·
          <a href="${APP_URL}/datenschutz" style="color: #c084fc;">Datenschutz</a>
        </p>
      </div>
    `,
  });
}
