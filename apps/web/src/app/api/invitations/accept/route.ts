import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rateLimit/check";

// Token brute-force koruması: yanlış/expired token'la saldırgan geçerli
// invitation token'ları tarayabilir. Auth'lu user başına 20 attempt/saat
// yeterli (real kullanıcı 1-2 kere denemek zorunda kalır maximum).
const ACCEPT_LIMIT_PER_HOUR = 20;
const ACCEPT_WINDOW_SEC     = 3600;

/**
 * POST /api/invitations/accept
 * Body: { token: string }
 *
 * Davet kabul akışı — hem yeni kayıt sonrası hem mevcut login sonrası çağrılır.
 * Yapı:
 *   1. Auth: oturum açık olmalı.
 *   2. Token → invitation (pending + expired değil).
 *   3. Güvenlik: invitation.email === user.email olmalı.
 *      Aksi halde "Alice'in davetini Bob'un email'iyle çalıyor" saldırısı olur.
 *   4. profiles.company_id + profiles.role güncelle (idempotent).
 *   5. invitations.status = 'accepted', accepted_at = now().
 *   6. Redirect hedefini döndür (admin → /company/dashboard, employee → /tracker).
 *
 * Service role kullanılır: profiles ve invitations update'leri için
 * RLS gevşekliği lazım (user kendi profilini değil, davet rolünü set ediyor).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  // Rate limit — auth'lu user başına saatte 20 attempt
  const rl = await checkRateLimit({
    bucket:    `invitations_accept:${user.id}`,
    limit:     ACCEPT_LIMIT_PER_HOUR,
    windowSec: ACCEPT_WINDOW_SEC,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Zu viele Versuche. Bitte später erneut versuchen." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { token } = await req.json().catch(() => ({ token: null }));
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token fehlt" }, { status: 400 });
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: invitation, error: invErr } = await admin
    .from("invitations")
    .select("id, company_id, email, role, status, expires_at")
    .eq("token", token)
    .single();

  if (invErr || !invitation) {
    return NextResponse.json({ error: "Einladung nicht gefunden" }, { status: 404 });
  }

  if (invitation.status !== "pending") {
    return NextResponse.json({ error: "Einladung wurde bereits verwendet oder widerrufen" }, { status: 410 });
  }

  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Einladung ist abgelaufen" }, { status: 410 });
  }

  if ((user.email ?? "").toLowerCase() !== invitation.email.toLowerCase()) {
    return NextResponse.json(
      { error: "Diese Einladung ist für eine andere E-Mail-Adresse." },
      { status: 403 }
    );
  }

  // 1. Profile'ı company'ye bağla — idempotent
  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      company_id: invitation.company_id,
      role:       invitation.role,
    })
    .eq("user_id", user.id);

  if (profileErr) {
    return NextResponse.json({ error: "Profil konnte nicht aktualisiert werden" }, { status: 500 });
  }

  // 2. Davetiyeyi kabul edildi olarak işaretle
  await admin
    .from("invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  // 3. Rol-based redirect
  const redirectTo = invitation.role === "company_admin" ? "/company/dashboard" : "/tracker";

  return NextResponse.json({ ok: true, redirectTo, role: invitation.role });
}
