import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendInvitationEmail } from "@/lib/email/resend";
import { checkRateLimit } from "@/lib/rateLimit/check";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit({ bucket: `invite_mail:${user.id}`, limit: 30, windowSec: 3600 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Zu viele Einladungen. Bitte später erneut." }, { status: 429 });
  }

  const { invitationId } = await req.json().catch(() => ({ invitationId: null }));
  if (typeof invitationId !== "string") return NextResponse.json({ error: "invitationId fehlt" }, { status: 400 });

  // Nur Admins der Firma, zu der die Einladung gehört
  const { data: me } = await supabase
    .from("profiles").select("company_id, role").eq("user_id", user.id).single();
  if (!me?.company_id || me.role !== "company_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: invitation } = await supabase
    .from("invitations")
    .select("*, companies(name)")
    .eq("id", invitationId)
    .eq("company_id", me.company_id)
    .eq("status", "pending")
    .single();

  if (!invitation) return NextResponse.json({ error: "Einladung nicht gefunden" }, { status: 404 });

  const { data: inviterProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .single();

  await sendInvitationEmail({
    to: invitation.email,
    companyName: (invitation.companies as { name: string } | null)?.name ?? "Ihr Unternehmen",
    inviterName: inviterProfile?.full_name ?? "Ein Administrator",
    token: invitation.token,
    role: invitation.role,
  });

  return NextResponse.json({ sent: true });
}
