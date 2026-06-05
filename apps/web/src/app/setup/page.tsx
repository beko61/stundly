"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);
  const router = useRouter();

  async function handleSetup() {
    setLoading(true);
    try {
      const res = await fetch("/api/setup/make-superadmin", { method: "POST" });
      const data = await res.json();
      setResult(data);
      if (data.success) {
        setTimeout(() => router.push("/superadmin"), 2000);
      }
    } catch {
      setResult({ error: "Bir hata oluştu." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div className="card" style={{ maxWidth: 420, width: "100%", padding: 40, textAlign: "center" }}>
        <div style={{ color: "var(--accent2)", fontWeight: 800, fontSize: 18, letterSpacing: 2, marginBottom: 8 }}>
          WORKLY
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 1,
          background: "color-mix(in srgb, var(--red) 15%, transparent)",
          color: "var(--red)", padding: "3px 10px", borderRadius: 6,
          display: "inline-block", marginBottom: 28,
        }}>
          İLK KURULUM
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>Super Admin Kurulumu</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 28 }}>
          Bu işlem giriş yaptığın hesabı <strong style={{ color: "var(--text)" }}>super_admin</strong> yapar.
          Sistemde henüz super admin yokken çalışır.
        </p>

        {!result && (
          <button
            onClick={handleSetup}
            disabled={loading}
            style={{
              width: "100%", padding: "12px 0", borderRadius: 10,
              background: loading ? "var(--surface2)" : "var(--accent)",
              color: "#fff", fontWeight: 700, fontSize: 14,
              border: "none", cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "İşleniyor..." : "Beni Super Admin Yap"}
          </button>
        )}

        {result?.success && (
          <div style={{
            padding: "14px 18px", borderRadius: 10, marginTop: 16,
            background: "color-mix(in srgb, var(--green) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--green) 30%, transparent)",
            color: "var(--green)", fontSize: 13, fontWeight: 600,
          }}>
            Super admin rolü atandı! Panele yönlendiriliyorsun...
          </div>
        )}

        {result?.error && (
          <div style={{
            padding: "14px 18px", borderRadius: 10, marginTop: 16,
            background: "color-mix(in srgb, var(--red) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)",
            color: "var(--red)", fontSize: 13,
          }}>
            {result.error}
          </div>
        )}
      </div>
    </div>
  );
}
