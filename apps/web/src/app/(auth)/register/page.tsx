"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DemoDataBadge } from "@/components/ui/DemoDataBadge";

function mapError(msg: string): string {
  if (msg.includes("already registered") || msg.includes("already been registered"))
    return "Diese E-Mail-Adresse ist bereits registriert.";
  if (msg.includes("Password should be at least"))
    return "Das Passwort muss mindestens 6 Zeichen lang sein.";
  if (msg.includes("Unable to validate email") || msg.includes("invalid email"))
    return "Bitte eine gültige E-Mail-Adresse eingeben.";
  if (msg.includes("rate limit") || msg.includes("too many"))
    return "Zu viele Versuche. Bitte einige Minuten warten.";
  if (msg.includes("Signup is disabled"))
    return "Die Registrierung ist derzeit deaktiviert. Bitte kontaktiere den Administrator.";
  return msg;
}

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token        = params.get("token");
  const inviteEmail  = params.get("email");

  const [fullName, setFullName]   = useState("");
  const [email, setEmail]         = useState(inviteEmail ?? "");
  const [password, setPassword]   = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [companyName, setCompanyName]   = useState<string | null>(null);

  // Davet linki varsa şirket adını çek (UI'da göster)
  useEffect(() => {
    if (!token) return;
    const supabase = createClient();
    supabase
      .from("invitations")
      .select("companies(name)")
      .eq("token", token)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle()
      .then(({ data }) => {
        const companies = data?.companies as unknown as { name: string } | { name: string }[] | null;
        const name = Array.isArray(companies) ? companies[0]?.name : companies?.name;
        if (name) setCompanyName(name);
      });
  }, [token]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    // Davet linki üzerinden gelen kullanıcılar için company_id + role metadata'da geçer
    // (handle_new_user trigger bunu okuyup profile'ı doğru company'ye bağlar)
    let inviteMeta: { role?: string; company_id?: string } = {};
    if (token) {
      const { data: inv } = await supabase
        .from("invitations")
        .select("company_id, role, email")
        .eq("token", token)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!inv) {
        setError("Einladung ist abgelaufen oder ungültig.");
        setLoading(false);
        return;
      }

      if (inv.email.toLowerCase() !== email.toLowerCase()) {
        setError("Die E-Mail-Adresse stimmt nicht mit der Einladung überein.");
        setLoading(false);
        return;
      }

      inviteMeta = { role: inv.role, company_id: inv.company_id };
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, ...inviteMeta } },
    });

    if (signUpError) {
      setError(mapError(signUpError.message));
      setLoading(false);
      return;
    }

    if (!data.session) {
      setNeedsConfirm(true);
      setLoading(false);
      return;
    }

    // Session var — davet varsa accept et, yoksa onboarding'e git
    if (token) {
      const acceptRes = await fetch("/api/invitations/accept", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token }),
      });
      const accept = await acceptRes.json();
      router.push(accept.redirectTo ?? "/tracker");
    } else {
      router.push("/onboarding/type");
    }
    router.refresh();
  }

  if (needsConfirm) {
    return (
      <div className="card" style={{ padding: "32px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>Bitte E-Mail prüfen</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
          Wir haben einen Bestätigungslink an <strong style={{ color: "var(--text)" }}>{email}</strong> gesendet.<br />
          Klicke auf den Link, um dich anzumelden.
        </p>
        <Link
          href={token ? `/login?token=${token}` : "/login"}
          style={{
            display: "inline-block", padding: "10px 28px", borderRadius: 10,
            background: "var(--accent)", color: "#fff", fontWeight: 700,
            fontSize: 13, textDecoration: "none",
          }}
        >
          Zur Anmeldung
        </Link>
        <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 16 }}>
          Keine Mail erhalten? Bitte Spam-Ordner prüfen.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "28px 24px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
        {token ? "Einladung annehmen" : "Konto erstellen"}
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
        {token && companyName
          ? `Trete ${companyName} bei.`
          : token
            ? "Trete deinem Team auf Stundly bei."
            : "Starte dein Stundly-Konto."}
      </p>

      <DemoDataBadge />

      <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label className="label">Vollständiger Name</label>
          <input
            className="input"
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Max Mustermann"
            required
            autoComplete="name"
          />
        </div>

        <div>
          <label className="label">E-Mail</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="deine@email.de"
            required
            autoComplete="email"
            readOnly={!!inviteEmail}
            style={inviteEmail ? { background: "var(--surface2)", cursor: "not-allowed" } : undefined}
          />
          {inviteEmail && (
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
              Diese E-Mail wurde mit der Einladung verknüpft.
            </p>
          )}
        </div>

        <div>
          <label className="label">Passwort</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Mindestens 6 Zeichen"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        {error && (
          <p style={{
            color: "var(--red)", fontSize: 13,
            background: "color-mix(in srgb, var(--red) 10%, transparent)",
            padding: "10px 12px", borderRadius: 8,
          }}>
            {error}
          </p>
        )}

        <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
          {loading ? "Laden..." : token ? "Konto erstellen & beitreten" : "Registrieren"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: 20, color: "var(--muted)", fontSize: 13 }}>
        Bereits ein Konto?{" "}
        <Link href={token ? `/login?token=${token}` : "/login"} style={{ color: "var(--accent2)", fontWeight: 700 }}>
          Anmelden
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="card" style={{ padding: 32, textAlign: "center" }}>Laden...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
