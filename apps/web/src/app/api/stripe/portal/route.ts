import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPortalSession } from "@/lib/stripe/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("user_id", user.id)
    .single();

  // Firmen-Abo verwalten (kündigen, Zahlungsart) darf nur der Chef — nicht jeder Mitarbeiter
  const isCompanyAdmin = profile?.role === "company_admin" || profile?.role === "super_admin";
  const owners = [`user_id.eq.${user.id}`];
  if (profile?.company_id && isCompanyAdmin) owners.push(`company_id.eq.${profile.company_id}`);

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .or(owners.join(","))
    .not("stripe_customer_id", "is", null)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: "Kein aktives Abonnement" }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  // Rücksprung nur auf eigene Seiten (kein offener Redirect über Stripe)
  const body = await req.json().catch(() => ({})) as { returnPath?: unknown };
  const path = typeof body.returnPath === "string" && /^\/(?!\/)[\w\-/?=&.#]*$/.test(body.returnPath)
    ? body.returnPath : "/settings";
  const returnUrl = `${appUrl}${path}`;

  const session = await createPortalSession({
    customerId: sub.stripe_customer_id,
    returnUrl,
  });

  return NextResponse.json({ url: session.url });
}
