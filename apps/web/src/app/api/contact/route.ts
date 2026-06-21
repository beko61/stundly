import { NextRequest, NextResponse } from "next/server";
import { sendContactFormEmail } from "@/lib/email/resend";

/**
 * POST /api/contact
 *
 * Site içi /kontakt formundan gelen mesajları SUPPORT_TO_EMAIL'e iletir
 * (Resend → reply-to=ziyaretçi).
 *
 * Spam koruması:
 *   - Honeypot: `website` field doluysa bot, sessizce 200 dön
 *   - Min message length (15)
 *   - Email regex
 *
 * Rate-limit yok (v1) — Vercel'in default rate-limit'i + honeypot yeterli.
 *
 * Env:
 *   - RESEND_API_KEY  (zaten kurulu)
 *   - SUPPORT_TO_EMAIL = "bktasyusuf@gmail.com"  (mesajlar buraya düşer)
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  // Honeypot — bot doldurur, kullanıcı görmez (display:none input)
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    // Bot — sessizce başarılı dön, kayıt etme
    return NextResponse.json({ ok: true });
  }

  const name    = typeof body.name    === "string" ? body.name.trim()    : "";
  const email   = typeof body.email   === "string" ? body.email.trim().toLowerCase() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!name || name.length < 2) {
    return NextResponse.json({ error: "Bitte gib deinen Namen an." }, { status: 400 });
  }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Bitte gib eine gültige E-Mail-Adresse an." }, { status: 400 });
  }
  if (!message || message.length < 15) {
    return NextResponse.json({ error: "Bitte schreib eine etwas längere Nachricht (mind. 15 Zeichen)." }, { status: 400 });
  }
  if (message.length > 5000) {
    return NextResponse.json({ error: "Nachricht zu lang (max. 5000 Zeichen)." }, { status: 400 });
  }

  try {
    const ip        = req.headers.get("x-forwarded-for");
    const userAgent = req.headers.get("user-agent");
    const referer   = req.headers.get("referer");
    const meta: { ip?: string; userAgent?: string; referer?: string } = {};
    if (ip)        meta.ip = ip;
    if (userAgent) meta.userAgent = userAgent;
    if (referer)   meta.referer = referer;

    await sendContactFormEmail({
      fromName:  name,
      fromEmail: email,
      subject,
      message,
      meta,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    // SUPPORT_TO_EMAIL eksikse — kullanıcıya alternatif göster
    if (msg.includes("SUPPORT_TO_EMAIL")) {
      return NextResponse.json({
        error: "Kontaktformular ist gerade nicht konfiguriert. Bitte direkt an info@stundly.de schreiben.",
      }, { status: 503 });
    }
    console.error("[/api/contact] Resend hatası:", err);
    return NextResponse.json({
      error: "Nachricht konnte nicht gesendet werden. Bitte später erneut versuchen.",
    }, { status: 500 });
  }
}
