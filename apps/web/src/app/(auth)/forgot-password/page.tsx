"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * Şifre sıfırlama başlatma sayfası.
 *
 * Akış:
 *   1. Kullanıcı email girer
 *   2. supabase.auth.resetPasswordForEmail → Supabase Auth email şablonuyla
 *      recovery link gönderir (mail'de {{ .SiteURL }}/reset-password#...)
 *   3. Bu sayfa "email gönderildi" onayı gösterir
 *   4. Kullanıcı email'inden linke tıklar → /reset-password sayfası → yeni şifre
 *
 * Güvenlik: Email adresi sistemde yoksa da 200 OK dönülür — kullanıcı
 * enumeration saldırısını önlemek için.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    setLoading(false);
    if (err) {
      // NOT: Supabase gerçek hata dönebilir (rate limit, malformed email).
      // Kullanıcıya spesifik mesaj vermiyoruz — enumeration'ı önlemek için
      // her koşulda "email gönderildi" göster. Log'a sadece error yaz.
      console.error("[forgot-password]", err.message);
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="card" style={{ padding: "32px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>Bitte E-Mail prüfen</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
          Wenn ein Konto mit <strong style={{ color: "var(--text)" }}>{email}</strong> existiert,
          haben wir einen Link zum Zurücksetzen des Passworts gesendet.
          <br /><br />
          Der Link ist 1 Stunde gültig. Prüfe auch deinen Spam-Ordner.
        </p>
        <Link
          href="/login"
          style={{
            display: "inline-block", padding: "10px 28px", borderRadius: 10,
            background: "var(--accent2)", color: "#1a1a2e",
            fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 800,
            textDecoration: "none",
          }}
        >
          Zurück zur Anmeldung
        </Link>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "28px 24px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
        Passwort vergessen?
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
        Gib deine E-Mail-Adresse ein. Wir senden dir einen Link zum
        Zurücksetzen deines Passworts.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label className="label">E-Mail</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="deine@email.de"
            required
            autoComplete="email"
            autoFocus
          />
        </div>

        {error && (
          <p style={{ color: "var(--red)", fontSize: 13, background: "color-mix(in srgb, var(--red) 10%, transparent)", padding: "10px 12px", borderRadius: 8 }}>
            {error}
          </p>
        )}

        <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
          {loading ? "Wird gesendet..." : "Link senden"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: 20, color: "var(--muted)", fontSize: 13 }}>
        <Link href="/login" style={{ color: "var(--accent2)", fontWeight: 700 }}>
          ← Zurück zur Anmeldung
        </Link>
      </p>
    </div>
  );
}
