import { createClient as createAdmin } from "@supabase/supabase-js";
import { verifyUnsubscribeToken } from "@/lib/email/reminders";

/**
 * Erinnerungs-Mails abbestellen — ohne Login, per signiertem Link aus der Mail.
 *
 * GET  → Bestätigungsseite mit Button (kein Abbestellen per GET: Mail-Scanner wie
 *        Outlook Safe Links rufen Links automatisch auf).
 * POST → abbestellen. Auch RFC-8058-One-Click (Body "List-Unsubscribe=One-Click").
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(title: string, body: string, status = 200): Response {
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${title} · Stundly</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f0f13;color:#e8e8f0;font-family:system-ui,sans-serif;padding:24px;text-align:center}
.box{max-width:420px}h1{font-size:22px}p{color:#9a9ab0;line-height:1.6}
button,a.btn{display:inline-block;margin-top:12px;padding:12px 22px;border-radius:10px;border:none;background:#7c6af7;color:#fff;font-weight:700;font-size:15px;text-decoration:none;cursor:pointer}</style>
</head><body><div class="box"><div style="color:#c084fc;font-weight:800;letter-spacing:3px;margin-bottom:24px">STUNDLY</div>${body}</div></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function params(req: Request) {
  const url = new URL(req.url);
  return { u: url.searchParams.get("u") ?? "", t: url.searchParams.get("t") ?? "" };
}

const INVALID = () => page("Ungültiger Link",
  `<h1>Link ungültig</h1><p>Dieser Abmelde-Link ist ungültig oder beschädigt. Du kannst Erinnerungen auch in Stundly unter <b>Profil &amp; Settings → E-Mail Nachrichten</b> abschalten.</p>`, 400);

export async function GET(req: Request) {
  const { u, t } = params(req);
  if (!u || !t || !verifyUnsubscribeToken(u, t)) return INVALID();
  const action = `/api/email/unsubscribe?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}`;
  return page("Erinnerungen abbestellen", `
    <h1>Erinnerungen abbestellen?</h1>
    <p>Du bekommst dann keine Erinnerungs-Mails mehr, wenn du länger nichts eingetragen hast.
    Wochen- und Monatsberichte stellst du separat in den Einstellungen ein.</p>
    <form method="post" action="${action}"><button type="submit">Ja, abbestellen</button></form>`);
}

export async function POST(req: Request) {
  const { u, t } = params(req);
  if (!u || !t || !verifyUnsubscribeToken(u, t)) return INVALID();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return page("Fehler", "<h1>Gerade nicht möglich</h1><p>Bitte später erneut versuchen.</p>", 500);

  const admin = createAdmin(url, key, { auth: { persistSession: false } });
  const { error } = await admin.from("profiles").update({ reminder_emails_enabled: false }).eq("user_id", u);
  if (error) {
    console.error("[email/unsubscribe]", error.message);
    return page("Fehler", "<h1>Gerade nicht möglich</h1><p>Bitte später erneut versuchen.</p>", 500);
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://stundly.de";
  return page("Abbestellt", `
    <h1>✓ Abbestellt</h1>
    <p>Du bekommst keine Erinnerungs-Mails mehr. Wieder einschalten kannst du sie jederzeit in den Einstellungen.</p>
    <a class="btn" href="${appUrl}/settings#digest">Zu den Einstellungen</a>`);
}
