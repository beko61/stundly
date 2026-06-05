"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function mapError(msg: string): string {
  if (msg.includes("already registered") || msg.includes("already been registered"))
    return "Bu e-posta adresi zaten kayıtlı.";
  if (msg.includes("Password should be at least"))
    return "Şifre en az 6 karakter olmalıdır.";
  if (msg.includes("Unable to validate email") || msg.includes("invalid email"))
    return "Geçerli bir e-posta adresi girin.";
  if (msg.includes("rate limit") || msg.includes("too many"))
    return "Çok fazla deneme. Lütfen birkaç dakika bekleyin.";
  if (msg.includes("Signup is disabled"))
    return "Kayıt şu an kapalı. Lütfen yöneticiyle iletişime geçin.";
  return msg;
}

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
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

    // Supabase email onayı açıksa session gelmez
    if (!data.session) {
      setNeedsConfirm(true);
      setLoading(false);
      return;
    }

    // Session var → direkt onboarding
    router.push("/onboarding/type");
    router.refresh();
  }

  // Email onayı bekleniyor ekranı
  if (needsConfirm) {
    return (
      <div className="card" style={{ padding: "32px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>E-postanı kontrol et</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
          <strong style={{ color: "var(--text)" }}>{email}</strong> adresine
          bir onay linki gönderdik.<br />
          Linke tıkladıktan sonra giriş yapabilirsin.
        </p>
        <Link
          href="/login"
          style={{
            display: "inline-block", padding: "10px 28px", borderRadius: 10,
            background: "var(--accent)", color: "#fff", fontWeight: 700,
            fontSize: 13, textDecoration: "none",
          }}
        >
          Giriş sayfasına git
        </Link>
        <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 16 }}>
          Mail gelmedi mi? Spam klasörünü kontrol et.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "28px 24px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Konto erstellen</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
        Starte dein Workly-Konto.
      </p>

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
          />
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
          {loading ? "Laden..." : "Registrieren"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: 20, color: "var(--muted)", fontSize: 13 }}>
        Bereits ein Konto?{" "}
        <Link href="/login" style={{ color: "var(--accent2)", fontWeight: 700 }}>
          Anmelden
        </Link>
      </p>
    </div>
  );
}
