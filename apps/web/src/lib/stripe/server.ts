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

/** Stripe v22 exportiert den Parametertyp nicht direkt */
type CheckoutParams = NonNullable<Parameters<Stripe["checkout"]["sessions"]["create"]>[0]>;

type CheckoutInput = {
  priceId: string;
  customerId?: string | undefined;
  companyId?: string | undefined;
  userId?: string | undefined;
  billingInterval: "monthly" | "yearly";
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | undefined;
  /** Stripe-Coupon "-50 % forever" für Beta-Tester (STRIPE_BETA_COUPON_ID) — wird automatisch abgezogen */
  betaCouponId?: string | undefined;
};

/**
 * Checkout-Parameter (rein, testbar).
 * Keine Stripe-Testphase: die App gibt schon 30 Tage Plus ohne Karte (Entscheidung 17.11.2026) —
 * wer bucht, zahlt ab sofort.
 * Stripe erlaubt `discounts` und `allow_promotion_codes` nicht zusammen: mit Beta-Coupon kein Code-Feld.
 */
export function buildCheckoutParams(i: CheckoutInput): CheckoutParams {
  const params: CheckoutParams = {
    mode: "subscription",
    payment_method_types: ["card", "sepa_debit"],
    line_items: [{ price: i.priceId, quantity: 1 }],
    success_url: i.successUrl,
    cancel_url: i.cancelUrl,
    locale: "de",
    subscription_data: {
      metadata: {
        company_id: i.companyId ?? "",
        user_id: i.userId ?? "",
      },
    },
    // Kleinunternehmer-Regelung (§ 19 UStG): keine MwSt — Stripe Tax deaktiviert
    tax_id_collection: { enabled: false },
    automatic_tax: { enabled: false },
    metadata: {
      company_id: i.companyId ?? "",
      user_id: i.userId ?? "",
      billing_interval: i.billingInterval,
    },
  };

  if (i.betaCouponId) params.discounts = [{ coupon: i.betaCouponId }];
  else params.allow_promotion_codes = true;

  if (i.customerId) {
    params.customer = i.customerId;
  } else if (i.customerEmail) {
    params.customer_email = i.customerEmail;
  }
  return params;
}

export async function createCheckoutSession(i: CheckoutInput) {
  return stripe.checkout.sessions.create(buildCheckoutParams(i));
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
