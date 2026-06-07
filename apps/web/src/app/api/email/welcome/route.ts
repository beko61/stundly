import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email/resend";

/**
 * Welcome email — onboarding tamamlanınca tetiklenir.
 * Tek seferlik garantisi yok (kullanıcı /onboarding/done'ı tekrar açarsa
 * tekrar gönderilir); ufak SaaS aşamasında kabul edilebilir.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let plan: "individual" | "company" = "individual";
  try {
    const body = await req.json() as { plan?: string };
    if (body.plan === "company") plan = "company";
  } catch {
    // body opsiyonel
  }

  const { data: profile } = await supabase
    .from("profiles").select("vorname, full_name").eq("user_id", user.id).maybeSingle();
  const name = (profile?.vorname as string | null)
    ?? (profile?.full_name as string | null)
    ?? (user.user_metadata?.["full_name"] as string | undefined)
    ?? user.email.split("@")[0]!;

  try {
    await sendWelcomeEmail({ to: user.email, name, plan });
    return NextResponse.json({ sent: true });
  } catch (err) {
    // RESEND_API_KEY yoksa veya başka bir nedenle başarısız oldu — sessizce yut
    console.error("welcome email failed:", err);
    return NextResponse.json({ sent: false, error: err instanceof Error ? err.message : "send failed" }, { status: 500 });
  }
}
