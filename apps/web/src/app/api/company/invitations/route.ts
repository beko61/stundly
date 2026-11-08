import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { getCompanyAdminContext } from "@/lib/company/admin";
import { logAudit } from "@/lib/audit/logger";
import { checkRateLimit } from "@/lib/rateLimit/check";

const LIMIT_PER_HOUR = 50;
const WINDOW_SEC     = 3600;
const VALID_DAYS     = 7;

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: "Ungültige E-Mail-Adresse" }).max(320),
});

/**
 * POST /api/company/invitations  Body: { email }
 *
 * Einladungslink für ein BESTEHENDES Stundly-Konto (neue Konten: /api/company/employees/create).
 * Gibt den Token zurück; der Admin kopiert den Link /join/<token> und gibt ihn weiter (keine E-Mail).
 * Der Beitritt selbst passiert erst beim Öffnen + Anmelden (/api/invitations/accept, unverändert).
 *
 * - schon im Team → 409 (sonst würde z. B. der Admin sich selbst zum Mitarbeiter herabstufen)
 * - offene, gültige Einladung → derselbe Token (kein Duplikat; unique company_id+email)
 * - abgelaufene/widerrufene/angenommene → neu ausgestellt (neuer Token, 7 Tage)
 */
export async function POST(req: NextRequest) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { admin, companyId, user } = ctx;

  const rl = await checkRateLimit({ bucket: `company_invite:${user.id}`, limit: LIMIT_PER_HOUR, windowSec: WINDOW_SEC });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Zu viele Einladungen. Bitte später erneut versuchen." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige E-Mail-Adresse" }, { status: 400 });
  const { email } = parsed.data;

  // ilike: Groß-/Kleinschreibung egal; % und _ wörtlich nehmen
  const { data: member } = await admin.from("profiles")
    .select("user_id").eq("company_id", companyId).ilike("email", email.replace(/[%_\\]/g, "\\$&"))
    .is("deleted_at", null).maybeSingle();
  if (member) return NextResponse.json({ error: "Diese Person ist bereits in deinem Team." }, { status: 409 });

  const { data: existing } = await admin.from("invitations")
    .select("id, token, status, expires_at").eq("company_id", companyId).eq("email", email).maybeSingle();

  if (existing?.status === "pending" && new Date(existing.expires_at).getTime() > Date.now()) {
    return NextResponse.json({ ok: true, token: existing.token, email });
  }

  const token = randomBytes(32).toString("hex");
  const expires_at = new Date(Date.now() + VALID_DAYS * 86_400_000).toISOString();
  const { error } = existing
    ? await admin.from("invitations")
        .update({ token, status: "pending", expires_at, accepted_at: null, invited_by: user.id, role: "employee" })
        .eq("id", existing.id)
    : await admin.from("invitations")
        .insert({ company_id: companyId, email, role: "employee", token, expires_at, invited_by: user.id });
  if (error) return NextResponse.json({ error: "Einladung konnte nicht erstellt werden." }, { status: 500 });

  await logAudit({
    admin, actorUserId: user.id, companyId,
    action: "invitation.created", resourceType: "invitation",
    payload: { email, method: "link" },
  });

  return NextResponse.json({ ok: true, token, email });
}
