import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/account/change-password
 *
 * Login zorunlu. Mantık:
 *  1. Aktif user'ın profili çek.
 *  2. must_change_password = false set et (service-role ile, RLS bypass).
 *
 * Not: Asıl şifre değişimi client tarafında supabase.auth.updateUser ile yapılır.
 *      Bu endpoint sadece flag'i temizler — çünkü user kendi profile satırını
 *      RLS üzerinden update edemez (admin policy var).
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
