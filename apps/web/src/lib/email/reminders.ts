/**
 * Erinnerungs-Mails — Nutzer, die sich registriert haben, Stundly aber nicht (mehr) nutzen.
 *
 * Täglicher Cron (`/api/cron/reminders`) entscheidet pro Nutzer mit `decideReminder`:
 *   - "start"    — registriert seit ≥ 2 Tagen, noch nie etwas eingetragen
 *   - "start2"   — ≥ 7 Tage, immer noch leer, "start" ist ≥ 4 Tage her (letzte Mail dieser Art)
 *   - "comeback" — hat schon Daten, aber seit ≥ 14 Tagen nichts eingetragen/angemeldet;
 *                  höchstens eine Mail pro Pause (erst wieder nach neuer Aktivität)
 * Abbestellbar per Link in jeder Mail (one-click, RFC 8058) und in den Einstellungen.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { resend } from "./resend";

const FROM = "Stundly <noreply@stundly.de>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://stundly.de";
const DAY = 24 * 60 * 60 * 1000;

export type ReminderType = "start" | "start2" | "comeback";

export const START_AFTER_DAYS = 2;
export const START2_AFTER_DAYS = 7;
export const START2_GAP_DAYS = 4;
export const COMEBACK_AFTER_DAYS = 14;

export interface ReminderInput {
  now:          Date;
  signupAt:     Date;
  /** Letzte eigene Eintragung (Arbeitszeit/Notdienst, ohne Beispieldaten); null = noch nie */
  lastDataAt:   Date | null;
  lastSignInAt: Date | null;
  lastType:     ReminderType | null;
  lastSentAt:   Date | null;
}

export interface ReminderDecision {
  type: ReminderType;
  /** comeback: Tage seit der letzten Aktivität */
  inactiveDays?: number;
}

export function decideReminder(i: ReminderInput): ReminderDecision | null {
  const now = i.now.getTime();

  if (!i.lastDataAt) {
    const ageDays = (now - i.signupAt.getTime()) / DAY;
    if (!i.lastType && ageDays >= START_AFTER_DAYS) return { type: "start" };
    if (
      i.lastType === "start" && ageDays >= START2_AFTER_DAYS &&
      i.lastSentAt && now - i.lastSentAt.getTime() >= START2_GAP_DAYS * DAY
    ) return { type: "start2" };
    return null;
  }

  const lastActivity = Math.max(i.lastDataAt.getTime(), i.lastSignInAt?.getTime() ?? 0);
  const inactiveDays = Math.floor((now - lastActivity) / DAY);
  if (inactiveDays < COMEBACK_AFTER_DAYS) return null;
  // Für diese Pause schon erinnert → erst nach neuer Aktivität wieder
  if (i.lastSentAt && i.lastSentAt.getTime() > lastActivity) return null;
  return { type: "comeback", inactiveDays };
}

// ── Abmelde-Link (signiert, ohne Login nutzbar) ───────────────────────────────

function secret(): string {
  const s = process.env.EMAIL_UNSUBSCRIBE_SECRET ?? process.env.CRON_SECRET;
  if (!s) throw new Error("EMAIL_UNSUBSCRIBE_SECRET/CRON_SECRET fehlt");
  return s;
}

