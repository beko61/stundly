import Link from "next/link";

const plans = [
  {
    id: "trial",
    name: "Kostenlos",
    price: "0",
    period: "14 Tage",
    desc: "Zum Ausprobieren",
    features: ["1 Benutzer", "Alle Grundfunktionen", "PDF Export", "Mobile App", "Kein Kreditkarte"],
    cta: "Jetzt starten",
    href: "/register",
    highlight: false,
    badge: null,
  },
  {
    id: "individual",
    name: "Einzelperson",
    price: "9,99",
    priceYearly: "99,00",
    period: "/ Monat",
    desc: "Für Freelancer & Selbstständige",
    features: ["1 Benutzer", "Arbeitszeiterfassung", "Lohnberechnung", "PDF Export", "Urlaubsantrag", "Mobile App (iOS & Android)"],
    cta: "14 Tage gratis testen",
    href: "/register",
    highlight: false,
    badge: null,
  },
  {
    id: "team",
    name: "Team",
    price: "29,99",
    priceYearly: "299,00",
    period: "/ Monat",
    desc: "Für Unternehmen bis 10 MA",
    features: ["Bis zu 10 Mitarbeiter", "Admin-Panel", "Mitarbeiter einladen", "Alle Berichte & Exporte", "KI-Funktionen", "ArbZG-Warnungen", "Prioritäts-Support"],
    cta: "14 Tage gratis testen",
    href: "/register",
    highlight: true,
    badge: "BELIEBTESTE WAHL",
  },
  {
    id: "business",
    name: "Unternehmen",
    price: "79,99",
    priceYearly: "799,00",
    period: "/ Monat",
    desc: "Für größere Betriebe",
    features: ["Unbegrenzte Mitarbeiter", "Alle Team-Funktionen", "API-Zugang", "Eigene Berichte", "Onboarding-Service", "Dedizierter Support"],
    cta: "Kontakt aufnehmen",
    href: "/register",
    highlight: false,
    badge: null,
  },
];

const comparisonRows = [
  { feature: "Benutzer", trial: "1", individual: "1", team: "Bis 10", business: "Unbegrenzt" },
  { feature: "Arbeitszeiterfassung", trial: "✓", individual: "✓", team: "✓", business: "✓" },
  { feature: "Lohnberechnung", trial: "✓", individual: "✓", team: "✓", business: "✓" },
  { feature: "PDF Export", trial: "✓", individual: "✓", team: "✓", business: "✓" },
  { feature: "Mobile App", trial: "✓", individual: "✓", team: "✓", business: "✓" },
  { feature: "Admin-Panel", trial: "–", individual: "–", team: "✓", business: "✓" },
  { feature: "Mitarbeiter einladen", trial: "–", individual: "–", team: "✓", business: "✓" },
  { feature: "KI-Funktionen", trial: "–", individual: "–", team: "✓", business: "✓" },
  { feature: "API-Zugang", trial: "–", individual: "–", team: "–", business: "✓" },
  { feature: "Prioritäts-Support", trial: "–", individual: "–", team: "✓", business: "✓" },
];

export default function PricingPage() {
  return (
    <div style={{ background: "var(--bg)", color: "var(--text)", fontFamily: "Syne, sans-serif", minHeight: "100vh" }}>

      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(15,15,19,0.85)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border)",
        padding: "0 24px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link href="/" style={{ color: "var(--accent2)", fontWeight: 800, fontSize: 18, letterSpacing: 3, textDecoration: "none" }}>WORKLY</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/login" style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Anmelden</Link>
          <Link href="/register" className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>
            Kostenlos starten
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h1 style={{ fontSize: 40, fontWeight: 800, marginBottom: 12 }}>Einfache, transparente Preise</h1>
          <p style={{ color: "var(--muted)", fontSize: 16 }}>Alle Preise zzgl. 19% MwSt. · Monatlich kündbar · 14 Tage kostenlos testen</p>
        </div>

        {/* Plan Kartları */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 80 }}>
          {plans.map((plan) => (
            <div key={plan.id} className="card" style={{
              padding: "28px 22px",
              border: plan.highlight ? "2px solid var(--accent2)" : "1px solid var(--border)",
              position: "relative",
            }}>
              {plan.badge && (
                <div style={{
                  position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
                  background: "var(--accent2)", color: "#fff",
                  fontSize: 10, fontWeight: 700, padding: "4px 14px", borderRadius: 20, whiteSpace: "nowrap",
                }}>
                  {plan.badge}
                </div>
              )}
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{plan.desc}</div>
              <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>{plan.name}</div>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 34, fontWeight: 800, color: plan.highlight ? "var(--accent2)" : "var(--text)" }}>
                  €{plan.price}
                </span>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>{plan.period}</span>
                {plan.priceYearly && (
                  <div style={{ fontSize: 11, color: "var(--green)", marginTop: 2 }}>
                    €{plan.priceYearly} / Jahr (2 Monate gratis)
                  </div>
                )}
              </div>

              <ul style={{ listStyle: "none", marginBottom: 24 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ fontSize: 12, color: "var(--muted)", padding: "4px 0", display: "flex", gap: 8 }}>
                    <span style={{ color: "var(--green)", flexShrink: 0 }}>✓</span> {f}
                  </li>
                ))}
              </ul>

              <Link href={plan.href} style={{
                display: "block", textAlign: "center", textDecoration: "none",
                background: plan.highlight ? "var(--accent)" : "var(--surface2)",
                color: plan.highlight ? "#fff" : "var(--text)",
                border: plan.highlight ? "none" : "1px solid var(--border)",
                padding: "11px", borderRadius: 10, fontWeight: 700, fontSize: 13,
              }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Karşılaştırma Tablosu */}
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 28, textAlign: "center" }}>Detaillierter Vergleich</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "12px 16px", color: "var(--muted)", fontWeight: 600 }}>Funktion</th>
                {["Kostenlos", "Einzelperson", "Team", "Unternehmen"].map((h) => (
                  <th key={h} style={{ textAlign: "center", padding: "12px 16px", color: h === "Team" ? "var(--accent2)" : "var(--muted)", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <tr key={row.feature} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                  <td style={{ padding: "12px 16px", color: "var(--text)" }}>{row.feature}</td>
                  {[row.trial, row.individual, row.team, row.business].map((val, j) => (
                    <td key={j} style={{ textAlign: "center", padding: "12px 16px", color: val === "✓" ? "var(--green)" : val === "–" ? "var(--muted)" : "var(--text)", fontWeight: val === "✓" ? 700 : 400 }}>{val}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer not */}
        <p style={{ textAlign: "center", marginTop: 48, color: "var(--muted)", fontSize: 13 }}>
          Alle Preise netto zzgl. 19% MwSt. (Deutschland). EU-Unternehmen mit gültiger USt-IdNr. erhalten Rechnungen ohne MwSt. (Reverse Charge).{" "}
          <Link href="/impressum" style={{ color: "var(--accent2)" }}>Impressum</Link> ·{" "}
          <Link href="/datenschutz" style={{ color: "var(--accent2)" }}>Datenschutz</Link>
        </p>
      </div>
    </div>
  );
}
