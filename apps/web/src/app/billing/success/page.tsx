"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function SuccessContent() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(t);
          router.push("/dashboard");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [router]);

  return (
    <div className="card" style={{ padding: "48px 28px", textAlign: "center", maxWidth: 520, margin: "0 auto" }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>

      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12 }}>
        Vielen Dank!
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
        Dein Abonnement ist jetzt aktiv. Deine 14-tägige kostenlose Testphase hat begonnen — danach wird automatisch abgerechnet, sofern du nicht vorher kündigst.
      </p>

      <div style={{
        background: "color-mix(in srgb, var(--green) 12%, transparent)",
        border: "1px solid color-mix(in srgb, var(--green) 30%, transparent)",
        color: "var(--green)",
        padding: "12px 18px",
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 700,
        marginBottom: 28,
      }}>
        ✓ Eine Bestätigungs-E-Mail wurde an dich gesendet
      </div>

      <Link
        href="/dashboard"
        className="btn btn-primary"
        style={{ width: "100%", padding: "14px", fontSize: 15, marginBottom: 12, display: "block", textAlign: "center", textDecoration: "none" }}
      >
        Zum Dashboard →
      </Link>

      <div style={{ fontSize: 11, color: "var(--muted)" }}>
        Du wirst in {countdown} Sekunde{countdown === 1 ? "" : "n"} automatisch weitergeleitet.
      </div>

      {sessionId && (
        <div style={{ marginTop: 24, fontSize: 10, color: "var(--muted)", fontFamily: "'DM Mono', monospace" }}>
          Session: {sessionId.slice(0, 20)}…
        </div>
      )}
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", display: "flex", alignItems: "center", padding: 24 }}>
      <Suspense fallback={<div className="card" style={{ padding: 32, textAlign: "center" }}>Laden...</div>}>
        <SuccessContent />
      </Suspense>
    </div>
  );
}
