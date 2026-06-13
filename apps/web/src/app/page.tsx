import Link from "next/link";
import { BETA_MODE, BETA_END_DATE_LABEL, betaDaysRemaining } from "@/lib/beta";

const features = [
  { icon: "⏱️", title: "Arbeitszeiterfassung", desc: "Start, Ende, Pausen – automatische Berechnung inklusive Überstunden und Nachtschichten." },
  { icon: "📅", title: "Kalender & Übersicht", desc: "Tages-, Monats- und Jahresansicht. Urlaub, Krank, Feiertage auf einen Blick." },
  { icon: "💰", title: "Lohnberechnung", desc: "Automatische Gehaltsberechnung mit Überstundenzuschlag, Notdienst und Nachtbonus." },
  { icon: "📄", title: "PDF Export", desc: "Professionelle Berichte und Urlaubsanträge als PDF – direkt per E-Mail versenden." },
  { icon: "🏖️", title: "Urlaubsverwaltung", desc: "Urlaubsanträge erstellen, unterschreiben und als PDF exportieren. BURLG-konform." },
  { icon: "📱", title: "Mobile App", desc: "iOS & Android App – auch offline nutzbar. Daten werden automatisch synchronisiert." },
];

const plans = [
  {
    id: "individual",
    name: "Einzelperson",
    price: "5,99",
    period: "/ Monat",
    desc: "Für Freelancer & Selbstständige",
    features: ["1 Benutzer", "Arbeitszeiterfassung", "Lohn- & Steuerberechnung", "Notdienst-Verwaltung", "PDF Monatsbericht", "Mobile App"],
    cta: "14 Tage gratis testen",
    highlight: false,
  },
  {
    id: "team",
    name: "Team",
    price: "19,99",
    period: "/ Monat",
    desc: "Für Handwerk-Betriebe bis 10 MA",
    features: ["Bis zu 10 Mitarbeiter", "Admin-Panel", "Mitarbeiter einladen", "Alle Berichte & Exporte", "ArbZG-Warnungen", "Prioritäts-Support"],
    cta: "14 Tage gratis testen",
    highlight: true,
  },
  {
    id: "business",
    name: "Unternehmen",
    price: "49,99",
    period: "/ Monat",
    desc: "Für größere Betriebe",
    features: ["Bis zu 50 Mitarbeiter", "Alle Team-Funktionen", "API-Zugang (geplant)", "Eigene Berichte", "Onboarding-Service", "Dedizierter Support"],
    cta: "14 Tage gratis testen",
    highlight: false,
  },
];

const faqs = [
  { q: "Ist Stundly DSGVO-konform?", a: "Ja. Alle Daten werden ausschließlich auf EU-Servern (Frankfurt) gespeichert. Wir bieten vollständige Datenportabilität und das Recht auf Löschung." },
  { q: "Muss ich eine Kreditkarte angeben?", a: "Nein. Die kostenlose Testphase ist vollständig ohne Zahlungsdaten – während der Beta-Phase sogar 3 Monate komplett gratis." },
  { q: "Kann ich Stundly in Deutschland nutzen?", a: "Ja. Stundly ist speziell für das deutsche Arbeitsrecht entwickelt – inklusive ArbZG-Warnungen und Mindestlohn-Kontrolle." },
  { q: "Gibt es eine mobile App?", a: "Ja. Stundly ist als PWA für iOS und Android verfügbar und funktioniert auch offline." },
];

