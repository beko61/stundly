/**
 * Firmen-Mails (Phase D):
 *   - Lohn-Vorbereitung an Steuerberater / Lohnbüro (Tabelle + CSV-Anhang)
 *   - Montags-Überblick an den Chef (Team-Woche + offene Aufgaben)
 */

import { resend } from "./resend";
import { hm, lohnCsv, STATUS_LABEL, type LohnRow } from "@/lib/company/lohn";

const FROM = "Stundly <noreply@stundly.de>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://stundly.de";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

const footer = (extra: string) => `
  <p style="color:#6b6b80;font-size:11px;margin-top:28px;border-top:1px solid #2e2e3d;padding-top:14px;line-height:1.6">
    ${extra}<br>Erstellt mit <a href="${APP_URL}" style="color:#c084fc">Stundly</a> — Zeiterfassung für Handwerksbetriebe ·
    <a href="${APP_URL}/impressum" style="color:#c084fc">Impressum</a> · <a href="${APP_URL}/datenschutz" style="color:#c084fc">Datenschutz</a>
  </p>`;

export function lohnFileName(firma: string, year: number, month: number): string {
  const slug = firma.replace(/[äÄ]/g, "ae").replace(/[öÖ]/g, "oe").replace(/[üÜ]/g, "ue").replace(/ß/g, "ss")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "Firma";
  return `Lohn-Vorbereitung_${slug}_${year}-${String(month).padStart(2, "0")}.csv`;
}

