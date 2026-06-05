import { createClient as createAdmin } from "@supabase/supabase-js";
import Link from "next/link";
import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function JoinPage({ params }: Props) {
  const { token } = await params;

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: invitation } = await admin
    .from("invitations")
    .select("*, companies(name)")
    .eq("token", token)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!invitation) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
        <div className="card" style={{ maxWidth: 420, width: "100%", padding: "40px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <h1 style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>Einladung ungültig</h1>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
            Diese Einladung ist abgelaufen oder wurde bereits verwendet.
          </p>
          <Link href="/login" className="btn btn-primary" style={{ display: "block" }}>Zur Anmeldung</Link>
        </div>
      </div>
    );
  }

  const companyName = (invitation.companies as { name: string } | null)?.name ?? "Ihr Unternehmen";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
      <div className="card" style={{ maxWidth: 420, width: "100%", padding: "40px 32px", textAlign: "center" }}>
        <div style={{ color: "var(--accent2)", fontWeight: 800, fontSize: 14, letterSpacing: 2, marginBottom: 28 }}>WORKLY</div>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🤝</div>
        <h1 style={{ fontWeight: 800, fontSize: 22, marginBottom: 8 }}>Einladung erhalten</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
          Sie wurden eingeladen, <strong style={{ color: "var(--text)" }}>{companyName}</strong> auf Workly beizutreten.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link
            href={`/register?token=${token}&email=${invitation.email}`}
            className="btn btn-primary"
            style={{ padding: "13px", fontSize: 15 }}
          >
            Konto erstellen & beitreten
          </Link>
          <Link
            href={`/login?token=${token}`}
            className="btn"
            style={{ padding: "13px", fontSize: 14, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
          >
            Bereits registriert? Anmelden
          </Link>
        </div>

        <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 20 }}>
          Einladung gültig bis: {new Date(invitation.expires_at).toLocaleDateString("de-DE")}
        </p>
      </div>
    </div>
  );
}
