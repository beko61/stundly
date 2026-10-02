import type { Metadata } from "next";
import Link from "next/link";
import { BETA_END_DATE_LABEL } from "@/lib/beta";
import { UeberstundenRechner } from "@/components/tools/UeberstundenRechner";

export const metadata: Metadata = {
  title: "Überstundenrechner 2026 – Überstunden berechnen (kostenlos)",
  description:
    "Überstunden kostenlos berechnen: Arbeitszeiten pro Tag oder Monatsstunden eingeben, Soll aus dem Arbeitsvertrag – sofort Überstunden, Arbeitstage und Wert in Euro. Mit ArbZG-Check.",
  keywords: [
    "Überstundenrechner", "Überstunden berechnen", "Überstunden Rechner", "Überstunden ausrechnen",
    "Überstunden Monat berechnen", "Minusstunden berechnen", "Überstundenzuschlag berechnen",
  ],
  alternates: { canonical: "/ueberstundenrechner" },
  openGraph: {
    title: "Überstundenrechner – Überstunden kostenlos berechnen",
    description: "Arbeitszeiten eingeben, Überstunden und Wert in Euro sofort sehen. Mit Arbeitszeitgesetz-Check.",
    type: "website",
  },
};

const faq = [
  {
    q: "Wie berechne ich meine Überstunden?",
    a: "Überstunden = tatsächlich gearbeitete Stunden − vertragliche Soll-Stunden. Bei 40 Stunden pro Woche und 45 gearbeiteten Stunden sind das 5 Überstunden. Für einen Monat rechnet man mit durchschnittlich 4,33 Wochen: 40 h × 4,33 ≈ 173 h Soll.",
  },
  {
    q: "Werden Überstunden bezahlt?",
    a: "Das hängt vom Arbeits- oder Tarifvertrag ab: Überstunden werden entweder ausbezahlt (oft mit Zuschlag, z. B. 25 %) oder als Freizeit ausgeglichen. Einen allgemeinen gesetzlichen Anspruch auf einen Zuschlag gibt es nicht.",
  },
  {
    q: "Wie viele Stunden darf ich pro Tag arbeiten?",
    a: "Nach § 3 Arbeitszeitgesetz höchstens 8 Stunden pro Werktag, verlängerbar auf 10 Stunden, wenn im Durchschnitt von 6 Monaten 8 Stunden pro Werktag nicht überschritten werden. Nach § 4 sind bei mehr als 6 Stunden 30 Minuten Pause Pflicht, bei mehr als 9 Stunden 45 Minuten.",
  },
  {
    q: "Muss ich meine Überstunden selbst nachweisen?",
    a: "Im Streitfall ja: Nach dem Bundesarbeitsgericht (Urteil vom 4. Mai 2022, 5 AZR 359/21) müssen Arbeitnehmer geleistete Überstunden darlegen und beweisen. Wer seine Zeiten täglich aufschreibt, ist auf der sicheren Seite.",
  },
  {
    q: "Was sind Minusstunden?",
    a: "Minusstunden entstehen, wenn du weniger arbeitest als vertraglich vereinbart. Der Rechner zeigt sie mit Minus-Vorzeichen. Ob sie nachgearbeitet werden müssen, regelt der Arbeitsvertrag bzw. ein Arbeitszeitkonto.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export default function UeberstundenrechnerPage() {
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
          Überstundenrechner
        </h1>
        <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.7, maxWidth: 620, margin: "0 auto 24px" }}>
          Trag deine Arbeitszeiten ein — der Rechner zeigt sofort deine Überstunden, wie viele
          Arbeitstage das sind und was sie in Euro wert sind. Kostenlos, ohne Anmeldung.
        </p>
      </section>

      <section style={{ padding: "0 16px 32px", maxWidth: 860, margin: "0 auto" }}>
        <UeberstundenRechner />
      </section>

      <section style={{ padding: "24px 16px", maxWidth: 760, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>So rechnet der Überstundenrechner</h2>
        <div className="card" style={{ padding: "18px 20px", fontSize: 14, color: "var(--muted)", lineHeight: 1.8 }}>
          <p><strong style={{ color: "var(--text)" }}>Überstunden = Ist-Stunden − Soll-Stunden</strong></p>
          <p>• <strong style={{ color: "var(--text)" }}>Pro Tag:</strong> Ende − Beginn − Pause, für jeden Wochentag. Endet die Schicht nach Mitternacht, wird richtig über den Tageswechsel gerechnet.</p>
          <p>• <strong style={{ color: "var(--text)" }}>Soll pro Monat:</strong> Wochenstunden × 4,33 (52 Wochen ÷ 12 Monate).</p>
          <p>• <strong style={{ color: "var(--text)" }}>In Arbeitstagen:</strong> Überstunden ÷ (Wochenstunden ÷ 5).</p>
          <p>• <strong style={{ color: "var(--text)" }}>Wert:</strong> Überstunden × Stundenlohn × (1 + Zuschlag).</p>
        </div>
      </section>

      <section style={{ padding: "24px 16px 32px", maxWidth: 760, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>Häufige Fragen zu Überstunden</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {faq.map((f) => (
            <div key={f.q} className="card" style={{ padding: "16px 20px" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{f.q}</h3>
              <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7 }}>{f.a}</p>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 14, lineHeight: 1.6 }}>
          Hinweis: Die Berechnung ist eine Orientierung und ersetzt keine Rechtsberatung. Maßgeblich sind
          dein Arbeitsvertrag, ein Tarifvertrag oder eine Betriebsvereinbarung.
        </p>
      </section>

      <section style={{ padding: "16px 16px 80px", maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
        <div className="card" style={{ padding: "32px 24px", background: "color-mix(in srgb, var(--accent) 8%, var(--surface))" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
            Überstunden nie wieder vergessen
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
            Mit Stundly erfasst du Arbeitszeit, Urlaub und Notdienste in Sekunden auf dem Handy —
            deine Überstunden stehen jederzeit fest, samt PDF-Monatsbericht. In der Beta kostenlos bis {BETA_END_DATE_LABEL}.
          </p>
          <Link href="/register" className="btn btn-primary" style={{ fontSize: 15, padding: "12px 28px", display: "inline-block" }}>
            Kostenlos starten →
          </Link>
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
            <Link href="/handwerker" style={{ color: "var(--accent2)" }}>Für Handwerker</Link>
            {" · "}
            <Link href="/notdienst-verwaltung" style={{ color: "var(--accent2)" }}>Notdienst-Verwaltung</Link>
            {" · "}
            <Link href="/stundenzettel-vorlage" style={{ color: "var(--accent2)" }}>Stundenzettel-Vorlage</Link>
            {" · "}
            <Link href="/zuschlagsrechner" style={{ color: "var(--accent2)" }}>Zuschlagsrechner</Link>
            {" · "}
            <Link href="/demo" style={{ color: "var(--accent2)" }}>Live-Demo</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
