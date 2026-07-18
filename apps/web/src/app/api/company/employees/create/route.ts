import { NextRequest, NextResponse } from "next/server";
import { getCompanyAdminContext } from "@/lib/company/admin";
import { logAudit } from "@/lib/audit/logger";
import { createEmployeeSchema } from "@/lib/validation/schemas";
import { checkRateLimit } from "@/lib/rateLimit/check";

// Admin per company başına saatte 50 employee create — real akışta 5-10
// yeter, spam/typosquatting saldırısını önler.
const CREATE_EMP_LIMIT_PER_HOUR = 50;
const CREATE_EMP_WINDOW_SEC     = 3600;

/**
 * POST /api/company/employees/create
 * Body: { email, password, full_name, role: "employee" | "company_admin" }
 *
 * Admin email + geçici şifre + isim + role girer, kullanıcı doğrudan oluşturulur.
 * Resend email gönderilmez (davet akışı /api/email/invite + /join/[token]).
 *
 * Akış:
 *   1. supabase.auth.admin.createUser (email_confirm: true → email doğrulama atlanır)
 *   2. profiles UPDATE (company_id, role, full_name, must_change_password=true)
 *      (trigger profile satırı oluşturmuş varsayılır — onboarding pattern)
 *   3. Audit log: employee.created
 *
 * Mitarbeiter ilk login'de /password-change'e yönlendirilir (must_change_password flag).
 *
 * Güvenlik:
 *   - company_admin gate
 *   - Email zaten kayıtlı ise 409
 *   - Şifre min 8 karakter
 *   - Role employee veya company_admin
 */
export async function POST(req: NextRequest) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { admin, companyId, user } = ctx;

  const rl = await checkRateLimit({
    bucket:    `employees_create:${user.id}`,
    limit:     CREATE_EMP_LIMIT_PER_HOUR,
    windowSec: CREATE_EMP_WINDOW_SEC,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Zu viele Mitarbeiter angelegt. Bitte später erneut versuchen." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = createEmployeeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({
      error:   "Ungültige Eingabe",
      details: parsed.error.flatten().fieldErrors,
    }, { status: 400 });
  }
  const { email, password, full_name: fullName, role } = parsed.data;

  // 1. Auth user oluştur
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // email doğrulama atlanır — admin onayladı sayılır
    user_metadata: { full_name: fullName },
  });

  if (authErr || !created?.user) {
    const msg = authErr?.message ?? "Mitarbeiter konnte nicht erstellt werden";
    const status = msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  const userId = created.user.id;

  // 2. Profile UPDATE — trigger satırı oluşturmuş olmalı.
  //    company_id, role, full_name, must_change_password set.
  const { error: profErr } = await admin
    .from("profiles")
    .update({
      company_id: companyId,
      role,
      full_name: fullName,
      must_change_password: true,
      is_active: true,
    })
    .eq("user_id", userId);

  if (profErr) {
    // Auth user oluştu ama profile güncellenemedi — rollback
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Profil konnte nicht erstellt werden", detail: profErr.message }, { status: 500 });
  }

  // 3. Audit
  await logAudit({
    admin,
    actorUserId:  ctx.user.id,
    companyId,
    action:       "employee.created",
    resourceType: "profile",
    resourceId:   userId,
    payload: {
      email,
      full_name: fullName,
      role,
      method: "direct_create", // davet akışından ayırt etmek için
    },
  });

  return NextResponse.json({
    ok: true,
    userId,
    email,
    full_name: fullName,
    role,
  });
}
