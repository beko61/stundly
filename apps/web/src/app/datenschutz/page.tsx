import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Datenschutz",
  description: "Datenschutzerklärung von Stundly nach DSGVO. Alle Daten werden auf EU-Servern in Frankfurt gespeichert.",
};

export default function DatenschutzPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", padding: "40px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link href="/" style={{ color: "var(--accent2)", fontWeight: 800, fontSize: 14, letterSpacing: 2, textDecoration: "none" }}>← STUNDLY</Link>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: "28px 0 8px" }}>Datenschutzerklärung</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 32 }}>Gemäß DSGVO (Datenschutz-Grundverordnung) · Stand: Juli 2026</p>

        {[
          {
            title: "1. Verantwortlicher",
            content: "Verantwortlicher für die Datenverarbeitung ist Yusuf Bektas, Tiergarten 122, 30559 Hannover. Kontakt: datenschutz@stundly.de",
          },
          {
            title: "2. Welche Daten wir erheben",
            content: "Wir erheben folgende personenbezogene Daten:\n• E-Mail-Adresse (bei Registrierung)\n• Name (optional)\n• Arbeitszeitdaten (von Ihnen eingetragen)\n• IP-Adresse (technisch notwendig)\n• Zahlungsdaten (über Stripe, wir speichern keine Kartendaten)",
          },
          {
            title: "3. Zweck der Datenverarbeitung",
            content: "Die Daten werden ausschließlich zur Bereitstellung des Stundly-Dienstes verwendet:\n• Authentifizierung und Kontoverwaltung\n• Speicherung und Anzeige Ihrer Arbeitszeitdaten\n• Berechnungen (Lohn, Überstunden)\n• PDF-Erstellung und -Export\n• Kundensupport",
          },
          {
            title: "4. Rechtsgrundlage",
            content: "Die Verarbeitung erfolgt auf Grundlage von:\n• Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)\n• Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse)\n• Art. 6 Abs. 1 lit. a DSGVO (Einwilligung, z. B. Newsletter)",
          },
          {
            title: "5. Datenspeicherung & Datenübermittlung in Drittländer",
            content: "Ihre Nutzdaten (Konto, Arbeitszeiten, Urlaub) werden ausschließlich auf EU-Servern gespeichert (Supabase EU, Frankfurt/Deutschland; Vercel Hosting Frankfurt fra1).\n\nFür bestimmte Funktionen werden Daten an Anbieter in Drittländern (USA) übermittelt:\n• Anthropic PBC (USA) — Foto-Scan (OCR), nur wenn Sie zuvor ausdrücklich einwilligen (Art. 6 (1) a DSGVO). Anthropic speichert die Bilder nicht dauerhaft und nutzt sie nicht zum Training.\n• Stripe Payments Europe Ltd (Zahlungsabwicklung) — EU-Vertragspartner, technische Verarbeitung erfolgt teils in den USA (Stripe Inc.).\n• Vercel Inc. (Hosting-Infrastruktur) — Frankfurt-Region, kann in Ausnahmefällen (Betriebs- und Sicherheitszwecke) US-Standorte einbeziehen.\n\nRechtsgrundlage der Drittlandübermittlung: Angemessenheitsbeschluss der EU-Kommission vom 10.07.2023 (EU-US Data Privacy Framework, DPF) — alle o. g. US-Anbieter sind unter dem DPF zertifiziert. Zusätzlich werden Standardvertragsklauseln (SCC 2021/914) verwendet.",
          },
          {
            title: "6. Ihre Rechte (Art. 15–22 DSGVO)",
            content: "Sie haben folgende Rechte:\n• Auskunft (Art. 15) – Welche Daten wir über Sie haben\n• Berichtigung (Art. 16) – Korrektur falscher Daten\n• Löschung (Art. 17) – Recht auf Vergessenwerden\n• Einschränkung (Art. 18) – Verarbeitungseinschränkung\n• Datenübertragbarkeit (Art. 20) – Export Ihrer Daten\n• Widerspruch (Art. 21) – Gegen bestimmte Verarbeitungen\n\nZur Ausübung Ihrer Rechte: datenschutz@stundly.de",
          },
          {
            title: "7. Datenlöschung",
            content: "Sie können Ihr Konto jederzeit in den Einstellungen löschen. Nach der Anfrage werden alle personenbezogenen Daten innerhalb von 30 Tagen unwiderruflich gelöscht. Rechnungsdaten werden gemäß § 147 AO 10 Jahre aufbewahrt.",
          },
          {
            title: "8. Drittanbieter (Auftragsverarbeiter)",
            content: "Folgende Auftragsverarbeiter werden nach Art. 28 DSGVO eingesetzt:\n\n• Supabase Inc. – Datenbank & Authentifizierung (EU-Region Frankfurt)\n• Vercel Inc. – Hosting-Infrastruktur (fra1 Frankfurt)\n• Stripe Payments Europe Ltd. – Zahlungsabwicklung (EU-Vertragspartner, US-Konzernmutter)\n• Resend (Chirp Labs Inc.) – Transaktions-E-Mail (EU-Server)\n• Anthropic PBC – Foto-Scan / Texterkennung (USA, nur mit Einwilligung)\n\nMit allen Auftragsverarbeitern bestehen Verträge nach Art. 28 DSGVO (Auftragsverarbeitungsvereinbarungen).\n\nGeschäftskunden (Team- und Business-Tarif): Auf Anfrage stellen wir eine AVV nach Art. 28 DSGVO zwischen Ihnen (Verantwortlicher) und uns (Auftragsverarbeiter) zur Verfügung. Vorlage siehe /avv oder auf Anfrage über datenschutz@stundly.de.",
          },
          {
            title: "9. Foto-Scan (OCR) / KI-Verarbeitung",
            content: "Die Foto-Scan-Funktion verarbeitet Stundenzettel-Fotos, um Arbeitszeiten automatisch zu extrahieren.\n\nDatenflüsse:\n• Foto → Anthropic Claude API (USA) — Texterkennung, dann automatische Löschung bei Anthropic. Keine dauerhafte Speicherung, keine Nutzung zum Training.\n• Extrahierte Werte (Datum, Beginn, Ende, Pause) → Ihre Stundly-Datenbank (EU).\n\nRechtsgrundlage: Art. 6 (1) a DSGVO (Einwilligung). Die Einwilligung wird vor jeder ersten Nutzung im Foto-Scan-Dialog eingeholt und kann jederzeit widerrufen werden (Dialog nach Zustimmung → „widerrufen“ oder Browser-Storage löschen).\n\nOhne Ihre Einwilligung wird kein Foto übermittelt. Sie können Ihre Arbeitszeiten stets manuell eingeben.",
          },
          {
            title: "10. Cookies",
            content: "Stundly verwendet nur technisch notwendige Cookies (Session-Cookie für die Authentifizierung). Wir verwenden keine Tracking- oder Werbe-Cookies. Es gibt keine Analyse-Tools (Google Analytics o.Ä.).",
          },
          {
            title: "11. Beschwerderecht",
            content: "Sie haben das Recht, sich bei einer Datenschutzbehörde zu beschweren. Zuständige Aufsichtsbehörde für den Verantwortlichen (Sitz Hannover, Niedersachsen):\n\nLandesbeauftragte für den Datenschutz Niedersachsen\nPrinzenstraße 5, 30159 Hannover\nTel.: +49 511 120-4500\nE-Mail: poststelle@lfd.niedersachsen.de",
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
