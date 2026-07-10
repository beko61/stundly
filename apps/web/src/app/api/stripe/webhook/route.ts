import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { sendSubscriptionConfirmationEmail } from "@/lib/email/resend";
import type Stripe from "stripe";

function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Stripe v22'de Subscription alanları farklı — unknown üzerinden erişiyoruz
type StripeSubRaw = {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_start: number;
  current_period_end: number;
  items: { data: { price: { id: string } }[] };
  metadata: Record<string, string>;
  customer: string;
};

type StripeInvoiceRaw = {
  subscription?: string | { id: string } | null;
};

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getAdminClient();

  // R1 fix — Idempotency guard.
  // Stripe retry mekanizması aynı event.id ile bir daha gelirse:
  //  - Eğer processed=true ise handler'ı yeniden çalıştırma (duplicate email
  //    + duplicate plan flip önle) → 200 early return.
  //  - Eğer henüz processed=false ise (bir önceki denemede yarıda kalmış)
  //    yeniden dene.
  const { data: existing } = await supabase
    .from("stripe_webhook_events")
    .select("processed")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existing?.processed) {
    // Zaten işlenmiş — Stripe'a OK dön, tekrar retry etmesin.
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (!existing) {
    // İlk defa görüyoruz — insert. Race condition olursa unique constraint
    // yakalayacak; ignore edip devam et.
    const { error: insertErr } = await supabase.from("stripe_webhook_events").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
    });
    if (insertErr && !String(insertErr.message).includes("duplicate")) {
      console.error("[stripe/webhook] event insert failed:", insertErr.message);
    }
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(supabase, event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(supabase, event.data.object as unknown as StripeSubRaw);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(supabase, event.data.object as unknown as StripeSubRaw);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(supabase, event.data.object as unknown as StripeInvoiceRaw);
        break;
    }

    await supabase.from("stripe_webhook_events").update({ processed: true }).eq("stripe_event_id", event.id);
  } catch (err) {
    await supabase.from("stripe_webhook_events").update({ error: String(err) }).eq("stripe_event_id", event.id);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// Supabase service-role admin client — generic schema typing too strict for dynamic upserts.
// eslint-disable-next-line
type SupabaseAdmin = any;

async function handleCheckoutCompleted(supabase: SupabaseAdmin, session: Stripe.Checkout.Session) {
  const companyId = session.metadata?.company_id || null;
  const userId = session.metadata?.user_id || null;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  const stripeSub = await stripe.subscriptions.retrieve(subscriptionId) as unknown as StripeSubRaw;
  const priceId = stripeSub.items.data[0]?.price.id;

  const planMap: Record<string, string> = {
    [process.env.STRIPE_PRICE_INDIVIDUAL_MONTHLY ?? "x"]: "individual",
    [process.env.STRIPE_PRICE_INDIVIDUAL_YEARLY  ?? "x"]: "individual",
    [process.env.STRIPE_PRICE_TEAM_MONTHLY       ?? "x"]: "team",
    [process.env.STRIPE_PRICE_TEAM_YEARLY        ?? "x"]: "team",
    [process.env.STRIPE_PRICE_BUSINESS_MONTHLY   ?? "x"]: "business",
    [process.env.STRIPE_PRICE_BUSINESS_YEARLY    ?? "x"]: "business",
  };
  const plan = planMap[priceId ?? ""] ?? "individual";

  await supabase.from("subscriptions").upsert({
    company_id: companyId || null,
    user_id: companyId ? null : userId,
    plan,
    status: stripeSub.status,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    stripe_price_id: priceId,
    current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
    current_period_end:   new Date(stripeSub.current_period_end   * 1000).toISOString(),
    currency: "eur",
  }, { onConflict: "stripe_subscription_id" });

  if (companyId) {
    await supabase.from("profiles").update({ plan }).eq("company_id", companyId);
  } else if (userId) {
    await supabase.from("profiles").update({ plan }).eq("user_id", userId);
  }

  // ── Confirmation email — sessizce yut, kritik akışı bozma ──
  try {
    let toEmail: string | null = session.customer_details?.email ?? null;
    let name: string = session.customer_details?.name ?? "Kunde";

    // company veya user profil bilgisi
    if (!toEmail || name === "Kunde") {
      if (userId) {
        const { data: prof } = await supabase.from("profiles")
          .select("email, vorname, full_name").eq("user_id", userId).maybeSingle();
        if (!toEmail) toEmail = prof?.email as string | null;
        if (name === "Kunde") name = (prof?.vorname as string | null) ?? (prof?.full_name as string | null) ?? "Kunde";
      } else if (companyId) {
        const { data: prof } = await supabase.from("profiles")
          .select("email, vorname, full_name").eq("company_id", companyId).eq("role", "company_admin").limit(1).maybeSingle();
        if (!toEmail) toEmail = prof?.email as string | null;
        if (name === "Kunde") name = (prof?.vorname as string | null) ?? (prof?.full_name as string | null) ?? "Kunde";
      }
    }

    const priceObj = stripeSub.items.data[0]?.price as unknown as { unit_amount?: number; recurring?: { interval?: string } };
    const amount = priceObj?.unit_amount ? (priceObj.unit_amount / 100).toFixed(2) : "0.00";
    const planName = plan === "team" ? "Team" : plan === "business" ? "Business" : "Individual";
    const periodEnd = new Date(stripeSub.current_period_end * 1000).toLocaleDateString("de-DE");

    if (toEmail) {
      await sendSubscriptionConfirmationEmail({ to: toEmail, name, planName, periodEnd, amount });
    }
  } catch (err) {
    console.error("subscription email failed:", err);
  }
}

async function handleSubscriptionUpdated(supabase: SupabaseAdmin, sub: StripeSubRaw) {
  await supabase.from("subscriptions").update({
    status: sub.status,
    current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
    current_period_end:   new Date(sub.current_period_end   * 1000).toISOString(),
    cancel_at_period_end: sub.cancel_at_period_end,
  }).eq("stripe_subscription_id", sub.id);
}

async function handleSubscriptionDeleted(supabase: SupabaseAdmin, sub: StripeSubRaw) {
  await supabase.from("subscriptions").update({
    status: "canceled",
    canceled_at: new Date().toISOString(),
  }).eq("stripe_subscription_id", sub.id);
}

async function handlePaymentFailed(supabase: SupabaseAdmin, invoice: StripeInvoiceRaw) {
  const subId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription?.id;
  if (!subId) return;
  await supabase.from("subscriptions").update({ status: "past_due" }).eq("stripe_subscription_id", subId);
}

export const config = { api: { bodyParser: false } };
