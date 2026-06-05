import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendInvitationEmail } from "@/lib/email/resend";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { invitationId } = await req.json();

  const { data: invitation } = await supabase
    .from("invitations")
    .select("*, companies(name)")
    .eq("id", invitationId)
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
