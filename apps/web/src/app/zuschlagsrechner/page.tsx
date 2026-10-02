import type { Metadata } from "next";
import Link from "next/link";
import { BETA_END_DATE_LABEL } from "@/lib/beta";
import { ZuschlagRechner } from "@/components/tools/ZuschlagRechner";

export const metadata: Metadata = {
  title: "Zuschlagsrechner 2026 – Nacht-, Sonntags- & Feiertagszuschlag steuerfrei berechnen",
  description:
    "Kostenloser Rechner für steuerfreie Zuschläge nach § 3b EStG: Nachtzuschlag (25 % / 40 %), Sonntagszuschlag (50 %), Feiertagszuschlag (125 % / 150 %) – minutengenau für Notdienst und Schichtarbeit.",
  keywords: [
    "Zuschlagsrechner", "Nachtzuschlag berechnen", "Sonntagszuschlag berechnen", "Feiertagszuschlag",
    "steuerfreie Zuschläge", "§ 3b EStG Rechner", "Notdienst Zuschlag", "Nachtzuschlag steuerfrei",
  ],
  alternates: { canonical: "/zuschlagsrechner" },
  openGraph: {
    title: "Zuschlagsrechner – steuerfreie Nacht-, Sonntags- & Feiertagszuschläge",
    description: "Einsatzzeit eingeben, steuerfreie Zuschläge nach § 3b EStG sofort sehen. Ideal für Notdienst.",
    type: "website",
  },
};

