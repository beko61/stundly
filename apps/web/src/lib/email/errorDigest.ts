import { resend } from "./resend";
import type { ErrorGroup } from "@/lib/monitoring/errorEvents";

const FROM = "Stundly <noreply@stundly.de>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://stundly.de";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Süper admin için Türkçe günlük hata özeti (en fazla 10 grup). */
export function buildErrorDigest(groups: ErrorGroup[], total: number) {
  const subject = `Stundly: son 24 saatte ${total} hata (${groups.length} farklı)`;
  const rows = groups.slice(0, 10).map((g) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace;white-space:nowrap">${g.count}×</td>
      <td style="padding:8px;border-bottom:1px solid #eee">
        <div style="font-weight:600">${esc(g.message.slice(0, 160))}</div>
        <div style="color:#666;font-size:12px">${g.source === "server" ? "Sunucu" : "Tarayıcı"} · ${esc(g.lastPath ?? "–")} · ${g.users} kullanıcı · v${esc(g.lastVersion ?? "?")}</div>
      </td>
    </tr>`).join("");
  const more = groups.length > 10 ? `<p style="color:#666;font-size:13px">+${groups.length - 10} grup daha</p>` : "";
  const html = `
  <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;color:#16161d">
    <h2 style="margin:0 0 8px">${esc(subject)}</h2>
    <p style="color:#555;font-size:14px;margin:0 0 16px">Aynı hatalar gruplandı. Ayrıntı ve stack süper admin panelinde.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px">${rows}</table>
    ${more}
    <p style="margin-top:20px"><a href="${APP_URL}/superadmin/errors" style="background:#4a3aa7;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Hataları aç</a></p>
  </div>`;
  return { subject, html };
}

export async function sendErrorDigest(to: string, groups: ErrorGroup[], total: number) {
  const { subject, html } = buildErrorDigest(groups, total);
  return resend.emails.send({ from: FROM, to, subject, html });
}
