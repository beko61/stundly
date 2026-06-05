"use client";

import { useState } from "react";

const BUNDESLAENDER = [
  "BW","BY","BE","BB","HB","HH","HE","MV","NI","NW","RP","SL","SN","ST","SH","TH"
];

type Role = "individual" | "employee" | "company_admin";

export default function CreateAccountPage() {
  const [role, setRole]             = useState<Role>("individual");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [fullName, setFullName]     = useState("");
  const [companyName, setCompanyName] = useState("");
  const [bundesland, setBundesland] = useState("NI");
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const res = await fetch("/api/superadmin/create-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email, password, full_name: fullName,
        role,
        company_name: role === "company_admin" ? companyName : undefined,
        bundesland,
      }),
    });

    const data = await res.json();
    if (data.success) {
      setResult({ ok: true, msg: `✓ Hesap oluşturuldu → ${email}` });
      setEmail(""); setPassword(""); setFullName(""); setCompanyName("");
    } else {
      setResult({ ok: false, msg: data.error ?? "Hata oluştu" });
    }
    setLoading(false);
  }

  const inputStyle = {
    width: "100%", padding: "10px 14px",
    background: "var(--surface2)", border: "1px solid var(--border)",
    borderRadius: 10, color: "var(--text)", fontSize: 13, outline: "none",
  };

  const labelStyle = {
    fontSize: 11, fontWeight: 700, color: "var(--muted)",
    textTransform: "uppercase" as const, letterSpacing: 0.5,
    display: "block", marginBottom: 6,
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Hesap Oluştur</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 28 }}>
        Yeni kullanıcı veya firma hesabı oluştur.
      </p>

      {/* Rol seçimi */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {([
          { v: "individual",    label: "Bireysel",    color: "var(--green)" },
          { v: "employee",      label: "Çalışan",     color: "var(--blue)" },
          { v: "company_admin", label: "Firma + Admin", color: "var(--accent2)" },
        ] as const).map(opt => (
          <button
            key={opt.v}
            onClick={() => setRole(opt.v)}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              background: role === opt.v
                ? `color-mix(in srgb, ${opt.color} 18%, transparent)`
                : "var(--surface2)",
              color: role === opt.v ? opt.color : "var(--muted)",
              outline: role === opt.v ? `1px solid color-mix(in srgb, ${opt.color} 40%, transparent)` : "none",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>Ad Soyad</label>
          <input style={inputStyle} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Max Mustermann" required />
        </div>

        <div>
          <label style={labelStyle}>E-Posta</label>
          <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="max@firma.de" required />
        </div>

        <div>
          <label style={labelStyle}>Şifre</label>
          <input style={inputStyle} type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="en az 6 karakter" required minLength={6} />
        </div>

        {role === "company_admin" && (
          <>
            <div>
              <label style={labelStyle}>Firma Adı</label>
              <input style={inputStyle} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Mustermann GmbH" required />
            </div>

            <div>
              <label style={labelStyle}>Bundesland</label>
              <select
                value={bundesland}
                onChange={e => setBundesland(e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                {BUNDESLAENDER.map(bl => <option key={bl} value={bl}>{bl}</option>)}
              </select>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px 0", borderRadius: 10,
            background: loading ? "var(--surface2)" : "var(--accent)",
            color: "#fff", fontWeight: 700, fontSize: 14,
            border: "none", cursor: loading ? "not-allowed" : "pointer",
            marginTop: 4,
          }}
        >
          {loading ? "Oluşturuluyor..." : "Hesabı Oluştur"}
        </button>
      </form>

      {result && (
        <div style={{
          marginTop: 16, padding: "14px 18px", borderRadius: 10,
          background: result.ok
            ? "color-mix(in srgb, var(--green) 12%, transparent)"
            : "color-mix(in srgb, var(--red) 12%, transparent)",
          border: `1px solid color-mix(in srgb, ${result.ok ? "var(--green)" : "var(--red)"} 30%, transparent)`,
          color: result.ok ? "var(--green)" : "var(--red)",
          fontSize: 13, fontWeight: 600,
        }}>
          {result.msg}
        </div>
      )}
    </div>
  );
}
