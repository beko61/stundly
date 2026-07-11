/**
 * Weekly Digest Email — retention feature.
 *
 * Vercel Cron her Pazartesi 06:00 UTC tetikler
 * (`/api/cron/weekly-digest`). Sadece profiles.weekly_digest_enabled=true
 * olan aktif kullanıcılara gönderilir.
 *
 * Içerik:
 *  - Geçen hafta (Mo–So) toplam Arbeitszeit, Arbeitstage, Urlaub, Krank, Notdienst
 *  - Bu ay bugüne kadar (YTD-monthly) toplam Arbeitszeit
 *  - Varsa compliance uyarıları (§3 ArbZG 10h cap, §3 EntgFG 6 Wochen)
 *  - CTA: /tracker'a git
 */

import { Resend } from "resend";
import type { TimeEntry } from "@workly/shared";
import {
  findDailyCapViolations,
  calcKrankheitEpisodes,
  ENTGFG_KRANKHEIT_LIMIT_DAYS,
} from "@workly/shared";
import { netMinutesForEntry } from "@/lib/company/admin";

const FROM = "Stundly <noreply@stundly.de>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ─────────────────────────────────────────────────────────────
// Data aggregation
// ─────────────────────────────────────────────────────────────

export interface WeeklyDigestNotdienst {
  date:       string;
  start_time: string | null;
  end_time:   string | null;
}

export interface WeeklyDigestInput {
  /** ISO tarihi — hafta hesabı bu tarihten geriye */
  refDate:   string; // YYYY-MM-DD (Pazartesi tetiklendiğinde yeni haftanın ilk günü)
  entries:   TimeEntry[]; // Son 30 gün + bu ay
  notdienst: WeeklyDigestNotdienst[];
  yearEntries: TimeEntry[]; // Krankheitsepisoden için
}

export interface WeeklyDigestStats {
  weekStartISO:      string;
  weekEndISO:        string;
  weekWorkedMin:     number;
  weekWorkedDays:    number;
  weekUrlaubDays:    number;
  weekKrankDays:     number;
  weekNotdienstDays: number;
  monthWorkedMin:    number;
  monthName:         string;
  capViolations:     string[];
  krankheitOverLimit: number;
}

function pad2(n: number): string { return String(n).padStart(2, "0"); }

/** ISO tarihinden n gün önce/sonra. */
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

/** ISO tarihi bir Pazartesi'nin haftasına ait mi? Pazartesi 00:00 - Pazar 23:59. */
function weekOfIso(iso: string, weekStartIso: string): boolean {
  const weekEndIso = addDays(weekStartIso, 6);
  return iso >= weekStartIso && iso <= weekEndIso;
}

/**
 * refDate = Pazartesi. Önceki hafta = önceki Pazartesi'den Pazar'a kadar.
 */
export function computeWeeklyDigestStats(input: WeeklyDigestInput): WeeklyDigestStats {
  const { refDate, entries, notdienst, yearEntries } = input;
  const weekStartISO = addDays(refDate, -7); // önceki Pazartesi
  const weekEndISO   = addDays(refDate, -1); // önceki Pazar

  const [yStr, mStr] = refDate.split("-");
  const y = Number(yStr); const m = Number(mStr);
  const monthStartISO = `${y}-${pad2(m)}-01`;
  const daysInMonth   = new Date(y, m, 0).getDate();
  const monthEndISO   = `${y}-${pad2(m)}-${pad2(daysInMonth)}`;

  const weekEntries = entries.filter((e) => weekOfIso(e.date, weekStartISO));
  const weekWorkedMin = weekEntries
    .filter((e) => e.day_type === "arbeiten")
    .reduce((s, e) => s + netMinutesForEntry(e), 0);
  const weekWorkedDays = weekEntries.filter((e) => e.day_type === "arbeiten").length;
  const weekUrlaubDays = weekEntries.filter((e) => e.day_type === "urlaub").length;
  const weekKrankDays  = weekEntries.filter((e) => e.day_type === "krank").length;
  const weekNotdienstDays = notdienst
    .filter((n) => weekOfIso(n.date, weekStartISO))
    .length;

  const monthEntries = entries.filter((e) => e.date >= monthStartISO && e.date <= monthEndISO);
  const monthWorkedMin = monthEntries
    .filter((e) => e.day_type === "arbeiten")
    .reduce((s, e) => s + netMinutesForEntry(e), 0);

  const monthName = new Date(y, m - 1, 1).toLocaleDateString("de-DE", { month: "long" });

  // Compliance
  const capViolations = findDailyCapViolations(monthEntries).map((v) => v.date);
  const krankheitEpisodes = calcKrankheitEpisodes(yearEntries);
  const krankheitOverLimit = krankheitEpisodes
    .filter((ep) => ep.days > ENTGFG_KRANKHEIT_LIMIT_DAYS)
    .reduce((s, ep) => s + ep.excessDates.length, 0);

  return {
    weekStartISO, weekEndISO,
    weekWorkedMin, weekWorkedDays,
    weekUrlaubDays, weekKrankDays, weekNotdienstDays,
    monthWorkedMin, monthName,
    capViolations, krankheitOverLimit,
  };
}

