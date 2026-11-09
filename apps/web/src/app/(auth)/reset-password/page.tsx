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
 *
 * SICHERHEIT (09.11.2026): Nur die Sitzung AUS DEM LINK zählt, nie eine schon vorhandene Anmeldung.
 * Vorher: Admin-Reset-Link (Implicit, #access_token) im Browser des eingeloggten Admins → der PKCE-Client
 * verwirft den Link, behält die Admin-Sitzung → das Formular änderte das Passwort des ADMINS.
 *   - #access_token…&type=recovery (Admin-Panel) → setSession explizit
 *   - ?code=… (Passwort vergessen, PKCE) → zählt nur, wenn der Client den Code eingelöst hat (Code aus URL entfernt)
 *   - sonst → "Link ungültig", auch wenn jemand eingeloggt ist
 * Das Formular zeigt die E-Mail des Kontos, dessen Passwort geändert wird.
 */

type LinkInfo = { code: string | null; access_token: string | null; refresh_token: string | null; type: string | null };

/** URL beim ersten Rendern lesen — bevor der Supabase-Client sie verarbeitet/entfernt. */
function readLink(): LinkInfo | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const h = new URLSearchParams(window.location.hash.slice(1));
  return { code: q.get("code"), access_token: h.get("access_token"), refresh_token: h.get("refresh_token"), type: h.get("type") };
}
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
  const [forEmail, setForEmail]     = useState<string | null>(null);
  const [link] = useState(readLink);

  useEffect(() => {
    async function check() {
      const supabase = createClient();
      let ok = false;
      if (link?.access_token && link.refresh_token && link.type === "recovery") {
        // Admin-Link: Sitzung des Link-Kontos setzen (ersetzt eine vorhandene Anmeldung)
        const { error } = await supabase.auth.setSession({ access_token: link.access_token, refresh_token: link.refresh_token });
        ok = !error;
        window.history.replaceState(window.history.state, "", window.location.pathname);
      } else if (link?.code) {
        await supabase.auth.getSession(); // wartet, bis der Client den Code eingelöst hat
        // Eingelöst → Client entfernt ?code; steht er noch da, ist er abgelaufen/aus anderem Browser
        ok = !new URLSearchParams(window.location.search).has("code");
      }
      if (ok) {
        const { data: { user } } = await supabase.auth.getUser();
        setForEmail(user?.email ?? null);
        ok = !!user;
      }
      setHasSession(ok);
    }
    void check();
  }, [link]);

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
            fontFamily: "var(--font-syne),sans-serif", fontSize: 13, fontWeight: 800,
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
        Für <strong style={{ color: "var(--text)" }}>{forEmail}</strong>. Wähle ein starkes Passwort mit mindestens 8 Zeichen.
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
