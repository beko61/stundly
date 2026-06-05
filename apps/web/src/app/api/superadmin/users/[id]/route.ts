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

// DELETE /api/superadmin/users/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await checkSuperAdmin();
  if (!caller) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const { id } = await params;

  if (id === caller.id) {
    return NextResponse.json({ error: "Kendi hesabını silemezsin" }, { status: 400 });
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Auth kullanıcısını sil (profiles cascade ile silinir)
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
