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

// PATCH /api/superadmin/users/[id]
// Body: { role?: string } | { is_active?: boolean }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await checkSuperAdmin();
  if (!caller) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Kendi rolünü değiştirmeyi engelle
  if (body.role && id === caller.id) {
    return NextResponse.json({ error: "Kendi rolünü değiştiremezsin" }, { status: 400 });
  }

  const allowedRoles = ["super_admin", "company_admin", "employee", "individual"];
  if (body.role && !allowedRoles.includes(body.role)) {
    return NextResponse.json({ error: "Geçersiz rol" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.role !== undefined) updateData.role = body.role;
  if (body.is_active !== undefined) updateData.is_active = body.is_active;

  const { error } = await admin.from("profiles").update(updateData).eq("user_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/superadmin/users/[id]?confirm=<email>
 *
 * GÜVENLİK: Bulgu R6 fix — irreversible auth.users delete için
 * ?confirm=<target_email> query zorunlu. Yanlış tıklama = veri kaybı
 * riskini kaldırır. Audit log'a kaydeder.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await checkSuperAdmin();
  if (!caller) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const { id } = await params;

  if (id === caller.id) {
    return NextResponse.json({ error: "Kendi hesabını silemezsin" }, { status: 400 });
  }

  const url = new URL(req.url);
  const confirmEmail = url.searchParams.get("confirm")?.toLowerCase() ?? "";
  if (!confirmEmail) {
    return NextResponse.json(
      { error: "Bestätigung fehlt. ?confirm=<email> Parameter erforderlich." },
      { status: 400 }
    );
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Hedef kullanıcının email'ini oku ve confirm ile eşleşiyor mu doğrula
  const { data: target } = await admin
    .from("profiles")
    .select("email, company_id")
    .eq("user_id", id)
    .single();

  if (!target?.email) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  if (target.email.toLowerCase() !== confirmEmail) {
    return NextResponse.json(
      { error: "Bestätigung stimmt nicht mit der E-Mail überein." },
      { status: 400 }
    );
  }

  // Silmeden ÖNCE audit — auth.users delete cascade'de profiles ve
  // audit_log actor_user_id set-null. Bu yüzden log önce yazılmalı.
  await admin.from("audit_log").insert({
    actor_user_id: caller.id,
    company_id:    target.company_id, // null olabilir (individual users için)
    action:        "superadmin.user_deleted",
    resource_type: "auth_user",
    resource_id:   id,
    payload:       { email: target.email },
  });

  // Auth kullanıcısını sil (profiles cascade ile silinir)
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