export default function LandingPage() {
  return (
    <div style={{ background: "var(--bg)", color: "var(--text)", fontFamily: "Syne, sans-serif" }}>

      {/* BETA-Streifen — ganz oben, durchgehend */}
      {BETA_MODE && (
        <div style={{
          background: "linear-gradient(90deg, color-mix(in srgb, var(--accent) 60%, transparent) 0%, color-mix(in srgb, var(--accent2) 60%, transparent) 100%)",
          color: "white",
          textAlign: "center",
          padding: "9px 24px",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}>
          🎁 BETA: 3 Monate komplett kostenlos — alle Funktionen freigeschaltet bis {BETA_END_DATE_LABEL} (noch {betaDaysRemaining()} Tage)
        </div>
      )}

      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(15,15,19,0.85)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border)",
        padding: "0 24px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ color: "var(--accent2)", fontWeight: 800, fontSize: 18, letterSpacing: 3 }}>STUNDLY</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {!BETA_MODE && (
            <Link href="/pricing" style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Preise</Link>
          )}
          <Link href="/login" style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Anmelden</Link>
          <Link href="/register" className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>
            Kostenlos starten
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        minHeight: "90vh", display: "flex", alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: "80px 24px",
        background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,106,247,0.15) 0%, transparent 70%)",
      }}>
        <div style={{ maxWidth: 700 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "color-mix(in srgb, var(--accent2) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent2) 30%, transparent)",
            borderRadius: 20, padding: "6px 14px", marginBottom: 32,
            fontSize: 12, fontWeight: 700, color: "var(--accent2)",
          }}>
            🇩🇪 Für Deutschland & Europa entwickelt
          </div>

          <h1 style={{ fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 800, lineHeight: 1.1, marginBottom: 24 }}>
            Arbeitszeit einfach<br />
            <span style={{ color: "var(--accent2)" }}>erfassen & verwalten</span>
          </h1>

          <p style={{ fontSize: 18, color: "var(--muted)", lineHeight: 1.7, marginBottom: 40, maxWidth: 520, margin: "0 auto 40px" }}>
            Stundly ist die moderne Zeiterfassungssoftware für Einzelpersonen und Unternehmen – DSGVO-konform, ArbZG-ready, mobil nutzbar.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/register" className="btn btn-primary" style={{ fontSize: 16, padding: "14px 28px" }}>
              {BETA_MODE ? "3 Monate gratis starten" : "14 Tage gratis testen"}
            </Link>
            <Link href={BETA_MODE ? "#features" : "/pricing"} className="btn" style={{
              fontSize: 16, padding: "14px 28px",
              background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)",
            }}>
              {BETA_MODE ? "Features ansehen" : "Preise ansehen"}
            </Link>
          </div>

          <p style={{ marginTop: 16, fontSize: 12, color: "var(--muted)" }}>
            Keine Kreditkarte · Keine Verpflichtung · Jederzeit kündbar
          </p>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: "80px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 800, marginBottom: 12 }}>
          Alles was du brauchst
        </h2>
        <p style={{ textAlign: "center", color: "var(--muted)", marginBottom: 56, fontSize: 15 }}>
          Von der einfachen Zeiterfassung bis zur vollständigen Lohnabrechnung.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          {features.map((f) => (
            <div key={f.title} className="card" style={{ padding: "24px" }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>{f.icon}</div>
              <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMPLIANCE BANNER */}
      <section style={{
        padding: "56px 24px",
        background: "linear-gradient(135deg, rgba(124,106,247,0.08) 0%, rgba(192,132,252,0.08) 100%)",
        borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>
            Konform mit deutschem Recht
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 40 }}>
            Stundly wurde speziell für den deutschen und europäischen Markt entwickelt.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {[
              { icon: "🔒", label: "DSGVO-konform", sub: "Daten in EU (Frankfurt)" },
              { icon: "⚖️", label: "ArbZG-Warnungen", sub: "Max. 8h/Tag Kontrolle" },
              { icon: "💶", label: "Mindestlohn", sub: "Automatische Prüfung" },
              { icon: "🏖️", label: "BUrlG", sub: "Urlaubsanspruch korrekt" },
            ].map((item) => (
              <div key={item.label} style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "20px 16px",
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{item.label}</div>
                <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING — während Beta-Phase komplett ausgeblendet */}
      {BETA_MODE ? (
        <section style={{ padding: "60px 24px 80px", maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
          <div style={{
            background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 16%, transparent) 0%, color-mix(in srgb, var(--accent2) 16%, transparent) 100%)",
            border: "1px solid color-mix(in srgb, var(--accent2) 40%, transparent)",
            borderRadius: 18,
            padding: "44px 36px",
          }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>🎁</div>
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
              Beta-Phase: 3 Monate komplett kostenlos
            </h2>
            <p style={{ color: "var(--text)", fontSize: 15, lineHeight: 1.7, marginBottom: 22 }}>
              Stundly ist gerade neu gestartet. Bis zum <strong>{BETA_END_DATE_LABEL}</strong> bekommst
              du <strong>alle Funktionen</strong> ohne Einschränkung — keine Kreditkarte, keine
              versteckten Kosten.
            </p>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 28 }}>
              Beta-Tester erhalten danach <strong style={{ color: "var(--accent2)" }}>50% lebenslangen Rabatt</strong> als Dankeschön.
            </p>
            <Link href="/register" className="btn btn-primary" style={{ fontSize: 16, padding: "14px 32px", display: "inline-block" }}>
              Jetzt kostenlos starten →
            </Link>
          </div>
        </section>
      ) : (
      <section id="pricing" style={{ padding: "80px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Einfache Preise</h2>
        <p style={{ textAlign: "center", color: "var(--muted)", marginBottom: 16, fontSize: 15 }}>
          Gemäß § 19 UStG ohne Umsatzsteuer · Monatlich kündbar
        </p>
        <p style={{ textAlign: "center", color: "var(--accent2)", fontWeight: 700, fontSize: 13, marginBottom: 52 }}>
          14 Tage kostenlos testen – keine Kreditkarte erforderlich
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {plans.map((plan) => (
            <div key={plan.id} className="card" style={{
              padding: "28px 24px",
              border: plan.highlight ? "2px solid var(--accent2)" : "1px solid var(--border)",
              position: "relative",
            }}>
              {plan.highlight && (
                <div style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  background: "var(--accent2)", color: "#fff",
                  fontSize: 11, fontWeight: 700, padding: "4px 14px", borderRadius: 20,
                  whiteSpace: "nowrap",
                }}>
                  BELIEBTESTE WAHL
                </div>
              )}
              <div style={{ marginBottom: 6, fontSize: 13, color: "var(--muted)" }}>{plan.desc}</div>
              <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 4 }}>{plan.name}</div>
              <div style={{ marginBottom: 24 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: plan.highlight ? "var(--accent2)" : "var(--text)" }}>
                  €{plan.price}
                </span>
                <span style={{ color: "var(--muted)", fontSize: 14 }}>{plan.period}</span>
              </div>

              <ul style={{ listStyle: "none", marginBottom: 28 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ fontSize: 13, color: "var(--muted)", padding: "5px 0", display: "flex", gap: 8 }}>
                    <span style={{ color: "var(--green)" }}>✓</span> {f}
                  </li>
                ))}
              </ul>

              <Link href="/register" className="btn" style={{
                display: "block", textAlign: "center", textDecoration: "none",
                background: plan.highlight ? "var(--accent)" : "var(--surface2)",
                color: plan.highlight ? "#fff" : "var(--text)",
                border: plan.highlight ? "none" : "1px solid var(--border)",
                padding: "12px", borderRadius: 10, fontWeight: 700, fontSize: 14,
              }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* FAQ */}
      <section style={{ padding: "80px 24px", maxWidth: 700, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 800, marginBottom: 48 }}>
          Häufige Fragen
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {faqs.map((faq) => (
            <div key={faq.q} className="card" style={{ padding: "20px 22px" }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{faq.q}</div>
              <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.7 }}>{faq.a}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA BANNER */}
      <section style={{
        padding: "80px 24px", textAlign: "center",
        background: "radial-gradient(ellipse 60% 80% at 50% 50%, rgba(124,106,247,0.12) 0%, transparent 70%)",
      }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, marginBottom: 16 }}>
          Bereit anzufangen?
        </h2>
        <p style={{ color: "var(--muted)", fontSize: 15, marginBottom: 32 }}>
          14 Tage kostenlos – keine Kreditkarte – sofort loslegen
        </p>
        <Link href="/register" className="btn btn-primary" style={{ fontSize: 16, padding: "16px 36px" }}>
          Jetzt kostenlos starten
        </Link>
      </section>

      {/* FOOTER */}
      <footer style={{
        borderTop: "1px solid var(--border)", padding: "32px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16,
        maxWidth: 1100, margin: "0 auto",
      }}>
        <span style={{ color: "var(--accent2)", fontWeight: 800, letterSpacing: 2 }}>STUNDLY</span>
        <div style={{ display: "flex", gap: 24 }}>
          <Link href="/impressum" style={{ color: "var(--muted)", fontSize: 13, textDecoration: "none" }}>Impressum</Link>
          <Link href="/datenschutz" style={{ color: "var(--muted)", fontSize: 13, textDecoration: "none" }}>Datenschutz</Link>
          <Link href="/agb" style={{ color: "var(--muted)", fontSize: 13, textDecoration: "none" }}>AGB</Link>
          {!BETA_MODE && (
            <Link href="/pricing" style={{ color: "var(--muted)", fontSize: 13, textDecoration: "none" }}>Preise</Link>
          )}
        </div>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>© 2026 Stundly · gemäß § 19 UStG keine MwSt.</span>
      </footer>
    </div>
  );
}
