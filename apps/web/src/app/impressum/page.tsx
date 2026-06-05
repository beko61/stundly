import Link from "next/link";

export default function ImpressumPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", padding: "40px 24px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <Link href="/" style={{ color: "var(--accent2)", fontWeight: 800, fontSize: 14, letterSpacing: 2, textDecoration: "none" }}>← STUNDLY</Link>

        <h1 style={{ fontSize: 32, fontWeight: 800, margin: "28px 0 32px" }}>Impressum</h1>

        <div className="card" style={{ padding: "28px", lineHeight: 1.9, fontSize: 14, color: "var(--muted)" }}>
          <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 24, background: "color-mix(in srgb, var(--yellow) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--yellow) 25%, transparent)", borderRadius: 8, padding: "10px 14px" }}>
            ⚠️ Dieses Impressum ist ein Platzhalter. Bitte mit den echten Unternehmensdaten ersetzen.
          </p>

          <h2 style={{ color: "var(--text)", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Angaben gemäß § 5 TMG</h2>
          <p>
            <strong style={{ color: "var(--text)" }}>Stundly GmbH</strong><br />
            Musterstraße 1<br />
            10115 Berlin<br />
            Deutschland
          </p>

          <h2 style={{ color: "var(--text)", fontWeight: 700, fontSize: 16, margin: "24px 0 12px" }}>Vertreten durch</h2>
          <p>Geschäftsführer: [Name]</p>

          <h2 style={{ color: "var(--text)", fontWeight: 700, fontSize: 16, margin: "24px 0 12px" }}>Kontakt</h2>
          <p>
            E-Mail: info@stundly.de<br />
            Tel.: +49 (0) 30 000 000 00
          </p>

          <h2 style={{ color: "var(--text)", fontWeight: 700, fontSize: 16, margin: "24px 0 12px" }}>Registereintrag</h2>
          <p>
            Handelsregister: Amtsgericht Berlin-Charlottenburg<br />
            Registernummer: HRB 000000
          </p>

          <h2 style={{ color: "var(--text)", fontWeight: 700, fontSize: 16, margin: "24px 0 12px" }}>Umsatzsteuer-ID</h2>
          <p>
            Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG:<br />
            DE 000 000 000
          </p>

          <h2 style={{ color: "var(--text)", fontWeight: 700, fontSize: 16, margin: "24px 0 12px" }}>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
          <p>[Name, Adresse wie oben]</p>

          <h2 style={{ color: "var(--text)", fontWeight: 700, fontSize: 16, margin: "24px 0 12px" }}>Streitschlichtung</h2>
          <p>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
            <span style={{ color: "var(--accent2)" }}>https://ec.europa.eu/consumers/odr/</span><br />
            Unsere E-Mail-Adresse finden Sie oben im Impressum.<br /><br />
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </div>
      </div>
    </div>
  );
}
