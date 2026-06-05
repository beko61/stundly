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
    .select("company_id")
    .eq("user_id", user.id)
    .single();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .or(`user_id.eq.${user.id},company_id.eq.${profile?.company_id ?? ""}`)
    .not("stripe_customer_id", "is", null)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: "Kein aktives Abonnement" }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const body = await req.json().catch(() => ({}));
  const returnUrl = body.returnUrl ?? `${appUrl}/settings`;

  const session = await createPortalSession({
    customerId: sub.stripe_customer_id,
    returnUrl,
  });

  return NextResponse.json({ url: session.url });
}
