import Stripe from "stripe";

/**
 * Lazy Stripe client — sadece ilk kullanımda init olur.
 *
 * Sebep: Stripe v22 constructor'ı placeholder string'i de reddediyor
 * ("Neither apiKey nor config.authenticator provided"). Eski "sk_test_placeholder"
 * fallback'i artık çalışmıyor — modül yüklemede patlıyor (örn. Next.js build'in
 * "Collecting page data" fazı, /api/stripe/webhook route'unu evaluate ederken).
 *
 * Lazy init ile:
 *   - Build & SSR sırasında Stripe init olmaz, env eksik olsa bile patlama.
 *   - Sadece checkout/portal/webhook çağrıldığında env zorunlu olur.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  _stripe = new Stripe(key, {
    apiVersion: "2025-03-31.basil",
    typescript: true,
  });
  return _stripe;
}

/**
 * Geriye dönük uyumluluk için Proxy export — `stripe.checkout.sessions.create(...)`
 * şeklindeki mevcut kullanımlar lazy init üzerinden çalışır.
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return Reflect.get(getStripe(), prop);
  },
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
