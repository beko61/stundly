import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2025-03-31.basil",
  typescript: true,
});

export const PRICE_IDS: Record<string, Record<string, string>> = {
  individual: {
    monthly: process.env.STRIPE_PRICE_INDIVIDUAL_MONTHLY ?? "",
    yearly:  process.env.STRIPE_PRICE_INDIVIDUAL_YEARLY  ?? "",
  },
  team: {
    monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY ?? "",
    yearly:  process.env.STRIPE_PRICE_TEAM_YEARLY  ?? "",
  },
  business: {
    monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? "",
    yearly:  process.env.STRIPE_PRICE_BUSINESS_YEARLY  ?? "",
  },
};

export async function createCheckoutSession({
  priceId,
  customerId,
  companyId,
  userId,
  billingInterval,
  successUrl,
  cancelUrl,
  customerEmail,
}: {
  priceId: string;
  customerId?: string | undefined;
  companyId?: string | undefined;
  userId?: string | undefined;
  billingInterval: "monthly" | "yearly";
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | undefined;
}) {
  const params: Parameters<typeof stripe.checkout.sessions.create>[0] = {
    mode: "subscription",
    payment_method_types: ["card", "sepa_debit"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    locale: "de",
    subscription_data: {
      trial_period_days: 14,
      metadata: {
        company_id: companyId ?? "",
        user_id: userId ?? "",
      },
    },
    // Kleinunternehmer-Regelung (§ 19 UStG): keine MwSt — Stripe Tax deaktiviert
    tax_id_collection: { enabled: false },
    automatic_tax: { enabled: false },
    // Beta-Tester / Promo-Codes (z.B. BETA30) am Checkout eingebbar
    allow_promotion_codes: true,
    metadata: {
      company_id: companyId ?? "",
      user_id: userId ?? "",
      billing_interval: billingInterval,
    },
  };

  if (customerId) {
    params.customer = customerId;
  } else if (customerEmail) {
    params.customer_email = customerEmail;
  }

  return stripe.checkout.sessions.create(params);
}

export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
    locale: "de",
  });
}