function minToHhMm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${pad2(m)}m`;
}

function formatIsoDe(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
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

export interface SendWeeklyDigestInput {
  to:    string;
  name:  string;
  stats: WeeklyDigestStats;
}

export async function sendWeeklyDigestEmail({ to, name, stats }: SendWeeklyDigestInput) {
  const weekLabel = `${formatIsoDe(stats.weekStartISO)} – ${formatIsoDe(stats.weekEndISO)}`;
  const hasCompliance = stats.capViolations.length > 0 || stats.krankheitOverLimit > 0;
  const settingsUrl = `${APP_URL}/settings#digest`;
  const trackerUrl  = `${APP_URL}/tracker`;

  const complianceBlock = hasCompliance
    ? `
        <div style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
          <div style="color: #ef4444; font-weight: 700; font-size: 14px; margin-bottom: 8px;">
            ⚠️ Compliance-Hinweise
          </div>
          ${stats.capViolations.length > 0 ? `
            <div style="color: #a8a8b8; font-size: 13px; line-height: 1.6; margin-bottom: 6px;">
              🚫 §3 ArbZG: <strong style="color:#e8e8f0">${stats.capViolations.length} Tag${stats.capViolations.length === 1 ? "" : "e"}</strong>
              mit &gt; 10h Arbeitszeit im ${stats.monthName}.
            </div>
          ` : ""}
          ${stats.krankheitOverLimit > 0 ? `
            <div style="color: #a8a8b8; font-size: 13px; line-height: 1.6;">
              🩺 §3 EntgFG: <strong style="color:#e8e8f0">${stats.krankheitOverLimit} Tag${stats.krankheitOverLimit === 1 ? "" : "e"}</strong>
              über 6-Wochen-Lohnfortzahlung. Krankengeld tritt ein.
            </div>
          ` : ""}
        </div>`
    : "";

  const statCard = (label: string, value: string, color = "#c084fc") => `
    <div style="background: #16161d; border: 1px solid #2e2e3d; border-radius: 10px; padding: 14px 16px;">
      <div style="color: #6b6b80; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;">${label}</div>
      <div style="color: ${color}; font-family: 'DM Mono', monospace; font-size: 20px; font-weight: 700; margin-top: 4px;">${value}</div>
    </div>`;

  return getResend().emails.send({
    from: FROM,
    to,
    subject: `📊 Deine Stundly-Woche · ${weekLabel}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f13; color: #e8e8f0; padding: 40px 32px; border-radius: 16px;">
        <div style="color: #c084fc; font-weight: 800; font-size: 18px; letter-spacing: 3px; margin-bottom: 28px;">STUNDLY</div>

        <h1 style="font-size: 22px; font-weight: 800; margin-bottom: 8px;">
          Hallo ${name.split(" ")[0] ?? name} 👋
        </h1>
        <p style="color: #a8a8b8; font-size: 14px; line-height: 1.7; margin-bottom: 28px;">
          Hier ist deine Wochenübersicht für <strong style="color:#e8e8f0">${weekLabel}</strong>.
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
          ${statCard("Arbeitszeit", minToHhMm(stats.weekWorkedMin), "#7c6af7")}
          ${statCard("Arbeitstage", String(stats.weekWorkedDays), "#22c55e")}
          ${statCard("Urlaub",      String(stats.weekUrlaubDays))}
          ${statCard("Krank",       String(stats.weekKrankDays), "#ef4444")}
        </div>

        <div style="background: #16161d; border: 1px solid #2e2e3d; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
          <div style="color: #6b6b80; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;">${stats.monthName} bisher</div>
          <div style="color: #e8e8f0; font-family: 'DM Mono', monospace; font-size: 22px; font-weight: 700; margin-top: 4px;">
            ${minToHhMm(stats.monthWorkedMin)}
          </div>
          ${stats.weekNotdienstDays > 0 ? `
            <div style="color: #f59e0b; font-size: 12px; margin-top: 8px;">
              🚨 ${stats.weekNotdienstDays} Notdienst-Einsatz${stats.weekNotdienstDays === 1 ? "" : "e"} letzte Woche
            </div>
          ` : ""}
        </div>

        ${complianceBlock}

        <a href="${trackerUrl}" style="display: inline-block; background: #7c6af7; color: #fff; padding: 12px 24px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 14px; margin-bottom: 24px;">
          Zur Zeiterfassung →
        </a>

        <p style="color: #6b6b80; font-size: 11px; margin-top: 32px; border-top: 1px solid #2e2e3d; padding-top: 16px; line-height: 1.6;">
          Du bekommst diese E-Mail, weil du in deinen Einstellungen den wöchentlichen Digest aktiviert hast.
          <a href="${settingsUrl}" style="color: #c084fc;">Abbestellen / Einstellungen</a> ·
          <a href="${APP_URL}/impressum" style="color: #c084fc;">Impressum</a> ·
          <a href="${APP_URL}/datenschutz" style="color: #c084fc;">Datenschutz</a>
        </p>
      </div>
    `,
  });
}
