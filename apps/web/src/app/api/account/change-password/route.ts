import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit/check";

/**
 * POST /api/account/change-password
 *
 * Body: { password: string }
 *
 * Login zorunlu. Şifre BURADA (service role) değiştirilir, ancak başarılıysa
 * must_change_password = false olur. Eskiden şifre client'ta değişiyordu ve bu
 * endpoint sadece flag'i temizliyordu → şifre değiştirmeden doğrudan POST ile
 * zorunlu değişiklik atlanabiliyordu.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit({ bucket: `change_password:${user.id}`, limit: 10, windowSec: 3600 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Zu viele Versuche. Bitte später erneut." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const body = await req.json().catch(() => ({})) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8 || password.length > 72) {
    return NextResponse.json({ error: "Passwort muss 8 bis 72 Zeichen haben." }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error: pwdErr } = await admin.auth.admin.updateUserById(user.id, { password });
  if (pwdErr) {
    return NextResponse.json({ error: pwdErr.message || "Passwort konnte nicht geändert werden." }, { status: 400 });
  }

  const { error } = await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
