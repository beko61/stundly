import Link from "next/link";

export default function BillingSuccessPage() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)", padding: 24,
    }}>
      <div className="card" style={{ maxWidth: 480, width: "100%", padding: "48px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>✅</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12 }}>Zahlung erfolgreich!</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>
          Dein Abonnement ist jetzt aktiv. Du erhältst eine Bestätigungs-E-Mail mit deiner Rechnung.
        </p>
        <Link href="/tracker" className="btn btn-primary" style={{ display: "block", padding: "14px" }}>
          Zur App
        </Link>
      </div>
    </div>
  );
}
