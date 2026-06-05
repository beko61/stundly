import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

// Bu endpoint sadece sistemde hiç super_admin yokken çalışır.
// İlk kurulum için kullanılır — sonrasında otomatik devre dışı kalır.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Giriş yapman gerekiyor" }, { status: 401 });
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Sistemde zaten super_admin var mı?
  const { data: existing } = await admin
    .from("profiles")
    .select("user_id")
    .eq("role", "super_admin")
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "Sistemde zaten bir super_admin mevcut. Bu endpoint devre dışı." },
      { status: 403 }
    );
  }

  // Rol ata
  const { error } = await admin
    .from("profiles")
    .update({ role: "super_admin" })
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: "super_admin rolü atandı. Şimdi /superadmin adresine gidebilirsin.",
    user_id: user.id,
    email: user.email,
  });
}
