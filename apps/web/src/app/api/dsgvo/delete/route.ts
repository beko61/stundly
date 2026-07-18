import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rateLimit/check";

// Account silme talebi — günde 3 attempt. Endpoint zaten idempotent
// (existing pending check), rate limit sadece log spam koruması.
const DELETE_LIMIT_PER_DAY = 3;
const DELETE_WINDOW_SEC    = 86400;

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

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Mevcut talep var mı?
  const { data: existing } = await admin
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

  await admin.from("deletion_requests").insert({
    user_id: user.id,
    scheduled_for: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  await admin.from("audit_logs").insert({
    user_id: user.id,
    action: "deletion_requested",
    resource: "account",
  });

  return NextResponse.json({
    message: "Löschantrag gestellt. Ihr Konto wird in 30 Tagen gelöscht.",
    scheduled_for: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
}

// Silme talebini iptal et
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await admin
    .from("deletion_requests")
    .update({ status: "canceled" })
    .eq("user_id", user.id)
    .eq("status", "pending");

  return NextResponse.json({ message: "Löschantrag widerrufen." });
}