export function buildLohnMailHtml(p: { firma: string; monthLabel: string; rows: LohnRow[]; sender: string }): string {
  const open = p.rows.filter((r) => r.status !== "approved").length;
  const th = (t: string, right = true) => `<th style="padding:8px 6px;text-align:${right ? "right" : "left"};color:#6b6b80;font-size:11px;border-bottom:1px solid #2e2e3d">${t}</th>`;
  const td = (t: string, right = true) => `<td style="padding:8px 6px;text-align:${right ? "right" : "left"};font-size:12px;border-bottom:1px solid #22222c">${t}</td>`;
  const body = p.rows.map((r) => `<tr>
    ${td(escapeHtml(r.name) + (r.personal_nr ? ` <span style="color:#6b6b80">(${escapeHtml(r.personal_nr)})</span>` : ""), false)}
    ${td(hm(r.sollMin))}${td(hm(r.istMin))}${td(r.ndCount ? `${r.ndCount}× · ${hm(r.ndMin)}` : "–")}
    ${td(`<strong style="color:${r.diffMin >= 0 ? "#22c55e" : "#ef4444"}">${r.diffMin >= 0 ? "+" : ""}${hm(r.diffMin)}</strong>`)}
    ${td(String(r.urlaubDays))}${td(String(r.krankDays))}
    ${td(r.status ? STATUS_LABEL[r.status] : "offen")}
  </tr>`).join("");
  return `
  <div style="font-family:sans-serif;max-width:720px;margin:0 auto;background:#0f0f13;color:#e8e8f0;padding:32px 24px;border-radius:16px">
    <div style="color:#c084fc;font-weight:800;font-size:16px;letter-spacing:3px;margin-bottom:20px">STUNDLY</div>
    <h1 style="font-size:20px;margin:0 0 6px">Lohn-Vorbereitung ${escapeHtml(p.monthLabel)}</h1>
    <p style="color:#a8a8b8;font-size:14px;line-height:1.6;margin:0 0 18px">
      ${escapeHtml(p.firma)} — gesendet von ${escapeHtml(p.sender)}. Die Tabelle liegt als CSV im Anhang (Excel/Lohnprogramm, Stunden dezimal).
      ${open ? `<br><strong style="color:#f59e0b">${open} Mitarbeiter-Monat${open === 1 ? " ist" : "e sind"} noch nicht vom Betrieb freigegeben.</strong>` : ""}
    </p>
    <table style="width:100%;border-collapse:collapse;color:#e8e8f0">
      <thead><tr>${th("Mitarbeiter", false)}${th("Soll")}${th("Ist")}${th("Notdienst")}${th("Saldo")}${th("Urlaub")}${th("Krank")}${th("Status")}</tr></thead>
      <tbody>${body}</tbody>
    </table>
    <p style="color:#6b6b80;font-size:11px;margin-top:12px">Ist = Arbeit + Urlaub/Krank/Feiertag (Sollstunden). Saldo inkl. Notdienst. Stunden als Std:Min.</p>
    ${footer("Sie erhalten diese E-Mail, weil der Betrieb Sie als Steuerberater/Lohnbüro eingetragen hat.")}
  </div>`;
}

export async function sendLohnToSteuerberater(p: {
  to: string; replyTo: string | null; firma: string; year: number; month: number; monthLabel: string; rows: LohnRow[]; sender: string;
}) {
  const csv = lohnCsv(p.rows);
  return resend.emails.send({
    from: FROM,
    to: p.to,
    ...(p.replyTo ? { replyTo: p.replyTo } : {}),
    subject: `Lohn-Vorbereitung ${p.monthLabel} · ${p.firma}`,
    html: buildLohnMailHtml(p),
    attachments: [{ filename: lohnFileName(p.firma, p.year, p.month), content: Buffer.from(csv, "utf-8").toString("base64") }],
  });
}

/* ── Montags-Überblick ─────────────────────────────────────────────────── */

export interface TeamDigest {
  firma:        string;
  weekLabel:    string;             // "22.09. – 28.09."
  teamMin:      number;
  ndCount:      number;
  onDuty:       string | null;      // Rufbereitschaft diese Woche
  tasks:        string[];           // "2 Monate zur Freigabe", …
}

export function buildTeamDigestHtml(name: string, d: TeamDigest): string {
  const first = name.split(" ")[0] || name;
  const tasks = d.tasks.length
    ? d.tasks.map((t) => `<li style="margin:4px 0">${escapeHtml(t)}</li>`).join("")
    : `<li style="margin:4px 0;color:#22c55e">Nichts offen ✓</li>`;
  return `
  <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f0f13;color:#e8e8f0;padding:32px 24px;border-radius:16px">
    <div style="color:#c084fc;font-weight:800;font-size:16px;letter-spacing:3px;margin-bottom:20px">STUNDLY</div>
    <h1 style="font-size:20px;margin:0 0 6px">Guten Morgen, ${escapeHtml(first)}</h1>
    <p style="color:#a8a8b8;font-size:14px;margin:0 0 18px">${escapeHtml(d.firma)} · letzte Woche ${escapeHtml(d.weekLabel)}</p>
    <div style="display:flex;gap:10px;margin-bottom:18px">
      <div style="flex:1;background:#16161d;border:1px solid #2e2e3d;border-radius:10px;padding:12px 14px">
        <div style="color:#6b6b80;font-size:11px;font-weight:700;text-transform:uppercase">Team-Stunden</div>
        <div style="color:#7c6af7;font-size:20px;font-weight:700;margin-top:4px">${hm(d.teamMin)} h</div>
      </div>
      <div style="flex:1;background:#16161d;border:1px solid #2e2e3d;border-radius:10px;padding:12px 14px">
        <div style="color:#6b6b80;font-size:11px;font-weight:700;text-transform:uppercase">Notdienste</div>
        <div style="color:#f59e0b;font-size:20px;font-weight:700;margin-top:4px">${d.ndCount}</div>
      </div>
    </div>
    <div style="font-size:14px;margin-bottom:6px"><strong>Diese Woche Rufbereitschaft:</strong> ${d.onDuty ? escapeHtml(d.onDuty) : "niemand eingeteilt"}</div>
    <div style="font-size:14px;font-weight:700;margin-top:14px">Zu erledigen</div>
    <ul style="padding-left:18px;color:#e8e8f0;font-size:14px;margin:6px 0 20px">${tasks}</ul>
    <a href="${APP_URL}/company/dashboard" style="display:inline-block;background:#7c6af7;color:#fff;padding:12px 22px;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px">Firmen-Panel öffnen</a>
    ${footer(`Du bekommst diesen Überblick, weil er im Firmen-Panel eingeschaltet ist. <a href="${APP_URL}/company/lohn#mail-einstellungen" style="color:#c084fc">Abbestellen</a>`)}
  </div>`;
}

export async function sendTeamDigest(to: string, name: string, d: TeamDigest) {
  return resend.emails.send({
    from: FROM, to,
    subject: `Wochenüberblick ${d.firma} · ${d.weekLabel}`,
    html: buildTeamDigestHtml(name, d),
  });
}
