import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email/resend";

/**
 * Resend kurulumu test endpoint'i.
 * Giriş yapan kullanıcıya bir test maili gönderir.
 * Kullanım: tarayıcıdan POST /api/email/test
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({
      sent: false,
      error: "RESEND_API_KEY ist nicht konfiguriert. Bitte in Vercel Env Variables hinzufügen.",
    }, { status: 500 });
  }

  try {
    const name = (user.user_metadata?.["full_name"] as string | undefined)
      ?? user.email.split("@")[0]!;
    const result = await sendWelcomeEmail({ to: user.email, name, plan: "individual" });
    return NextResponse.json({
      sent: true,
      to: user.email,
      messageId: (result as { data?: { id?: string } | null } | null)?.data?.id ?? null,
    });
  } catch (err) {
    return NextResponse.json({
      sent: false,
      error: err instanceof Error ? err.message : "send failed",
    }, { status: 500 });
  }
}
