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
    return "Das Passwort muss mindestens 10 Zeichen lang sein.";
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
  const [agbAccepted, setAgbAccepted] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [companyName, setCompanyName]   = useState<string | null>(null);

  // P1 fix — Password strength: min 10 karakter + en az 1 rakam veya
  // özel karakter. Payroll-adjacent SaaS için 6 karakter compliance riski.
  function passwordStrengthError(pw: string): string | null {
    if (pw.length < 10) return "Passwort muss mindestens 10 Zeichen lang sein.";
    if (!/[0-9]/.test(pw) && !/[^A-Za-z0-9]/.test(pw)) {
      return "Passwort muss mindestens eine Zahl oder ein Sonderzeichen enthalten.";
    }
    return null;
  }

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

    // P2 fix — AGB akzeptiert Pflicht (Abmahn-Prävention)
    if (!agbAccepted) {
      setError("Bitte AGB und Datenschutzerklärung akzeptieren.");
      setLoading(false);
      return;
    }

    // P1 fix — Password strength server-side signup öncesi
    const pwErr = passwordStrengthError(password);
    if (pwErr) {
      setError(pwErr);
      setLoading(false);
      return;
    }

    const supabase = createClient();

    // Davet linki varsa client-side pre-flight email eşleşme kontrolü.
    // GÜVENLİK: role/company_id metadata'ya KOYULMAZ. Trigger metadata'ya
    // güvenmez (migration 021). Invitation apply'ı /api/invitations/accept
    // server-side'da service_role ile yapılır.
    if (token) {
      const { data: inv } = await supabase
        .from("invitations")
        .select("email")
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
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
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
            placeholder="Mindestens 10 Zeichen inkl. Zahl"
            required
            minLength={10}
            autoComplete="new-password"
          />
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            Mindestens 10 Zeichen, mit mindestens einer Zahl oder einem Sonderzeichen.
          </p>
        </div>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
          <input
            type="checkbox"
            checked={agbAccepted}
            onChange={(e) => setAgbAccepted(e.target.checked)}
            required
            style={{ width: 18, height: 18, marginTop: 1, accentColor: "var(--accent)", flexShrink: 0 }}
          />
          <span>
            Ich akzeptiere die{" "}
            <Link href="/agb" target="_blank" style={{ color: "var(--accent2)", fontWeight: 600 }}>AGB</Link>
            {" "}und die{" "}
            <Link href="/datenschutz" target="_blank" style={{ color: "var(--accent2)", fontWeight: 600 }}>Datenschutzerklärung</Link>.
          </span>
        </label>

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
