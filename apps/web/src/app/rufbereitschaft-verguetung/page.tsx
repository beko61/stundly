import type { Metadata } from "next";
import Link from "next/link";
import { BETA_END_DATE_LABEL } from "@/lib/beta";
import { RufbereitschaftRechner } from "@/components/tools/RufbereitschaftRechner";

export const metadata: Metadata = {
  title: "Rufbereitschaft Vergütung 2026 – Rechner, Pauschale & Regeln",
  description:
    "Was bringt eine Woche Rufbereitschaft? Kostenloser Rechner für Bereitschaftspauschale und Einsätze, dazu die Regeln: Arbeitszeit, Mindestlohn, Ruhezeit, Steuer.",
  keywords: [
    "Rufbereitschaft Vergütung", "Rufbereitschaft Rechner", "Rufbereitschaft Pauschale", "Rufbereitschaft Arbeitszeit",
    "Rufbereitschaft Bereitschaftsdienst Unterschied", "Notdienst Vergütung", "Rufbereitschaft Mindestlohn",
  ],
  alternates: { canonical: "/rufbereitschaft-verguetung" },
  openGraph: {
    title: "Rufbereitschaft Vergütung – Rechner & Regeln",
    description: "Bereitschaftstage und Einsätze eingeben, sehen, was die Rufbereitschaft brutto bringt.",
    type: "website",
  },
};

