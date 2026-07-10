import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

/**
 * POST /api/onboarding/create-company
 * Body: { name: string, bundesland: string, vat_id?: string, city?: string }
 *
 * Onboarding'de "Unternehmen einrichten" adımı için server-side flow.
 * Client'ın direkt `profiles.role = 'company_admin'` yazamamasının sebebi:
 * migration 021'deki enforce_profile_privileges trigger'ı role/company_id
 * değişikliğini sadece service_role'e izin veriyor (privilege escalation
 * kapatması, bulgu S1).
 *
 * Akış:
 *   1. Kullanıcı authenticated olmalı.
 *   2. Kullanıcının halihazırda company'si yoksa (yoksa spam prevention).
 *   3. companies satırı yaratılır (user'ın anon session'ı ile).
 *   4. profiles.role = 'company_admin' + company_id (service_role ile
 *      privilege trigger'ı bypass).
 *   5. Trial subscription oluşturulur.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const name       = typeof body.name       === "string" ? body.name.trim()       : "";
  const bundesland = typeof body.bundesland === "string" ? body.bundesland.trim() : "";
  const vatId      = typeof body.vat_id     === "string" ? body.vat_id.trim()    : "";
  const city       = typeof body.city       === "string" ? body.city.trim()      : "";

  if (name.length < 2 || name.length > 200) {
    return NextResponse.json({ error: "Unternehmensname ungültig" }, { status: 400 });
  }

  const VALID_BL = ["BB","BE","BW","BY","HB","HE","HH","MV","NI","NW","RP","SH","SL","SN","ST","TH"];
  if (!VALID_BL.includes(bundesland)) {
    return NextResponse.json({ error: "Bundesland ungültig" }, { status: 400 });
  }

  // Idempotent: kullanıcı zaten company_admin ise geri dön
  const { data: existing } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("user_id", user.id)
    .single();

  if (existing?.company_id) {
    return NextResponse.json({ error: "Du hast bereits ein Unternehmen." }, { status: 409 });
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Companies satırı
  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert({
      name,
      bundesland,
      vat_id: vatId || null,
      city:   city  || null,
      owner_id: user.id,
      country_code: "DE",
    })
    .select("id")
    .single();

  if (companyError || !company) {
    return NextResponse.json({ error: "Fehler beim Erstellen des Unternehmens." }, { status: 500 });
  }

  // 2. Profile — role + company_id + bundesland
  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      role: "company_admin",
      company_id: company.id,
      bundesland,
    })
    .eq("user_id", user.id);

  if (profileErr) {
    // Rollback: company'i sil ki orphan kalmasın
    await admin.from("companies").delete().eq("id", company.id);
    return NextResponse.json({ error: "Profil konnte nicht aktualisiert werden." }, { status: 500 });
  }

  // 3. Trial subscription
  const { error: subErr } = await admin.from("subscriptions").insert({
    company_id: company.id,
    plan: "trial",
    status: "trialing",
    currency: "eur",
    trial_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (subErr) {
    // Non-fatal — company + profile kuruldu, sadece subscription eksik.
    // Cron/webhook trial subscription'ı sonradan da yaratabilir.
    console.error("[onboarding/create-company] Trial subscription eksik:", subErr);
  }

  return NextResponse.json({ ok: true, companyId: company.id });
}
