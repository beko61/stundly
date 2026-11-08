import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession, PRICE_IDS } from "@/lib/stripe/server";
import { isBetaActive, BETA_END_DATE_LABEL } from "@/lib/beta";

export async function POST(req: NextRequest) {
  // Beta-Phase: Zahlungen sind komplett deaktiviert.
  if (isBetaActive()) {
    return NextResponse.json(
      {
        error: `Stundly ist während der Beta-Phase bis ${BETA_END_DATE_LABEL} komplett kostenlos. Eine Buchung ist erst ab dem Beta-Ende möglich.`,
        beta: true,
      },
      { status: 403 }
    );
  }

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

  // Firmen-Tarife bucht nur der Chef seiner Firma
  const isCompanyAdmin = profile?.role === "company_admin";
  const forCompany = plan === "team" || plan === "business";
  if (forCompany && !(isCompanyAdmin && profile?.company_id)) {
    return NextResponse.json({ error: "Firmen-Tarife kann nur der Firmen-Admin buchen." }, { status: 403 });
  }

  // Mevcut Stripe customer ID kontrol et
  const owners = [`user_id.eq.${user.id}`];
  if (forCompany && profile?.company_id) owners.push(`company_id.eq.${profile.company_id}`);
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .or(owners.join(","))
    .not("stripe_customer_id", "is", null)
    .maybeSingle();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const session = await createCheckoutSession({
      priceId,
      customerId: sub?.stripe_customer_id ?? undefined,
      companyId: forCompany ? (profile?.company_id ?? undefined) : undefined,
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
