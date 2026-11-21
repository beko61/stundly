import type { Metadata } from "next";
import Link from "next/link";
import { FREE_UNTIL_TEXT } from "@/lib/beta";
import { NotdienstNettoRechner, NOTDIENST_REGISTER_HREF } from "@/components/tools/NotdienstNettoRechner";

export const metadata: Metadata = {
  title: "Notdienstpauschale netto – Rechner: Was bleibt übrig?",
  description:
    "Wie viel bleibt von deiner Notdienstpauschale nach Steuer und Sozialabgaben? Kostenloser Rechner mit Steuerklasse, dazu die Regeln: steuerpflichtig, sozialversicherungspflichtig, steuerfreie Zuschläge.",
  keywords: [
    "Notdienstpauschale netto", "Notdienstpauschale Rechner", "Notdienstpauschale versteuern",
    "Notdienstpauschale steuerfrei", "Notdienst Pauschale Handwerk", "Bereitschaftspauschale netto",
  ],
  alternates: { canonical: "/notdienstpauschale-rechner" },
  openGraph: {
    title: "Notdienstpauschale netto – was bleibt übrig?",
    description: "Gehalt, Pauschale und Steuerklasse eingeben, sehen, was vom Notdienst netto ankommt.",
    type: "website",
  },
};

const faq = [
  {
    q: "Ist die Notdienstpauschale steuerpflichtig?",
    a: "Ja. Eine Pauschale für die Bereitschaft ist normaler Arbeitslohn und wird mit dem Gehalt versteuert. Steuerfrei nach § 3b EStG können nur Zuschläge für tatsächlich geleistete Arbeit in der Nacht, am Sonntag oder an Feiertagen sein — also für die Einsätze. Pauschale Zahlungen ohne Bezug zur tatsächlich geleisteten Arbeit hat der BFH nicht als steuerfreie Zuschläge anerkannt (Urteil vom 29. November 2016, VI R 61/14).",
  },
  {
    q: "Fallen auf die Pauschale Sozialabgaben an?",
    a: "Ja. Als laufender Arbeitslohn ist die Pauschale beitragspflichtig in der Renten-, Arbeitslosen-, Kranken- und Pflegeversicherung (bis zur jeweiligen Beitragsbemessungsgrenze).",
  },
  {
    q: "Warum bleibt netto weniger übrig, als ich vom Gehalt gewohnt bin?",
    a: "Die Pauschale kommt zum Gehalt dazu. Besteuert wird sie deshalb mit deinem persönlichen Grenzsteuersatz — dem Satz für die letzten Euro deines Einkommens. Der ist höher als dein durchschnittlicher Abzug auf das ganze Gehalt. Der Rechner vergleicht genau das: Netto mit Pauschale minus Netto ohne Pauschale.",
  },
  {
    q: "Welche Rolle spielt die Steuerklasse?",
    a: "Die Steuerklasse bestimmt, wie viel Lohnsteuer jeden Monat einbehalten wird. In Steuerklasse V oder VI bleibt von der Pauschale monatlich deutlich weniger übrig als in III. Die tatsächliche Jahressteuer ergibt sich aber erst aus der Einkommensteuererklärung.",
  },
  {
    q: "Wie hoch ist eine übliche Notdienstpauschale?",
    a: "Das ist je nach Betrieb und Branche verschieden. Gesetzlich ist für die reine Bereitschaft keine Vergütung vorgeschrieben; ob und wie viel es gibt, regeln Arbeitsvertrag, Tarifvertrag oder Betriebsvereinbarung. Einsätze selbst sind Arbeitszeit und mindestens mit dem Mindestlohn zu bezahlen.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export default function NotdienstpauschalePage() {
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
        <Link href={NOTDIENST_REGISTER_HREF} className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>
          Kostenlos starten
        </Link>
      </nav>

      <section style={{ padding: "24px 16px 8px", maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(22px, 5vw, 40px)", fontWeight: 800, lineHeight: 1.15, marginBottom: 14 }}>
          Notdienst{"­"}pauschale netto
        </h1>
        <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.7, maxWidth: 640, margin: "0 auto 24px" }}>
          150 € Pauschale für die Notdienst-Woche — und was kommt davon auf dem Konto an? Trag dein Gehalt, die Pauschale
          und deine Steuerklasse ein. Kostenlos, ohne Anmeldung.
        </p>
      </section>

      <section style={{ padding: "0 16px 32px", maxWidth: 860, margin: "0 auto" }}>
        <NotdienstNettoRechner />
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 12, lineHeight: 1.6 }}>
          Einsätze während des Notdiensts dazurechnen? Das zeigt der{" "}
          <Link href="/rufbereitschaft-verguetung" style={{ color: "var(--accent2)", fontWeight: 700 }}>Rufbereitschaft-Rechner</Link>.
          Welche Zuschläge für Einsätze nachts, sonntags oder feiertags steuerfrei sind, zeigt der{" "}
          <Link href="/zuschlagsrechner" style={{ color: "var(--accent2)", fontWeight: 700 }}>Zuschlagsrechner</Link>.
        </p>
      </section>

      <section style={{ padding: "24px 16px", maxWidth: 760, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>Notdienstpauschale auf einen Blick</h2>
        <div className="card" style={{ padding: "18px 20px", fontSize: 14, color: "var(--muted)", lineHeight: 1.8 }}>
          <p>• <strong style={{ color: "var(--text)" }}>Steuer:</strong> voll lohnsteuerpflichtig, mit deinem Grenzsteuersatz</p>
          <p>• <strong style={{ color: "var(--text)" }}>Sozialabgaben:</strong> beitragspflichtig wie das Gehalt</p>
          <p>• <strong style={{ color: "var(--text)" }}>Steuerfrei:</strong> nur Zuschläge für Einsätze nachts, sonntags, feiertags (§ 3b EStG)</p>
          <p>• <strong style={{ color: "var(--text)" }}>Höhe:</strong> regelt dein Arbeits- oder Tarifvertrag</p>
        </div>
      </section>

      <section style={{ padding: "24px 16px 32px", maxWidth: 760, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>Häufige Fragen zur Notdienstpauschale</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {faq.map((f) => (
            <div key={f.q} className="card" style={{ padding: "16px 20px" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{f.q}</h3>
              <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7 }}>{f.a}</p>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 14, lineHeight: 1.6 }}>
          Hinweis: Die Berechnung ist eine Näherung für gesetzlich Versicherte und ersetzt keine Steuer- oder Rechtsberatung.
          Maßgeblich sind deine Lohnabrechnung und dein Arbeits- oder Tarifvertrag.
        </p>
      </section>

      <section style={{ padding: "16px 16px 80px", maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
        <div className="card" style={{ padding: "32px 24px", background: "color-mix(in srgb, var(--accent) 8%, var(--surface))" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
            Notdienst und Gehalt an einem Ort
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
            Mit Stundly trägst du Notdienst-Wochen und Einsätze am Handy ein — mit Uhrzeit, Fotos und Kundenunterschrift,
            auch ohne Netz. Die Pauschale fließt in deine monatliche Brutto→Netto-Rechnung.
            {FREE_UNTIL_TEXT}.
          </p>
          <Link href={NOTDIENST_REGISTER_HREF} className="btn btn-primary" style={{ fontSize: 15, padding: "12px 28px", display: "inline-block" }}>
            Kostenlos starten →
          </Link>
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
            <Link href="/rufbereitschaft-verguetung" style={{ color: "var(--accent2)" }}>Rufbereitschaft-Rechner</Link>
            {" · "}
            <Link href="/zuschlagsrechner" style={{ color: "var(--accent2)" }}>Zuschlagsrechner</Link>
            {" · "}
            <Link href="/notdienst-verwaltung" style={{ color: "var(--accent2)" }}>Notdienst-Verwaltung</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
