"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token   = params.get("token");
  const blocked = params.get("blocked");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    blocked === "deleted"  ? "Dein Konto wurde gelöscht. Bitte wende dich an deinen Administrator."
  : blocked === "inactive" ? "Dein Konto ist deaktiviert. Bitte wende dich an deinen Administrator."
  : null
  );
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError("E-Mail oder Passwort ist falsch.");
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Soft-delete / deaktiviert gate
    const { data: gateProfile } = await supabase
      .from("profiles")
      .select("is_active, deleted_at")
      .eq("user_id", user.id)
      .single();
    if (gateProfile?.deleted_at) {
      await supabase.auth.signOut();
      setError("Dein Konto wurde gelöscht. Bitte wende dich an deinen Administrator.");
      setLoading(false);
      return;
    }
    if (gateProfile?.is_active === false) {
      await supabase.auth.signOut();
      setError("Dein Konto ist deaktiviert. Bitte wende dich an deinen Administrator.");
      setLoading(false);
      return;
    }

    // Davet token'i ile geldiyse önce kabul akışını çalıştır
    if (token) {
      const acceptRes = await fetch("/api/invitations/accept", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token }),
      });
      const accept = await acceptRes.json();
      if (acceptRes.ok && accept.redirectTo) {
        router.push(accept.redirectTo);
        router.refresh();
        return;
      }
      // Davet hatalı/expired ise normal akışa düş — hatayı göster ama login'i kabul et
      if (!acceptRes.ok) {
        setError(accept.error ?? "Einladung konnte nicht angewendet werden.");
      }
    }

    // Rol-bazlı yönlendirme
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const role = profile?.role ?? "individual";

    if (role === "super_admin") {
      router.push("/superadmin");
    } else if (role === "company_admin") {
      router.push("/company/dashboard");
    } else {
      router.push("/dashboard");
    }

    router.refresh();
  }

  return (
    <div className="card" style={{ padding: "28px 24px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
        {token ? "Anmelden & Einladung annehmen" : "Willkommen zurück"}
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
        {token ? "Melde dich an, um deinem Team beizutreten." : "Melde dich an, um fortzufahren."}
      </p>

      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
          />
        </div>

        <div>
          <label className="label">Passwort</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p style={{ color: "var(--red)", fontSize: 13, background: "color-mix(in srgb, var(--red) 10%, transparent)", padding: "10px 12px", borderRadius: 8 }}>
            {error}
          </p>
        )}

        <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
          {loading ? "Laden..." : token ? "Anmelden & beitreten" : "Anmelden"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: 20, color: "var(--muted)", fontSize: 13 }}>
        Noch kein Konto?{" "}
        <Link href={token ? `/register?token=${token}` : "/register"} style={{ color: "var(--accent2)", fontWeight: 700 }}>
          Registrieren
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="card" style={{ padding: 32, textAlign: "center" }}>Laden...</div>}>
      <LoginForm />
    </Suspense>
  );
}
