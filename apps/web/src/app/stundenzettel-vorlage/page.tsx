import type { Metadata } from "next";
import Link from "next/link";
import { BETA_END_DATE_LABEL } from "@/lib/beta";
import { StundenzettelVorlageForm } from "@/components/tools/StundenzettelVorlageForm";

export const metadata: Metadata = {
  title: "Stundenzettel-Vorlage 2026 – kostenlos als PDF zum Ausdrucken",
  description:
    "Kostenlose Stundenzettel-Vorlage als PDF: Monat wählen, Feiertage deines Bundeslands automatisch eingetragen, Summen- und Unterschriftsfeld. Sofort herunterladen, ohne Anmeldung.",
  keywords: [
    "Stundenzettel Vorlage", "Stundenzettel PDF", "Stundenzettel kostenlos", "Stundenzettel 2026",
    "Arbeitszeitnachweis Vorlage", "Stundennachweis Vorlage", "Stundenzettel zum Ausdrucken",
  ],
  alternates: { canonical: "/stundenzettel-vorlage" },
  openGraph: {
    title: "Stundenzettel-Vorlage – kostenlos als PDF",
    description: "Monat wählen, Feiertage automatisch, sofort als PDF herunterladen.",
    type: "website",
  },
};

const faq = [
  {
    q: "Was muss auf einem Stundenzettel stehen?",
    a: "Mindestens Name, Datum, Beginn und Ende der Arbeitszeit sowie die Pausen — daraus ergibt sich die tägliche Arbeitszeit. Sinnvoll sind außerdem Tätigkeit oder Baustelle, Summen für den Monat und die Unterschriften von Mitarbeiter und Vorgesetztem.",
  },
  {
    q: "Ist Arbeitszeiterfassung Pflicht?",
    a: "Ja. Nach dem Bundesarbeitsgericht (Beschluss vom 13. September 2022, 1 ABR 22/21) müssen Arbeitgeber die Arbeitszeit ihrer Beschäftigten erfassen. Schon vorher galten Aufzeichnungspflichten, z. B. für Arbeitszeit über 8 Stunden pro Werktag (§ 16 Abs. 2 ArbZG).",
  },
  {
    q: "Wer muss Stundenzettel besonders genau führen?",
    a: "Für Minijobber und Branchen nach § 2a Schwarzarbeitsbekämpfungsgesetz — etwa Bau-, Gaststätten- oder Gebäudereinigungsgewerbe — müssen Beginn, Ende und Dauer der täglichen Arbeitszeit spätestens nach sieben Tagen aufgezeichnet und mindestens zwei Jahre aufbewahrt werden (§ 17 MiLoG).",
  },
  {
    q: "Wie lange muss ich Stundenzettel aufbewahren?",
    a: "Aufzeichnungen nach § 16 Abs. 2 ArbZG und § 17 MiLoG mindestens zwei Jahre. Wer Überstunden einfordern will, sollte seine eigenen Aufzeichnungen ebenfalls aufheben: Im Streitfall müssen Arbeitnehmer geleistete Überstunden nachweisen.",
  },
  {
    q: "Geht das auch digital?",
    a: "Ja — ein Stundenzettel muss nicht auf Papier sein. Mit einer App wie Stundly trägst du Beginn, Ende und Pause am Handy ein; Stunden, Überstunden und der Monatsbericht als PDF entstehen automatisch.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export default function StundenzettelVorlagePage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100dvh" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <nav style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "18px 24px", maxWidth: 1100, margin: "0 auto",
      }}>
        <Link href="/" style={{ color: "var(--accent2)", fontWeight: 800, fontSize: 14, letterSpacing: 2, textDecoration: "none" }}>
          ← STUNDLY
        </Link>
        <Link href="/register" className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>
          Kostenlos starten
        </Link>
      </nav>

      <section style={{ padding: "24px 16px 8px", maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(26px, 5vw, 40px)", fontWeight: 800, lineHeight: 1.15, marginBottom: 14 }}>
          Stundenzettel-Vorlage als PDF
        </h1>
        <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.7, maxWidth: 620, margin: "0 auto 24px" }}>
          Monat wählen, Feiertage deines Bundeslands werden automatisch eingetragen — fertig ist dein
          Stundenzettel zum Ausdrucken. Kostenlos, ohne Anmeldung.
        </p>
      </section>

      <section style={{ padding: "0 16px 32px", maxWidth: 760, margin: "0 auto" }}>
        <StundenzettelVorlageForm />
      </section>

      <section style={{ padding: "24px 16px", maxWidth: 760, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>Das steht auf der Vorlage</h2>
        <div className="card" style={{ padding: "18px 20px", fontSize: 14, color: "var(--muted)", lineHeight: 1.8 }}>
          <p>• Alle Tage des Monats mit Wochentag — Wochenenden grau, Feiertage gelb mit Namen</p>
          <p>• Spalten für Beginn, Ende, Pause, Stunden und Tätigkeit / Baustelle</p>
          <p>• Summenzeile, Felder für Soll-Stunden, Überstunden, Urlaub und Krankheit</p>
          <p>• Unterschriftsfelder für Mitarbeiter/in und Vorgesetzte/n</p>
        </div>
      </section>

      <section style={{ padding: "24px 16px 32px", maxWidth: 760, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>Häufige Fragen zum Stundenzettel</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {faq.map((f) => (
            <div key={f.q} className="card" style={{ padding: "16px 20px" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{f.q}</h3>
              <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7 }}>{f.a}</p>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 14, lineHeight: 1.6 }}>
          Hinweis: Allgemeine Informationen, keine Rechtsberatung. Maßgeblich sind Arbeits- und Tarifvertrag.
        </p>
      </section>

      <section style={{ padding: "16px 16px 80px", maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
        <div className="card" style={{ padding: "32px 24px", background: "color-mix(in srgb, var(--accent) 8%, var(--surface))" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
            Stundenzettel ohne Zettel
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
            Mit Stundly erfasst du Arbeitszeit, Urlaub und Notdienste in Sekunden am Handy — der
            Stundenzettel entsteht automatisch als PDF, Überstunden sind immer ausgerechnet.
            In der Beta kostenlos bis {BETA_END_DATE_LABEL}.
          </p>
          <Link href="/register" className="btn btn-primary" style={{ fontSize: 15, padding: "12px 28px", display: "inline-block" }}>
            Kostenlos starten →
          </Link>
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
            <Link href="/ueberstundenrechner" style={{ color: "var(--accent2)" }}>Überstundenrechner</Link>
            {" · "}
            <Link href="/handwerker" style={{ color: "var(--accent2)" }}>Für Handwerker</Link>
            {" · "}
            <Link href="/demo" style={{ color: "var(--accent2)" }}>Live-Demo</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
