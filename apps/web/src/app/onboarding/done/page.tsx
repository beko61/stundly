"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function DoneContent() {
  const router = useRouter();
  const params = useSearchParams();
  const type = params.get("type") ?? "individual";
  const isCompany = type === "company";
  const welcomeSent = useRef(false);

  // Welcome maili tetikle (RESEND_API_KEY varsa, yoksa sessiz başarısız)
  useEffect(() => {
    if (welcomeSent.current) return;
    welcomeSent.current = true;
    void fetch("/api/email/welcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: isCompany ? "company" : "individual" }),
    }).catch(() => { /* sessizce yut */ });
  }, [isCompany]);

  return (
    <div className="card" style={{ padding: "40px 24px", textAlign: "center" }}>
      {/* Adım göstergesi */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 36 }}>
        {[1, 2, 3].map((s) => (
          <div key={s} style={{
            height: 4, flex: 1, borderRadius: 2,
            background: "var(--accent2)",
          }} />
        ))}
      </div>

      <div style={{ fontSize: 56, marginBottom: 20 }}>🎉</div>

      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 10 }}>
        Alles bereit!
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
        {isCompany
          ? "Dein Unternehmen wurde erfolgreich eingerichtet. Du hast 14 Tage kostenlosen Zugang zu allen Team-Funktionen."
          : "Dein Konto ist fertig eingerichtet. Du hast 14 Tage kostenlosen Zugang zu Stundly."}
      </p>

      <div style={{
        background: "color-mix(in srgb, var(--accent2) 10%, transparent)",
        border: "1px solid color-mix(in srgb, var(--accent2) 30%, transparent)",
        borderRadius: 12, padding: "14px 18px", marginBottom: 28,
        fontSize: 13, color: "var(--accent2)", fontWeight: 600,
      }}>
        ✓ 14 Tage kostenlos testen – keine Kreditkarte erforderlich
      </div>

      {isCompany && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "16px 18px", marginBottom: 24,
          textAlign: "left",
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>
            Nächste Schritte:
          </p>
          <ul style={{ fontSize: 13, color: "var(--muted)", lineHeight: 2, paddingLeft: 18 }}>
            <li>Mitarbeiter über das Admin-Panel einladen</li>
            <li>Arbeitszeitregeln konfigurieren</li>
            <li>Berichte & Exporte einrichten</li>
          </ul>
        </div>
      )}

      <button
        className="btn btn-primary"
        onClick={() => router.push(isCompany ? "/company/dashboard" : "/dashboard")}
        style={{ width: "100%", fontSize: 16, padding: "14px" }}
      >
        {isCompany ? "Zum Admin-Panel" : "Jetzt starten"}
      </button>
    </div>
  );
}

export default function OnboardingDonePage() {
  return (
    <Suspense fallback={<div className="card" style={{ padding: 32, textAlign: "center" }}>Laden...</div>}>
      <DoneContent />
    </Suspense>
  );
}