const faq = [
  {
    q: "Ist Rufbereitschaft Arbeitszeit?",
    a: "Nur die Zeit der tatsächlichen Einsätze ist Arbeitszeit. Bei Rufbereitschaft bestimmst du selbst, wo du dich aufhältst, und musst nur erreichbar sein. Ausnahme: Wenn die Vorgaben die Freizeit sehr stark einschränken (z. B. eine sehr kurze Reaktionszeit), kann auch die Bereitschaft selbst Arbeitszeit sein (EuGH, Urteile vom 9. März 2021).",
  },
  {
    q: "Was ist der Unterschied zum Bereitschaftsdienst?",
    a: "Beim Bereitschaftsdienst musst du dich an einem vom Arbeitgeber bestimmten Ort aufhalten, zum Beispiel im Betrieb. Bereitschaftsdienst zählt komplett als Arbeitszeit und ist mindestens mit dem Mindestlohn zu bezahlen (BAG, 29. Juni 2016, 5 AZR 716/15). Bei der Rufbereitschaft wählst du den Ort selbst.",
  },
  {
    q: "Muss Rufbereitschaft bezahlt werden?",
    a: "Einsätze sind Arbeitszeit und müssen bezahlt werden, mindestens mit dem gesetzlichen Mindestlohn (13,90 € pro Stunde ab 2026, 14,60 € ab 2027). Für die reine Erreichbarkeit schreibt das Gesetz keine Vergütung vor. Ob und wie viel Pauschale es gibt, regeln Arbeitsvertrag, Tarifvertrag oder Betriebsvereinbarung.",
  },
  {
    q: "Wie hoch ist eine übliche Rufbereitschaftspauschale?",
    a: "Das ist je nach Branche und Betrieb verschieden. Ein bekanntes Beispiel ist der TVöD (§ 8 Abs. 3): Für eine Rufbereitschaft ab 12 Stunden gibt es pro Tag eine Pauschale von 2 Stundenlöhnen (Montag bis Freitag) bzw. 4 Stundenlöhnen (Samstag, Sonntag, Feiertag); für kürzere Rufbereitschaft 12,5 % des Stundenlohns pro Stunde. Im Handwerk gilt, was dein Vertrag oder Tarifvertrag sagt.",
  },
  {
    q: "Ist die Rufbereitschaftspauschale steuerfrei?",
    a: "Nein. Eine Pauschale für die bloße Bereitschaft ist normaler Arbeitslohn. Steuerfrei nach § 3b EStG können nur Zuschläge für tatsächlich geleistete Arbeit in der Nacht, am Sonntag oder an Feiertagen sein — also für die Einsätze selbst. Pauschale Zahlungen ohne Bezug zur tatsächlich geleisteten Arbeit hat der BFH nicht als steuerfreie Zuschläge anerkannt (Urteil vom 29. November 2016, VI R 61/14).",
  },
  {
    q: "Was gilt für die Ruhezeit nach einem Einsatz?",
    a: "Nach Arbeitsende stehen dir 11 Stunden ununterbrochene Ruhezeit zu (§ 5 ArbZG). Solange kein Einsatz kommt, läuft die Ruhezeit während der Rufbereitschaft weiter. Ein Einsatz unterbricht sie; danach braucht es nach überwiegender Auffassung wieder volle 11 Stunden. Tarifverträge können abweichen (§ 7 ArbZG).",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export default function RufbereitschaftPage() {
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
        <h1 style={{ fontSize: "clamp(22px, 5vw, 40px)", fontWeight: 800, lineHeight: 1.15, marginBottom: 14 }}>
          Ruf{"­"}bereitschafts{"­"}vergütung
        </h1>
        <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.7, maxWidth: 640, margin: "0 auto 24px" }}>
          Eine Woche Notdienst oder Rufbereitschaft — was kommt am Ende brutto raus? Trag deine Bereitschaftstage,
          die Pauschale und die Einsätze ein. Kostenlos, ohne Anmeldung.
        </p>
      </section>

      <section style={{ padding: "0 16px 32px", maxWidth: 860, margin: "0 auto" }}>
        <RufbereitschaftRechner />
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 12, lineHeight: 1.6 }}>
          Einsätze nachts, sonntags oder an Feiertagen? Welche Zuschläge dafür steuerfrei sind, zeigt der{" "}
          <Link href="/zuschlagsrechner" style={{ color: "var(--accent2)", fontWeight: 700 }}>Zuschlagsrechner</Link>.
        </p>
      </section>

      <section style={{ padding: "24px 16px", maxWidth: 760, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>Rufbereitschaft auf einen Blick</h2>
        <div className="card" style={{ padding: "18px 20px", fontSize: 14, color: "var(--muted)", lineHeight: 1.8 }}>
          <p>• <strong style={{ color: "var(--text)" }}>Arbeitszeit:</strong> nur die Einsätze, nicht das Warten</p>
          <p>• <strong style={{ color: "var(--text)" }}>Einsätze:</strong> normaler Stundenlohn, mindestens Mindestlohn</p>
          <p>• <strong style={{ color: "var(--text)" }}>Bereitschaft:</strong> Pauschale nur, wenn Vertrag oder Tarif sie vorsehen</p>
          <p>• <strong style={{ color: "var(--text)" }}>Steuer:</strong> Pauschale steuerpflichtig, Zuschläge für Einsätze nachts/sonntags/feiertags können steuerfrei sein</p>
          <p>• <strong style={{ color: "var(--text)" }}>Ruhezeit:</strong> 11 Stunden, ein Einsatz unterbricht sie</p>
        </div>
      </section>

      <section style={{ padding: "24px 16px 32px", maxWidth: 760, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>Häufige Fragen zur Rufbereitschaft</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {faq.map((f) => (
            <div key={f.q} className="card" style={{ padding: "16px 20px" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{f.q}</h3>
              <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7 }}>{f.a}</p>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 14, lineHeight: 1.6 }}>
          Hinweis: Die Berechnung ist eine Orientierung und ersetzt keine Rechtsberatung. Maßgeblich sind dein Arbeits-
          oder Tarifvertrag, das Arbeitszeitgesetz und das Mindestlohngesetz.
        </p>
      </section>

      <section style={{ padding: "16px 16px 80px", maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
        <div className="card" style={{ padding: "32px 24px", background: "color-mix(in srgb, var(--accent) 8%, var(--surface))" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
            Jeden Einsatz sauber festhalten
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
            Bezahlt wird, was du nachweisen kannst. Mit Stundly trägst du jeden Einsatz in Sekunden am Handy ein —
            mit Uhrzeit, Fotos und Kundenunterschrift, auch ohne Netz. Am Monatsende fertig als PDF.
            In der Beta kostenlos bis {BETA_END_DATE_LABEL}.
          </p>
          <Link href="/register" className="btn btn-primary" style={{ fontSize: 15, padding: "12px 28px", display: "inline-block" }}>
            Kostenlos starten →
          </Link>
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
            <Link href="/notdienst-verwaltung" style={{ color: "var(--accent2)" }}>Notdienst-Verwaltung</Link>
            {" · "}
            <Link href="/zuschlagsrechner" style={{ color: "var(--accent2)" }}>Zuschlagsrechner</Link>
            {" · "}
            <Link href="/ueberstundenrechner" style={{ color: "var(--accent2)" }}>Überstundenrechner</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