export function unsubscribeToken(userId: string): string {
  return createHmac("sha256", secret()).update(`reminders:${userId}`).digest("base64url");
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  try {
    const a = Buffer.from(unsubscribeToken(userId));
    const b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function unsubscribeUrl(userId: string): string {
  return `${APP_URL}/api/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`;
}

// ── Inhalte ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display: inline-block; background: #7c6af7; color: #fff; padding: 14px 28px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 15px;">${label}</a>`;
}

function layout(body: string, unsubUrl: string): string {
  return `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; background: #0f0f13; color: #e8e8f0; padding: 40px 32px; border-radius: 16px;">
        <div style="color: #c084fc; font-weight: 800; font-size: 18px; letter-spacing: 3px; margin-bottom: 32px;">STUNDLY</div>
        ${body}
        <p style="color: #6b6b80; font-size: 11px; margin-top: 32px; border-top: 1px solid #2e2e3d; padding-top: 16px; line-height: 1.6;">
          Du bekommst diese Erinnerung, weil du bei Stundly registriert bist.
          <a href="${unsubUrl}" style="color: #c084fc;">Erinnerungen abbestellen</a> ·
          <a href="${APP_URL}/datenschutz" style="color: #c084fc;">Datenschutz</a> ·
          <a href="${APP_URL}/impressum" style="color: #c084fc;">Impressum</a>
        </p>
      </div>`;
}

const p = (html: string) => `<p style="color: #9a9ab0; font-size: 14px; line-height: 1.7; margin: 0 0 16px;">${html}</p>`;
const strong = (t: string) => `<strong style="color: #e8e8f0;">${t}</strong>`;

export function buildReminderEmail(
  type: ReminderType,
  opts: { name: string; inactiveDays?: number; unsubUrl: string },
): { subject: string; html: string; text: string } {
  const hallo = opts.name ? `Hallo ${esc(opts.name)},` : "Hallo,";

  if (type === "start" || type === "start2") {
    const subject = type === "start"
      ? "Dein Stundly ist startklar — in 2 Minuten eingerichtet"
      : "Kurze Erinnerung: deine Stunden erfassen sich nicht von allein";
    const intro = type === "start"
      ? `${hallo} schön, dass du dich bei Stundly registriert hast! Du hast aber noch keine Arbeitszeit eingetragen — so geht's am schnellsten:`
      : `${hallo} dein Stundly-Konto ist noch leer. Wer seine Stunden nicht aufschreibt, verschenkt am Monatsende oft Überstunden und Notdienste. Der Einstieg dauert nur zwei Minuten:`;
    const steps = `
        <ol style="color: #9a9ab0; font-size: 14px; line-height: 1.9; padding-left: 20px; margin: 0 0 24px;">
          <li>${strong("Profil & Bundesland")} eintragen — für die richtigen Feiertage</li>
          <li>${strong("Monatsbefüllung")}: das ganze Jahr mit einem Klick mit deinen Standardzeiten füllen</li>
          <li>Abweichungen, ${strong("Urlaub")} und ${strong("Notdienste")} einfach antippen und ändern</li>
        </ol>`;
    const html = layout(`
        <h1 style="font-size: 22px; font-weight: 800; margin: 0 0 12px;">${type === "start" ? "Los geht's 🚀" : "Noch nicht angefangen? 🙂"}</h1>
        ${p(intro)}
        ${steps}
        ${button(`${APP_URL}/tracker`, "Jetzt Zeiten eintragen →")}
        ${p(`<span style="font-size: 12px;"><br>Tipp: Stundly lässt sich auf dem Handy wie eine App installieren — im Browser „Zum Home-Bildschirm“.</span>`)}
      `, opts.unsubUrl);
    const text = `${hallo}\n\n${intro.replace(/<[^>]+>/g, "")}\n\n1. Profil & Bundesland eintragen\n2. Monatsbefüllung: ganzes Jahr mit einem Klick füllen\n3. Urlaub und Notdienste antippen und ändern\n\nJetzt starten: ${APP_URL}/tracker\n\nErinnerungen abbestellen: ${opts.unsubUrl}`;
    return { subject, html, text };
  }

  const days = opts.inactiveDays ?? COMEBACK_AFTER_DAYS;
  const subject = `Seit ${days} Tagen nichts eingetragen — fehlen Stunden?`;
  const intro = `${hallo} in Stundly wurde seit ${strong(`${days} Tagen`)} nichts mehr eingetragen.
    Überstunden, Notdienste und Urlaub zählen nur, wenn sie erfasst sind — trag die fehlenden Tage am besten jetzt nach, solange du sie noch weißt.`;
  const html = layout(`
        <h1 style="font-size: 22px; font-weight: 800; margin: 0 0 12px;">Deine Stunden warten ⏱</h1>
        ${p(intro)}
        ${button(`${APP_URL}/tracker`, "Zeiten nachtragen →")}
        ${p(`<span style="font-size: 12px;"><br>Keine Zeit? Mit der Monatsbefüllung füllst du ganze Monate mit einem Klick und änderst nur die Ausnahmen.</span>`)}
      `, opts.unsubUrl);
  const text = `${hallo}\n\nIn Stundly wurde seit ${days} Tagen nichts mehr eingetragen. Überstunden, Notdienste und Urlaub zählen nur, wenn sie erfasst sind.\n\nZeiten nachtragen: ${APP_URL}/tracker\n\nErinnerungen abbestellen: ${opts.unsubUrl}`;
  return { subject, html, text };
}

export async function sendReminderEmail(opts: {
  to: string; userId: string; name: string; decision: ReminderDecision;
}) {
  const unsubUrl = unsubscribeUrl(opts.userId);
  const mail = buildReminderEmail(opts.decision.type, {
    name: opts.name, unsubUrl,
    ...(opts.decision.inactiveDays !== undefined ? { inactiveDays: opts.decision.inactiveDays } : {}),
  });
  const res = await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    headers: {
      "List-Unsubscribe": `<${unsubUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
  if (res.error) throw new Error(res.error.message);
  return res;
}
