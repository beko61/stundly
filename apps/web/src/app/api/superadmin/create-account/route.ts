import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

async function checkSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).single();
  if (profile?.role !== "super_admin") return null;
  return user;
}

export async function POST(req: NextRequest) {
  const caller = await checkSuperAdmin();
  if (!caller) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const body = await req.json();
  const { email, password, full_name, role, company_name, bundesland } = body;

  if (!email || !password || !full_name || !role) {
    return NextResponse.json({ error: "Zorunlu alanlar eksik" }, { status: 400 });
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Auth kullanıcısı oluştur
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (authErr || !created.user) {
    return NextResponse.json({ error: authErr?.message ?? "Kullanıcı oluşturulamadı" }, { status: 500 });
  }

  const userId = created.user.id;

  // 2. Profile güncelle (trigger zaten oluşturur, role'ü set et)
  await admin.from("profiles").update({ role, full_name }).eq("user_id", userId);

  // 3. Firma oluştur (company_admin için)
  if (role === "company_admin" && company_name) {
    const slug = company_name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    const { data: company, error: compErr } = await admin.from("companies").insert({
      name: company_name,
      slug: `${slug}-${Date.now()}`,
      bundesland: bundesland ?? "NI",
      country_code: "DE",
      owner_id: userId,
    }).select("id").single();

    if (compErr || !company) {
      return NextResponse.json({ error: "Firma oluşturulamadı: " + compErr?.message }, { status: 500 });
    }

    // Profili firma ile ilişkilendir
    await admin.from("profiles").update({ company_id: company.id }).eq("user_id", userId);

    // Trial subscription oluştur
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    await admin.from("subscriptions").insert({
      company_id: company.id,
      plan: "trial",
      status: "trialing",
      currency: "EUR",
      trial_end: trialEnd.toISOString(),
    });
  }

  return NextResponse.json({ success: true, user_id: userId, email });
}
