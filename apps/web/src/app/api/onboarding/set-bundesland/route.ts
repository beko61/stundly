import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

/**
 * POST /api/onboarding/set-bundesland
 * Body: { bundesland: string }
 *
 * Individual kullanıcı için onboarding'te bundesland set + trial
 * subscription yarat. Bundesland privileged kolon değil, ama flow'u
 * server-side'a taşımak subscription insert'ünün de tek yerden yapılmasını
 * garantiliyor.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const bundesland = typeof body?.bundesland === "string" ? body.bundesland.trim() : "";

  const VALID_BL = ["BB","BE","BW","BY","HB","HE","HH","MV","NI","NW","RP","SH","SL","SN","ST","TH"];
  if (!VALID_BL.includes(bundesland)) {
    return NextResponse.json({ error: "Bundesland ungültig" }, { status: 400 });
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error: profileErr } = await admin
    .from("profiles")
    .update({ bundesland })
    .eq("user_id", user.id);

  if (profileErr) {
    return NextResponse.json({ error: "Profil konnte nicht aktualisiert werden." }, { status: 500 });
  }

  // Idempotent trial subscription (yoksa yarat)
  const { data: existingSub } = await admin
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existingSub) {
    await admin.from("subscriptions").insert({
      user_id: user.id,
      plan: "trial",
      status: "trialing",
      currency: "eur",
      trial_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return NextResponse.json({ ok: true });
}
