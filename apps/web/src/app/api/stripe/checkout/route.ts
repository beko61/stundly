import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession, PRICE_IDS } from "@/lib/stripe/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plan, interval = "monthly" } = await req.json() as {
    plan: "individual" | "team" | "business";
    interval: "monthly" | "yearly";
  };

  const priceId = PRICE_IDS[plan]?.[interval];
  if (!priceId) {
    return NextResponse.json({ error: "Ungültiger Plan" }, { status: 400 });
  }

  // Profil & şirket bilgisi al
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("user_id", user.id)
    .single();

  // Mevcut Stripe customer ID kontrol et
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .or(`user_id.eq.${user.id},company_id.eq.${profile?.company_id ?? ""}`)
    .not("stripe_customer_id", "is", null)
    .maybeSingle();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const session = await createCheckoutSession({
      priceId,
      customerId: sub?.stripe_customer_id ?? undefined,
      companyId: profile?.company_id ?? undefined,
      userId: user.id,
      billingInterval: interval,
      successUrl: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/pricing`,
      customerEmail: user.email,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    // Stripe SDK Fehler bekommen oft eine type=invalid_request_error mit aussagekräftiger Nachricht
    const message = err instanceof Error ? err.message : "Stripe API Fehler";
    const stripeType = (err as { type?: string })?.type;
    console.error("stripe/checkout failed:", { plan, interval, priceId: priceId.slice(0, 12) + "…", message, stripeType });
    return NextResponse.json(
      { error: message, type: stripeType ?? "unknown", priceIdPrefix: priceId.slice(0, 12) + "…" },
      { status: 500 }
    );
  }
}
