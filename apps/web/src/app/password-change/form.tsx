"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  email:    string;
  fullName: string;
  role:     string;
}

export function PasswordChangeForm({ email, fullName, role }: Props) {
  const router = useRouter();
  const [pwd,     setPwd]     = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (pwd.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen haben.");
      return;
    }
    if (pwd !== confirm) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // 1) Auth password update
    const { error: pwdErr } = await supabase.auth.updateUser({ password: pwd });
    if (pwdErr) {
      setError(pwdErr.message ?? "Passwort konnte nicht geändert werden.");
      setLoading(false);
      return;
    }

    // 2) Clear must_change_password flag (server-side, service role)
    const res = await fetch("/api/account/change-password", { method: "POST" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Flag konnte nicht zurückgesetzt werden.");
      setLoading(false);
      return;
    }

    // 3) Role-basiert weiterleiten
    if (role === "super_admin")        router.push("/superadmin");
    else if (role === "company_admin") router.push("/company/dashboard");
    else                                router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="card" style={{ padding: "28px 24px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
        Passwort festlegen
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
        Willkommen{fullName ? `, ${fullName}` : ""}! Dein Konto wurde von deinem Administrator
        eingerichtet. Bitte wähle ein neues Passwort, bevor du fortfährst.
      </p>

      {email && (
        <div style={{
          background: "var(--surface2)", border: "1px solid var(--border)",
          borderRadius: 8, padding: "10px 12px", marginBottom: 16,
          fontSize: 12, color: "var(--muted)",
        }}>
          Angemeldet als <strong style={{ color: "var(--text)" }}>{email}</strong>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label className="label">Neues Passwort</label>
          <input
            className="input"
            type="password"
            value={pwd}
            onChange={e => setPwd(e.target.value)}
            placeholder="Mindestens 8 Zeichen"
            required
            minLength={8}
            autoComplete="new-password"
            autoFocus
          />
        </div>

        <div>
          <label className="label">Passwort wiederholen</label>
          <input
            className="input"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Nochmal eingeben"
            required
            minLength={8}
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

        <button
          className="btn btn-primary"
          type="submit"
          disabled={loading}
          style={{ marginTop: 4 }}
        >
          {loading ? "Speichern…" : "Passwort festlegen & fortfahren"}
        </button>
      </form>

      <p style={{ marginTop: 20, fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
        Tipp: Mind. 8 Zeichen. Verwende eine Kombination aus Buchstaben, Zahlen und Sonderzeichen.
      </p>
    </div>
  );
}
