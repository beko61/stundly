import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rateLimit/check";

// Account silme talebi — günde 3 attempt. Endpoint zaten idempotent
// (existing pending check), rate limit sadece log spam koruması.
const DELETE_LIMIT_PER_DAY = 3;
const DELETE_WINDOW_SEC    = 86400;
const WAIT_DAYS            = 30;

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Selbstlöschung nur für eigenständige Konten. Bei Firmenkonten ist der Arbeitgeber
 * Verantwortlicher (AVV) und muss Arbeitszeitnachweise aufbewahren (§ 16 Abs. 2 ArbZG) —
 * die Löschung läuft dort über den Firmen-Admin.
 */
async function isCompanyAccount(db: ReturnType<typeof admin>, userId: string): Promise<boolean> {
  const { data } = await db.from("profiles").select("company_id").eq("user_id", userId).maybeSingle();
  return !!data?.company_id;
}

// Status für die Einstellungen: offener Antrag? Selbstlöschung erlaubt?
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = admin();
  const [{ data: pending }, companyAccount] = await Promise.all([
    db.from("deletion_requests")
      .select("scheduled_for")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle(),
    isCompanyAccount(db, user.id),
  ]);

  return NextResponse.json({
    pending: pending ? { scheduled_for: pending.scheduled_for as string } : null,
    selfService: !companyAccount,
  });
}

// DSGVO Art. 17 — Recht auf Löschung (30 Tage Wartefrist)
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit({
    bucket:    `dsgvo_delete:${user.id}`,
    limit:     DELETE_LIMIT_PER_DAY,
    windowSec: DELETE_WINDOW_SEC,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Zu viele Löschanfragen. Bitte später erneut versuchen." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const db = admin();

  if (await isCompanyAccount(db, user.id)) {
    return NextResponse.json(
      { error: "Dein Konto gehört zu einem Firmenkonto. Die Löschung beantragst du bei deinem Arbeitgeber." },
      { status: 403 },
    );
  }

  // Mevcut talep var mı?
  const { data: existing } = await db
    .from("deletion_requests")
    .select("id, status, scheduled_for")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      message: "Löschantrag bereits gestellt",
      scheduled_for: existing.scheduled_for,
    });
  }

  const scheduledFor = new Date(Date.now() + WAIT_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await db.from("deletion_requests").insert({
    user_id: user.id,
    scheduled_for: scheduledFor,
  });
  if (error) {
    return NextResponse.json({ error: "Löschantrag konnte nicht gespeichert werden." }, { status: 500 });
  }

  await db.from("audit_logs").insert({
    user_id: user.id,
    action: "deletion_requested",
    resource: "account",
  });

  return NextResponse.json({
    message: `Löschantrag gestellt. Ihr Konto wird in ${WAIT_DAYS} Tagen gelöscht.`,
    scheduled_for: scheduledFor,
  });
}

// Silme talebini iptal et
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = admin();
  const { error } = await db
    .from("deletion_requests")
    .update({ status: "canceled" })
    .eq("user_id", user.id)
    .eq("status", "pending");
  if (error) {
    return NextResponse.json({ error: "Widerruf fehlgeschlagen." }, { status: 500 });
  }

  await db.from("audit_logs").insert({
    user_id: user.id,
    action: "deletion_canceled",
    resource: "account",
  });

  return NextResponse.json({ message: "Löschantrag widerrufen." });
}
