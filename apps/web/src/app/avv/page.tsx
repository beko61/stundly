import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Auftragsverarbeitungsvereinbarung (AVV)",
  description: "Auftragsverarbeitungsvertrag nach Art. 28 DSGVO für Business-Kunden von Stundly.",
};

export default function AvvPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", padding: "40px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link
          href="/"
          style={{ color: "var(--accent2)", fontWeight: 800, fontSize: 14, letterSpacing: 2, textDecoration: "none" }}
        >
          ← STUNDLY
        </Link>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: "28px 0 8px" }}>
          Auftragsverarbeitungsvereinbarung (AVV)
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 32 }}>
          Nach Art. 28 DSGVO · Stand: Juli 2026
        </p>

        <div className="card" style={{ padding: "22px 24px", marginBottom: 12 }}>
          <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Für wen relevant?</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.75 }}>
            Wenn Sie Stundly als <strong style={{ color: "var(--text)" }}>Geschäftskunde</strong>{" "}
            (Team- oder Business-Tarif) einsetzen und mit dem Dienst
            personenbezogene Daten Ihrer Mitarbeitenden verarbeiten, sind Sie
            der Verantwortliche im Sinne der DSGVO. Stundly (Yusuf Bektas)
            fungiert als Auftragsverarbeiter. Eine schriftliche Vereinbarung
            nach Art. 28 DSGVO ist verpflichtend.
          </p>
        </div>

        <div className="card" style={{ padding: "22px 24px", marginBottom: 12 }}>
          <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Inhalt der Vereinbarung</h2>
          <ul style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.85, paddingLeft: 20 }}>
            <li>Gegenstand, Art und Zweck der Verarbeitung</li>
            <li>Betroffene Personen und Datenkategorien</li>
            <li>Weisungsrecht des Verantwortlichen</li>
            <li>Technische und organisatorische Maßnahmen (TOM) nach Art. 32 DSGVO</li>
            <li>Vertraulichkeitsverpflichtung</li>
            <li>Unterauftragsverarbeiter (Supabase EU, Vercel, Stripe, Resend, Anthropic)</li>
            <li>Meldepflichten bei Datenpannen</li>
            <li>Unterstützung bei Betroffenenrechten (Art. 15–22 DSGVO)</li>
            <li>Rückgabe / Löschung nach Vertragsende</li>
            <li>Nachweise und Auditrechte</li>
          </ul>
        </div>

        <div className="card" style={{ padding: "22px 24px", marginBottom: 12 }}>
          <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Unterauftragsverarbeiter</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.75, marginBottom: 8 }}>
            Stundly setzt folgende Unterauftragsverarbeiter ein. Alle EU-Verarbeitung ist Standard;
            US-Anbieter sind unter dem EU-US Data Privacy Framework zertifiziert bzw. es gelten
            EU-Standardvertragsklauseln (SCC 2021/914).
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, color: "var(--muted)", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "8px 6px", color: "var(--text)" }}>Anbieter</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", color: "var(--text)" }}>Zweck</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", color: "var(--text)" }}>Sitz / Region</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 6px" }}>Supabase Inc.</td>
                  <td style={{ padding: "8px 6px" }}>Datenbank & Auth</td>
                  <td style={{ padding: "8px 6px" }}>EU (Frankfurt)</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 6px" }}>Vercel Inc.</td>
                  <td style={{ padding: "8px 6px" }}>Hosting</td>
                  <td style={{ padding: "8px 6px" }}>Frankfurt fra1 (US Konzern)</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 6px" }}>Stripe Payments Europe Ltd.</td>
                  <td style={{ padding: "8px 6px" }}>Zahlungen</td>
                  <td style={{ padding: "8px 6px" }}>Irland (US Konzern)</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 6px" }}>Resend / Chirp Labs</td>
                  <td style={{ padding: "8px 6px" }}>Transaktions-E-Mail</td>
                  <td style={{ padding: "8px 6px" }}>EU-Server (US Konzern)</td>
                </tr>
                <tr>
                  <td style={{ padding: "8px 6px" }}>Anthropic PBC</td>
                  <td style={{ padding: "8px 6px" }}>Foto-Scan / OCR (nur mit Einwilligung)</td>
                  <td style={{ padding: "8px 6px" }}>USA (DPF-zertifiziert)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: "22px 24px",
            marginBottom: 12,
            background: "color-mix(in srgb, var(--accent2) 8%, var(--surface))",
            border: "1px solid color-mix(in srgb, var(--accent2) 30%, transparent)",
          }}
        >
          <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>AVV anfordern</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.75, marginBottom: 12 }}>
            Wir stellen Ihnen eine für Ihren Anwendungsfall zugeschnittene AVV
            zur Verfügung. Nennen Sie uns bitte:
          </p>
          <ul style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.85, paddingLeft: 20, marginBottom: 12 }}>
            <li>Firma, Anschrift, Rechtsform</li>
            <li>Anzahl der zu verarbeitenden Mitarbeiterprofile</li>
            <li>Ansprechperson für Datenschutzfragen</li>
          </ul>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.75 }}>
            Kontakt:{" "}
            <a
              href="mailto:datenschutz@stundly.de?subject=AVV%20nach%20Art.%2028%20DSGVO"
              style={{ color: "var(--accent2)", fontWeight: 700 }}
            >
              datenschutz@stundly.de
            </a>
            . Bearbeitungszeit i. d. R. 2 Werktage.
          </p>
        </div>

        <div className="card" style={{ padding: "22px 24px", marginBottom: 12 }}>
          <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Technische und organisatorische Maßnahmen</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.75 }}>
            Details zu unseren TOM (Verschlüsselung in Transit und at Rest,
            Zugangskontrolle, Backup, Löschkonzept, Meldeprozesse) sind
            Bestandteil der AVV und werden mit der Vereinbarung übermittelt.
            Übersicht auch in unserer{" "}
            <Link href="/datenschutz" style={{ color: "var(--accent2)" }}>
              Datenschutzerklärung
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