const faq = [
  {
    q: "Welche Zuschläge sind steuerfrei?",
    a: "Nach § 3b EStG sind Zuschläge für tatsächlich geleistete Arbeit steuerfrei bis: Nachtarbeit (20–6 Uhr) 25 %, Sonntagsarbeit 50 %, gesetzliche Feiertage und Silvester ab 14 Uhr 125 %, Heiligabend ab 14 Uhr, 1. und 2. Weihnachtstag sowie 1. Mai 150 % des Grundlohns.",
  },
  {
    q: "Wann gibt es 40 % Nachtzuschlag?",
    a: "Wenn die Nachtarbeit vor 0 Uhr begonnen hat, sind für die Zeit von 0 bis 4 Uhr bis zu 40 % steuerfrei. Außerdem zählt dann die Zeit von 0 bis 4 Uhr nach einem Sonntag oder Feiertag noch als Sonntags- bzw. Feiertagsarbeit.",
  },
  {
    q: "Kann man Nacht- und Sonntagszuschlag kombinieren?",
    a: "Ja. Der Nachtzuschlag kann neben dem Sonntags- oder Feiertagszuschlag steuerfrei gezahlt werden. Fällt ein Feiertag auf einen Sonntag, ist aber nur der Feiertagszuschlag steuerfrei – nicht beide zusammen.",
  },
  {
    q: "Gibt es eine Obergrenze?",
    a: "Ja. Der Grundlohn wird für die Steuerfreiheit mit höchstens 50 € pro Stunde angesetzt. Sozialversicherungsfrei sind die Zuschläge nur, soweit der Grundlohn 25 € pro Stunde nicht übersteigt – darüber werden Beiträge fällig.",
  },
  {
    q: "Ist eine Notdienst- oder Rufbereitschaftspauschale steuerfrei?",
    a: "Eine Pauschale ohne Bezug zu konkret geleisteten Nacht-, Sonntags- oder Feiertagsstunden ist nicht nach § 3b EStG steuerfrei. Steuerfrei sind nur Zuschläge für die tatsächlich gearbeitete Zeit – deshalb ist es wichtig, jeden Einsatz mit Beginn und Ende aufzuschreiben.",
  },
  {
    q: "Zählt Rufbereitschaft als Arbeitszeit?",
    a: "In der Regel zählt bei Rufbereitschaft nur die tatsächliche Einsatzzeit als Arbeitszeit. Nur wenn die Einschränkungen in der Bereitschaftszeit sehr stark sind (z. B. eine sehr kurze Reaktionszeit), kann auch die Bereitschaft selbst Arbeitszeit sein (EuGH, Urteile vom 9. März 2021).",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export default function ZuschlagsrechnerPage() {
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
          Zuschlags{"­"}rechner
        </h1>
        <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.7, maxWidth: 640, margin: "0 auto 24px" }}>
          Notdienst in der Nacht, am Sonntag oder an Feiertagen? Gib deinen Einsatz ein — der Rechner zeigt
          minutengenau, welche Zuschläge nach § 3b EStG steuerfrei sind. Kostenlos, ohne Anmeldung.
        </p>
      </section>

      <section style={{ padding: "0 16px 32px", maxWidth: 860, margin: "0 auto" }}>
        <ZuschlagRechner />
      </section>

      <section style={{ padding: "24px 16px", maxWidth: 760, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>Steuerfreie Zuschläge auf einen Blick</h2>
        <div className="card" style={{ padding: "18px 20px", fontSize: 14, color: "var(--muted)", lineHeight: 1.8 }}>
          <p>• <strong style={{ color: "var(--text)" }}>Nachtarbeit 20–6 Uhr:</strong> 25 % — von 0 bis 4 Uhr 40 %, wenn vor 0 Uhr begonnen</p>
          <p>• <strong style={{ color: "var(--text)" }}>Sonntag:</strong> 50 %</p>
          <p>• <strong style={{ color: "var(--text)" }}>Gesetzlicher Feiertag, Silvester ab 14 Uhr:</strong> 125 %</p>
          <p>• <strong style={{ color: "var(--text)" }}>Heiligabend ab 14 Uhr, 25./26. Dezember, 1. Mai:</strong> 150 %</p>
          <p>• <strong style={{ color: "var(--text)" }}>Grundlohn:</strong> höchstens 50 €/h (Steuer), 25 €/h (Sozialversicherung)</p>
          <p style={{ marginTop: 8 }}>
            Welche Feiertage gelten, hängt vom Bundesland des Arbeitsorts ab. Steuerfrei ist höchstens, was der
            Betrieb tatsächlich als Zuschlag zahlt — die Sätze sind Obergrenzen, kein Anspruch.
          </p>
        </div>
      </section>

      <section style={{ padding: "24px 16px 32px", maxWidth: 760, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>Häufige Fragen zu Zuschlägen</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {faq.map((f) => (
            <div key={f.q} className="card" style={{ padding: "16px 20px" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{f.q}</h3>
              <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7 }}>{f.a}</p>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 14, lineHeight: 1.6 }}>
          Hinweis: Die Berechnung ist eine Orientierung und ersetzt keine Steuer- oder Rechtsberatung. Maßgeblich sind
          § 3b EStG, die Lohnsteuer-Richtlinien sowie dein Arbeits- oder Tarifvertrag.
        </p>
      </section>

      <section style={{ padding: "16px 16px 80px", maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
        <div className="card" style={{ padding: "32px 24px", background: "color-mix(in srgb, var(--accent) 8%, var(--surface))" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
            Jeden Notdienst-Einsatz sauber festhalten
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
            Zuschläge gibt es nur für nachgewiesene Zeiten. Mit Stundly trägst du jeden Einsatz in Sekunden am Handy ein —
            mit Uhrzeit, Fotos und Kundenunterschrift, auch ohne Netz. Am Monatsende fertig als PDF.
            In der Beta kostenlos bis {BETA_END_DATE_LABEL}.
          </p>
          <Link href="/register" className="btn btn-primary" style={{ fontSize: 15, padding: "12px 28px", display: "inline-block" }}>
            Kostenlos starten →
          </Link>
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
            <Link href="/notdienst-verwaltung" style={{ color: "var(--accent2)" }}>Notdienst-Verwaltung</Link>
            {" · "}
            <Link href="/ueberstundenrechner" style={{ color: "var(--accent2)" }}>Überstundenrechner</Link>
            {" · "}
            <Link href="/stundenzettel-vorlage" style={{ color: "var(--accent2)" }}>Stundenzettel-Vorlage</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
