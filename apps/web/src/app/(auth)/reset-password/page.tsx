"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Şifre sıfırlama tamamlama sayfası — email'deki linkten geliniyor.
 *
 * Akış:
 *   1. Kullanıcı /forgot-password'de email girer, Supabase mail atar
 *   2. Mail linki: {SITE_URL}/reset-password#access_token=X&type=recovery&...
 *   3. Supabase client `detectSessionInUrl` (default: on) hash'i parse eder
 *      → geçici recovery session kurar
 *   4. Bu sayfa yeni şifre form gösterir
 *   5. Submit → supabase.auth.updateUser({ password: newPassword })
 *   6. Success → /login'e yönlendir (fresh sign-in için)
 *
 * Session yoksa (link expired veya direkt açıldı) — hata mesajı + retry link.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [success,         setSuccess]         = useState(false);

  // undefined  → henüz check edilmedi
  // true       → recovery session var
  // false      → session yok (link expired / direct visit)
  const [hasSession, setHasSession] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    async function check() {
      const supabase = createClient();
      // Supabase client hash'i otomatik parse eder ve session kurar
      // (detectSessionInUrl default true). Kısa bir gecikme sonrası kontrol.
      await new Promise(r => setTimeout(r, 100));
      const { data: { session } } = await supabase.auth.getSession();
      setHasSession(!!session);
    }
    void check();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen haben.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) {
      setError(err.message === "New password should be different from the old password."
        ? "Neues Passwort muss anders sein als das alte."
        : "Fehler beim Zurücksetzen. Bitte erneut versuchen.");
      return;
    }

    setSuccess(true);
    // Recovery session'ı temizle → user tekrar login etsin
    await supabase.auth.signOut();
    setTimeout(() => router.push("/login"), 2000);
  }

  // Loading state — session check
  if (hasSession === undefined) {
    return (
      <div className="card" style={{ padding: 32, textAlign: "center" }}>
        Laden...
      </div>
    );
  }

  // Link expired veya direct visit
  if (!hasSession) {
    return (
      <div className="card" style={{ padding: "32px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>Link ungültig oder abgelaufen</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
          Der Zurücksetzungs-Link ist abgelaufen oder wurde bereits verwendet.
          Bitte fordere einen neuen Link an.
        </p>
        <Link
          href="/forgot-password"
          style={{
            display: "inline-block", padding: "10px 28px", borderRadius: 10,
            background: "var(--accent2)", color: "#1a1a2e",
            fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 800,
            textDecoration: "none",
          }}
        >
          Neuen Link anfordern
        </Link>
      </div>
    );
  }

  // Success — auto-redirect 2 sn içinde
  if (success) {
    return (
      <div className="card" style={{ padding: "32px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>Passwort geändert</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.7 }}>
          Du wirst zur Anmeldung weitergeleitet...
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "28px 24px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
        Neues Passwort setzen
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
        Wähle ein starkes Passwort mit mindestens 8 Zeichen.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label className="label">Neues Passwort</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete="new-password"
            autoFocus
          />
        </div>

        <div>
          <label className="label">Passwort bestätigen</label>
          <input
            className="input"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        {error && (
          <p style={{ color: "var(--red)", fontSize: 13, background: "color-mix(in srgb, var(--red) 10%, transparent)", padding: "10px 12px", borderRadius: 8 }}>
            {error}
          </p>
        )}

        <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
          {loading ? "Wird gespeichert..." : "Passwort speichern"}
        </button>
      </form>
    </div>
  );
}
