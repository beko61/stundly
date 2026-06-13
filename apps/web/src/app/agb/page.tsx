import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AGB",
  description: "Allgemeine Geschäftsbedingungen von Stundly. Während der Beta-Phase alle Funktionen 3 Monate kostenlos.",
};

const SECTIONS: { title: string; content: string }[] = [
  {
    title: "§1 Geltungsbereich",
    content:
      "Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge zwischen Yusuf Bektas, Tiergarten 122, 30559 Hannover (nachfolgend „Anbieter\") und seinen Kunden über die Nutzung der Software-as-a-Service-Anwendung „Stundly\" (https://stundly.de). Abweichende Bedingungen des Kunden werden nicht anerkannt, es sei denn, der Anbieter stimmt ihrer Geltung ausdrücklich schriftlich zu. Diese AGB gelten sowohl für Verbraucher (§ 13 BGB) als auch für Unternehmer (§ 14 BGB).",
  },
  {
    title: "§2 Vertragsgegenstand",
    content:
      "Der Anbieter stellt dem Kunden eine Software zur Arbeitszeiterfassung, Lohnberechnung und Verwaltung von Notdiensten, Urlaub und Krankheitstagen über das Internet zur Verfügung. Die Software wird als Software-as-a-Service (SaaS) auf den Servern des Anbieters bzw. dessen Subdienstleister (Supabase, EU-Frankfurt) gehostet. Der Kunde erhält für die Vertragslaufzeit ein einfaches, nicht übertragbares Nutzungsrecht.",
  },
  {
    title: "§3 Vertragsschluss",
    content:
      "Die Darstellung der Leistungen auf https://stundly.de stellt kein verbindliches Angebot dar, sondern eine Aufforderung zur Abgabe eines Angebots. Mit der Registrierung gibt der Kunde ein verbindliches Angebot zum Abschluss eines Nutzungsvertrags ab. Der Vertrag kommt durch Bestätigung des Anbieters per E-Mail oder durch die Bereitstellung des Zugangs zustande.",
  },
  {
    title: "§4 Leistungen und Verfügbarkeit",
    content:
      "Der Anbieter bemüht sich um eine Verfügbarkeit von 99% im Jahresmittel. Davon ausgenommen sind Zeiten geplanter Wartung (vorherige Ankündigung) sowie Ausfälle durch höhere Gewalt, Angriffe Dritter oder Probleme bei Subdienstleistern (z.B. Supabase, Vercel, Stripe). Während der kostenlosen Testphase besteht kein Verfügbarkeitsanspruch.",
  },
  {
    title: "§5 Kostenlose Testphase / Beta-Phase",
    content:
      "Stundly befindet sich aktuell in der Beta-Phase. Alle neu registrierten Kunden erhalten während dieser Phase bis einschließlich 07.09.2026 kostenlosen Zugang zu sämtlichen Funktionen. Eine Zahlungsmethode ist während der Beta-Phase nicht erforderlich. Nach Ende der Beta-Phase startet eine optionale 14-tägige Testphase für kostenpflichtige Pläne. Ohne aktive Buchung endet der Zugang nach Beta-Ende — vorhandene Daten bleiben jedoch 30 Tage lang abrufbar.",
  },
  {
    title: "§6 Preise und Zahlung",
    content:
      "Es gelten die zum Zeitpunkt des Vertragsschlusses auf https://stundly.de ausgewiesenen Preise. Alle Preise verstehen sich gemäß § 19 UStG ohne Umsatzsteuer (Kleinunternehmer-Regelung). Die Zahlung erfolgt monatlich oder jährlich im Voraus per Kreditkarte, SEPA-Lastschrift oder anderen über den Zahlungsdienstleister Stripe (Stripe Inc., USA / Stripe Payments Europe Ltd., Irland) angebotenen Methoden. Bei Zahlungsverzug behält sich der Anbieter vor, den Zugang nach vorheriger Mahnung zu sperren.",
  },
  {
    title: "§7 Vertragslaufzeit und Kündigung",
    content:
      "Der Vertrag wird für die gewählte Laufzeit (monatlich oder jährlich) abgeschlossen und verlängert sich automatisch um die gleiche Laufzeit, sofern er nicht spätestens am Tag des Ablaufs gekündigt wird. Die Kündigung erfolgt über die Konto-Einstellungen oder per E-Mail an info@stundly.de und ist jederzeit ohne Angabe von Gründen möglich. Der Zugang bleibt bis zum Ende der bezahlten Periode bestehen. Eine anteilige Erstattung erfolgt nicht.",
  },
  {
    title: "§8 Pflichten des Kunden",
    content:
      "Der Kunde verpflichtet sich, seine Zugangsdaten geheim zu halten und vor unbefugter Nutzung zu schützen. Er ist für die Richtigkeit der von ihm eingegebenen Daten verantwortlich. Eine Weitergabe des Zugangs an Dritte ist nur im Rahmen der gewählten Team-/Business-Pläne und an die dort genannten Mitarbeiter zulässig. Bei Verdacht auf Missbrauch ist der Anbieter zu informieren.",
  },
  {
    title: "§9 Datenschutz und Datenexport",
    content:
      "Der Anbieter verarbeitet personenbezogene Daten gemäß DSGVO. Details siehe » Datenschutzerklärung. Der Kunde kann seine Daten jederzeit über die Funktion „Sicherung herunterladen\" als JSON exportieren. Nach Vertragsende werden die Kundendaten innerhalb von 30 Tagen unwiderruflich gelöscht, sofern keine gesetzlichen Aufbewahrungsfristen (z.B. § 147 AO) entgegenstehen.",
  },
  {
    title: "§10 Haftung",
    content:
      "Der Anbieter haftet unbeschränkt für Schäden aus Verletzung des Lebens, des Körpers oder der Gesundheit sowie bei Vorsatz und grober Fahrlässigkeit. Im Übrigen ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt und der Höhe nach auf die in den letzten 12 Monaten gezahlten Gebühren beschränkt. Für entgangenen Gewinn, mittelbare Schäden oder Datenverlust haftet der Anbieter nur bei Vorsatz und grober Fahrlässigkeit. Der Kunde ist verpflichtet, regelmäßig Sicherungen seiner Daten zu erstellen.",
  },
  {
    title: "§11 Änderungen der AGB",
    content:
      "Der Anbieter behält sich vor, diese AGB mit Wirkung für die Zukunft zu ändern. Änderungen werden dem Kunden mindestens 30 Tage vor Inkrafttreten per E-Mail mitgeteilt. Widerspricht der Kunde nicht innerhalb von 30 Tagen, gelten die Änderungen als genehmigt. Im Falle eines Widerspruchs kann jede Partei den Vertrag zum Zeitpunkt des Inkrafttretens kündigen.",
  },
  {
    title: "§12 Schlussbestimmungen",
    content:
      "Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Erfüllungsort und Gerichtsstand für Kaufleute, juristische Personen des öffentlichen Rechts oder öffentlich-rechtliche Sondervermögen ist Hannover. Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.",
  },
];

