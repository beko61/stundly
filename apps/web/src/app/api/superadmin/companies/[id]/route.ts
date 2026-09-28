import { NextRequest, NextResponse } from "next/server";
import { adminClient, checkSuperAdmin } from "@/lib/superadmin/auth";

/**
 * DELETE /api/superadmin/companies/[id]?confirm=<Firmenname>&users=1
 *
 * Löscht ein Unternehmen. Abo + Einladungen fallen per FK-Cascade mit weg.
 * Mitglieder:
 *   - users=1 → Konten werden komplett gelöscht (auth.users, Daten per Cascade)
 *   - sonst   → Konten bleiben als "individual" erhalten, samt eigener Zeiten
 * Super-Admins (und der Aufrufer selbst) werden nie gelöscht, nur vom Unternehmen gelöst.
 * Schutz: Firmenname muss exakt bestätigt werden; aktives Stripe-Abo blockiert.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await checkSuperAdmin();
  if (!caller) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const { id } = await params;
  const url = new URL(req.url);
  const confirm = (url.searchParams.get("confirm") ?? "").trim().toLowerCase();
  const deleteUsers = url.searchParams.get("users") === "1";

  const admin = adminClient();
  const { data: company } = await admin.from("companies").select("id, name").eq("id", id).maybeSingle();
  if (!company) return NextResponse.json({ error: "Firma bulunamadı" }, { status: 404 });
  if (!confirm || confirm !== String(company.name).trim().toLowerCase()) {
    return NextResponse.json({ error: "Onay için firma adını aynen yazın." }, { status: 400 });
  }

  // Laufendes, bezahltes Stripe-Abo → erst in Stripe kündigen (sonst wird weiter abgebucht)
  const { data: sub } = await admin
    .from("subscriptions").select("status, stripe_subscription_id").eq("company_id", id).maybeSingle();
  if (sub?.stripe_subscription_id && ["active", "past_due", "trialing"].includes(String(sub.status))) {
    return NextResponse.json(
      { error: "Bu firmanın aktif bir Stripe aboneliği var. Önce Stripe'ta iptal edin, sonra silin." },
      { status: 409 },
    );
  }

  const { data: members } = await admin
    .from("profiles").select("user_id, email, role").eq("company_id", id);
  const protectedIds = new Set(
    (members ?? []).filter((m) => m.role === "super_admin" || m.user_id === caller.id).map((m) => m.user_id as string),
  );
  const toDelete = deleteUsers ? (members ?? []).filter((m) => !protectedIds.has(m.user_id as string)) : [];

  // Audit ZUERST und ohne company_id (FK-Cascade würde den Eintrag sonst mitlöschen)
  await admin.from("audit_log").insert({
    actor_user_id: caller.id,
    company_id:    null,
    action:        "superadmin.company_deleted",
    resource_type: "company",
    resource_id:   id,
    payload:       { name: company.name, members: members?.length ?? 0, deleted_users: toDelete.length },
  });

  const failed: string[] = [];
  for (const m of toDelete) {
    const { error } = await admin.auth.admin.deleteUser(m.user_id as string);
    if (error) failed.push(`${m.email ?? m.user_id}: ${error.message}`);
  }

  // Verbleibende Mitglieder lösen — Firmen-Rollen werden zu "individual"
  await admin.from("profiles").update({ company_id: null, role: "individual" })
    .eq("company_id", id).in("role", ["employee", "company_admin"]);
  await admin.from("profiles").update({ company_id: null }).eq("company_id", id);

  const { error: delErr } = await admin.from("companies").delete().eq("id", id);
  if (delErr) return NextResponse.json({ error: delErr.message, failed }, { status: 500 });

  return NextResponse.json({
    success: true,
    deleted_users: toDelete.length - failed.length,
    detached_users: (members?.length ?? 0) - toDelete.length,
    failed,
  });
}
