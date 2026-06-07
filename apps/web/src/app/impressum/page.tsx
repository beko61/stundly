import Link from "next/link";

export default function ImpressumPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", padding: "40px 24px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <Link
          href="/"
          style={{
            color: "var(--accent2)",
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: 2,
            textDecoration: "none",
          }}
        >
          ← STUNDLY
        </Link>

        <h1 style={{ fontSize: 32, fontWeight: 800, margin: "28px 0 32px" }}>Impressum</h1>

        <div
          className="card"
          style={{
            padding: "28px",
            lineHeight: 1.9,
            fontSize: 14,
            color: "var(--muted)",
          }}
        >
          <h2 style={{ color: "var(--text)", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
            Angaben gemäß § 5 TMG
          </h2>
          <p>
            <strong style={{ color: "var(--text)" }}>Yusuf Bektas</strong>
            <br />
            Tiergarten 122
            <br />
            30559 Hannover
            <br />
            Deutschland
          </p>

          <h2 style={{ color: "var(--text)", fontWeight: 700, fontSize: 16, margin: "24px 0 12px" }}>
            Kontakt
          </h2>
          <p>
            E-Mail:{" "}
            <a href="mailto:info@stundly.de" style={{ color: "var(--accent2)" }}>
              info@stundly.de
            </a>
          </p>

          <h2 style={{ color: "var(--text)", fontWeight: 700, fontSize: 16, margin: "24px 0 12px" }}>
            Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV
          </h2>
          <p>
            Yusuf Bektas
            <br />
            Tiergarten 122, 30559 Hannover
          </p>

          <h2 style={{ color: "var(--text)", fontWeight: 700, fontSize: 16, margin: "24px 0 12px" }}>
            EU-Streitschlichtung
          </h2>
          <p>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:
            <br />
            <a
              href="https://ec.europa.eu/consumers/odr/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent2)" }}
            >
              https://ec.europa.eu/consumers/odr/
            </a>
            <br />
            Unsere E-Mail-Adresse finden Sie oben im Impressum.
          </p>

          <h2 style={{ color: "var(--text)", fontWeight: 700, fontSize: 16, margin: "24px 0 12px" }}>
            Verbraucherstreitbeilegung / Universalschlichtungsstelle
          </h2>
          <p>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>

          <h2 style={{ color: "var(--text)", fontWeight: 700, fontSize: 16, margin: "24px 0 12px" }}>
            Haftung für Inhalte
          </h2>
          <p>
            Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten
            nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als
            Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
            Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
            Tätigkeit hinweisen.
          </p>

          <h2 style={{ color: "var(--text)", fontWeight: 700, fontSize: 16, margin: "24px 0 12px" }}>
            Haftung für Links
          </h2>
          <p>
            Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen
            Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr
            übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder
            Betreiber der Seiten verantwortlich.
          </p>

          <h2 style={{ color: "var(--text)", fontWeight: 700, fontSize: 16, margin: "24px 0 12px" }}>
            Urheberrecht
          </h2>
          <p>
            Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen
            dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art
            der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen
            Zustimmung des jeweiligen Autors bzw. Erstellers.
          </p>
        </div>
      </div>
    </div>
  );
}
