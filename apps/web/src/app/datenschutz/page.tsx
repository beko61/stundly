import Link from "next/link";

export default function DatenschutzPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", padding: "40px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link href="/" style={{ color: "var(--accent2)", fontWeight: 800, fontSize: 14, letterSpacing: 2, textDecoration: "none" }}>← WORKLY</Link>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: "28px 0 8px" }}>Datenschutzerklärung</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 32 }}>Gemäß DSGVO (Datenschutz-Grundverordnung) · Stand: April 2026</p>

        {[
          {
            title: "1. Verantwortlicher",
            content: "Verantwortlicher für die Datenverarbeitung ist die Workly GmbH, Musterstraße 1, 10115 Berlin. Kontakt: datenschutz@workly.app",
          },
          {
            title: "2. Welche Daten wir erheben",
            content: "Wir erheben folgende personenbezogene Daten:\n• E-Mail-Adresse (bei Registrierung)\n• Name (optional)\n• Arbeitszeitdaten (von Ihnen eingetragen)\n• IP-Adresse (technisch notwendig)\n• Zahlungsdaten (über Stripe, wir speichern keine Kartendaten)",
          },
          {
            title: "3. Zweck der Datenverarbeitung",
            content: "Die Daten werden ausschließlich zur Bereitstellung des Workly-Dienstes verwendet:\n• Authentifizierung und Kontoverwaltung\n• Speicherung und Anzeige Ihrer Arbeitszeitdaten\n• Berechnungen (Lohn, Überstunden)\n• PDF-Erstellung und -Export\n• Kundensupport",
          },
          {
            title: "4. Rechtsgrundlage",
            content: "Die Verarbeitung erfolgt auf Grundlage von:\n• Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)\n• Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse)\n• Art. 6 Abs. 1 lit. a DSGVO (Einwilligung, z. B. Newsletter)",
          },
          {
            title: "5. Datenspeicherung",
            content: "Alle Daten werden ausschließlich auf EU-Servern (Frankfurt, Deutschland) gespeichert. Anbieter: Supabase (EU-Region). Wir übermitteln keine Daten in Drittländer außerhalb der EU/EWR.",
          },
          {
            title: "6. Ihre Rechte (Art. 15–22 DSGVO)",
            content: "Sie haben folgende Rechte:\n• Auskunft (Art. 15) – Welche Daten wir über Sie haben\n• Berichtigung (Art. 16) – Korrektur falscher Daten\n• Löschung (Art. 17) – Recht auf Vergessenwerden\n• Einschränkung (Art. 18) – Verarbeitungseinschränkung\n• Datenübertragbarkeit (Art. 20) – Export Ihrer Daten\n• Widerspruch (Art. 21) – Gegen bestimmte Verarbeitungen\n\nZur Ausübung Ihrer Rechte: datenschutz@workly.app",
          },
          {
            title: "7. Datenlöschung",
            content: "Sie können Ihr Konto jederzeit in den Einstellungen löschen. Nach der Anfrage werden alle personenbezogenen Daten innerhalb von 30 Tagen unwiderruflich gelöscht. Rechnungsdaten werden gemäß § 147 AO 10 Jahre aufbewahrt.",
          },
          {
            title: "8. Drittanbieter",
            content: "Wir nutzen folgende Drittanbieter:\n• Supabase (Datenbank, Auth) – EU-Server\n• Stripe (Zahlungsabwicklung) – DSGVO-konform\n• Resend (E-Mail-Versand) – EU-Server\n• Anthropic Claude API (KI-Funktionen, optional) – Daten werden nicht gespeichert",
          },
          {
            title: "9. Cookies",
            content: "Workly verwendet nur technisch notwendige Cookies (Session-Cookie für die Authentifizierung). Wir verwenden keine Tracking- oder Werbe-Cookies. Es gibt keine Analyse-Tools (Google Analytics o.Ä.).",
          },
          {
            title: "10. Beschwerderecht",
            content: "Sie haben das Recht, sich bei einer Datenschutzbehörde zu beschweren. Die zuständige Aufsichtsbehörde in Berlin ist:\n\nBerliner Beauftragte für Datenschutz und Informationsfreiheit\nMauerstraße 39–40, 10117 Berlin\nTel.: +49 30 13889-0\nE-Mail: mailbox@datenschutz-berlin.de",
          },
        ].map((section) => (
          <div key={section.title} className="card" style={{ padding: "22px 24px", marginBottom: 12 }}>
            <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: "var(--text)" }}>{section.title}</h2>
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.9, whiteSpace: "pre-line" }}>{section.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