export default function AgbPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", padding: "40px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
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

        <h1 style={{ fontSize: 32, fontWeight: 800, margin: "28px 0 8px" }}>
          Allgemeine Geschäftsbedingungen
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 32 }}>
          Stand: Juni 2026
        </p>

        <div
          className="card"
          style={{
            padding: "28px",
            lineHeight: 1.9,
            fontSize: 14,
            color: "var(--muted)",
          }}
        >
          {SECTIONS.map((s) => (
            <div key={s.title} style={{ marginBottom: 24 }}>
              <h2
                style={{
                  color: "var(--text)",
                  fontWeight: 700,
                  fontSize: 16,
                  marginBottom: 12,
                }}
              >
                {s.title}
              </h2>
              <p style={{ whiteSpace: "pre-line" }}>{s.content}</p>
            </div>
          ))}

          {/* ── Widerrufsbelehrung (nur Verbraucher) ── */}
          <h2
            style={{
              color: "var(--text)",
              fontWeight: 700,
              fontSize: 18,
              margin: "32px 0 12px",
              borderTop: "1px solid var(--border)",
              paddingTop: 24,
            }}
          >
            Widerrufsbelehrung (für Verbraucher)
          </h2>

          <h3 style={{ color: "var(--text)", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
            Widerrufsrecht
          </h3>
          <p style={{ marginBottom: 16 }}>
            Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu
            widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.
          </p>
          <p style={{ marginBottom: 16 }}>
            Um Ihr Widerrufsrecht auszuüben, müssen Sie uns
            <br />
            <strong style={{ color: "var(--text)" }}>
              Yusuf Bektas, Tiergarten 122, 30559 Hannover,
              <br />
              E-Mail:{" "}
              <a href="mailto:info@stundly.de" style={{ color: "var(--accent2)" }}>
                info@stundly.de
              </a>
            </strong>
            <br />
            mittels einer eindeutigen Erklärung (z.B. ein mit der Post versandter Brief oder
            E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können
            dafür das untenstehende Muster-Widerrufsformular verwenden, das jedoch nicht
            vorgeschrieben ist.
          </p>
          <p style={{ marginBottom: 16 }}>
            Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung
            des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.
          </p>

          <h3 style={{ color: "var(--text)", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
            Folgen des Widerrufs
          </h3>
          <p style={{ marginBottom: 16 }}>
            Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen
            erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag
            zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns
            eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie
            bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde
            ausdrücklich etwas anderes vereinbart.
          </p>

          <h3 style={{ color: "var(--text)", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
            Vorzeitiges Erlöschen des Widerrufsrechts
          </h3>
          <p style={{ marginBottom: 16 }}>
            Das Widerrufsrecht erlischt vorzeitig, wenn der Anbieter mit der Ausführung des
            Vertrags begonnen hat, nachdem Sie ausdrücklich zugestimmt haben, dass der Anbieter
            mit der Ausführung vor Ablauf der Widerrufsfrist beginnt, und Sie Ihre Kenntnis davon
            bestätigt haben, dass Sie durch Ihre Zustimmung mit Beginn der Ausführung Ihr
            Widerrufsrecht verlieren.
          </p>

          {/* ── Muster-Widerrufsformular ── */}
          <h2
            style={{
              color: "var(--text)",
              fontWeight: 700,
              fontSize: 18,
              margin: "32px 0 12px",
              borderTop: "1px solid var(--border)",
              paddingTop: 24,
            }}
          >
            Muster-Widerrufsformular
          </h2>
          <p style={{ fontSize: 12, fontStyle: "italic", marginBottom: 12 }}>
            (Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und
            senden Sie es zurück.)
          </p>
          <div
            style={{
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 18,
              fontSize: 13,
              color: "var(--text)",
              lineHeight: 2,
              whiteSpace: "pre-line",
            }}
          >
            {`An: Yusuf Bektas
   Tiergarten 122
   30559 Hannover
   E-Mail: info@stundly.de

Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen
Vertrag über die Erbringung der folgenden Dienstleistung:
Stundly — Arbeitszeiterfassung (SaaS-Abonnement)

Bestellt am (*) / erhalten am (*):  __________________

Name des/der Verbraucher(s):        __________________

Anschrift des/der Verbraucher(s):   __________________

Unterschrift (nur bei Mitteilung auf Papier):  __________________

Datum:                              __________________

(*) Unzutreffendes streichen`}
          </div>

          <p style={{ marginTop: 24, fontSize: 12, color: "var(--muted)" }}>
            Bei Fragen erreichen Sie uns unter{" "}
            <a href="mailto:info@stundly.de" style={{ color: "var(--accent2)" }}>
              info@stundly.de
            </a>
            . Weitere Hinweise: <Link href="/impressum" style={{ color: "var(--accent2)" }}>Impressum</Link>
            {" · "}
            <Link href="/datenschutz" style={{ color: "var(--accent2)" }}>Datenschutz</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
