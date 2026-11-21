import type { Metadata } from "next";
import Link from "next/link";
import { BETA_END_DATE_LABEL } from "@/lib/beta";
import { BETA_PRICE_LINE } from "@/lib/pricing";

const REGISTER_HREF = "/register?as=company&utm_source=seo&utm_campaign=stundenzettel-genehmigen";

export const metadata: Metadata = {
  title: "Stundenzettel genehmigen – Checkliste für Chefs",
  description:
    "Stundenzettel prüfen und freigeben: Worauf Arbeitgeber achten müssen (10 Stunden, Pausen, Ruhezeit, fehlende Tage), wie Korrekturen sauber laufen und wie die Freigabe digital in Minuten geht.",
  keywords: [
    "Stundenzettel genehmigen", "Stundenzettel freigeben", "Stundenzettel prüfen",
    "Arbeitszeit genehmigen", "Stundenzettel Arbeitgeber", "Monatsabschluss Arbeitszeit",
  ],
  alternates: { canonical: "/stundenzettel-genehmigen" },
  openGraph: {
    title: "Stundenzettel genehmigen – Checkliste für Chefs",
    description: "Was du vor der Freigabe prüfst und wie der Monatsabschluss digital in Minuten erledigt ist.",
    type: "website",
  },
};

const checks = [
  { icon: "⏱", title: "Höchstens 10 Stunden am Tag", desc: "Mehr als 10 Stunden Arbeitszeit pro Werktag sind nach § 3 ArbZG nicht zulässig." },
  { icon: "☕", title: "Pausen eingehalten", desc: "Mindestens 30 Minuten bei mehr als 6 Stunden, 45 Minuten bei mehr als 9 Stunden (§ 4 ArbZG)." },
  { icon: "🌙", title: "11 Stunden Ruhezeit", desc: "Zwischen Arbeitsende und nächstem Beginn — auch nach einem nächtlichen Notdienst-Einsatz (§ 5 ArbZG)." },
  { icon: "📅", title: "Keine Lücken", desc: "Jeder Werktag hat einen Eintrag: Arbeit, Urlaub, Krank oder frei. Fehlende Tage vor dem Lohn klären." },
];

const faq = [
  {
    q: "Muss der Arbeitgeber Stundenzettel genehmigen?",
    a: "Eine Unterschrift oder Genehmigung schreibt das Gesetz nicht ausdrücklich vor. Der Arbeitgeber ist aber dafür verantwortlich, dass die Arbeitszeit erfasst wird (BAG, Beschluss vom 13. September 2022, 1 ABR 22/21). Er darf das Eintragen den Mitarbeitern überlassen, sollte die Angaben aber prüfen — spätestens vor der Lohnabrechnung.",
  },
  {
    q: "Was prüfe ich, bevor ich einen Stundenzettel freigebe?",
    a: "Die gesetzlichen Grenzen (höchstens 10 Stunden am Tag, Pausen, 11 Stunden Ruhezeit), fehlende Tage und ob Urlaub, Krankheit und Notdienste richtig eingetragen sind. Danach die Summen: Soll-Stunden, Ist-Stunden und Überstunden für den Monat.",
  },
  {
    q: "Was mache ich, wenn ein Stundenzettel nicht stimmt?",
    a: "Mit dem Mitarbeiter klären und die Korrektur nachvollziehbar festhalten: was vorher stand, was jetzt gilt und warum. Stillschweigend geänderte Zeiten führen später zu Streit — besonders bei Überstunden.",
  },
  {
    q: "Ist ein digitaler Stundenzettel ohne Unterschrift gültig?",
    a: "Ja. Das Arbeitszeitgesetz schreibt keine bestimmte Form vor. Wichtig ist, dass die Aufzeichnungen vollständig, nachvollziehbar und nach der Freigabe nicht mehr unbemerkt änderbar sind.",
  },
  {
    q: "Wie lange muss ich Stundenzettel aufbewahren?",
    a: "Aufzeichnungen nach § 16 Abs. 2 ArbZG und § 17 MiLoG mindestens zwei Jahre. Für Minijobs und Branchen nach § 2a Schwarzarbeitsbekämpfungsgesetz (z. B. Bau) muss die Arbeitszeit außerdem spätestens nach sieben Tagen aufgezeichnet sein.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export default function StundenzettelGenehmigenPage() {
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
        <Link href={REGISTER_HREF} className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>
          Kostenlos starten
        </Link>
      </nav>

      <section style={{ padding: "24px 16px 8px", maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(26px, 5vw, 40px)", fontWeight: 800, lineHeight: 1.15, marginBottom: 14 }}>
          Stundenzettel genehmigen
        </h1>
        <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.7, maxWidth: 620, margin: "0 auto 24px" }}>
          Worauf du als Chef vor der Freigabe achten musst — und wie der Monatsabschluss
          in Minuten erledigt ist, statt Zettel für Zettel nachzurechnen.
        </p>
      </section>

      <section style={{ padding: "8px 16px 24px", maxWidth: 860, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>Checkliste: Das prüfst du vor der Freigabe</h2>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {checks.map((c) => (
            <div key={c.title} className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{c.icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{c.title}</h3>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{c.desc}</p>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7, marginTop: 14 }}>
          Danach die Summen: Soll-Stunden laut Vertrag, Ist-Stunden, Überstunden, Urlaubs- und Krankheitstage,
          Notdienst-Einsätze. Erst wenn alles stimmt, gibst du den Monat frei und schickst ihn ans Lohnbüro.
        </p>
      </section>

      <section style={{ padding: "24px 16px", maxWidth: 860, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>So läuft die Freigabe mit Stundly</h2>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {[
            { n: "1", title: "Mitarbeiter reicht ein", desc: "Zeiten, Urlaub und Notdienste trägt jeder am Handy ein. Am Monatsende tippt er auf „Einreichen“." },
            { n: "2", title: "Du siehst nur das Auffällige", desc: "Stundly markiert über 10 Stunden, zu kurze Pausen, fehlende Ruhezeit und fehlende Tage. Korrekturen gehen nur mit Grund — der Mitarbeiter sieht vorher und nachher." },
            { n: "3", title: "Ein Klick: freigegeben", desc: "Der Monat ist danach gesperrt, die Freigabe wird protokolliert. Das Lohnbüro bekommt Soll, Ist, Überstunden und Notdienste als CSV und PDF." },
          ].map((s) => (
            <div key={s.n} className="card" style={{ padding: 20 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 15, background: "var(--accent)", color: "white", fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10,
              }}>{s.n}</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{s.title}</h3>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "24px 16px 32px", maxWidth: 760, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>Häufige Fragen</h2>
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
            Monatsabschluss in 5 Minuten
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
            Betrieb anlegen, Mitarbeiter einladen, fertig. Bis {BETA_END_DATE_LABEL} kostenlos. {BETA_PRICE_LINE}.
          </p>
          <Link href={REGISTER_HREF} className="btn btn-primary" style={{ fontSize: 15, padding: "12px 28px", display: "inline-block" }}>
            Betrieb kostenlos anlegen →
          </Link>
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
            <Link href="/firma" style={{ color: "var(--accent2)" }}>Stundly für Betriebe</Link>
            {" · "}
            <Link href="/stundenzettel-vorlage" style={{ color: "var(--accent2)" }}>Stundenzettel-Vorlage</Link>
            {" · "}
            <Link href="/demo" style={{ color: "var(--accent2)" }}>Live-Demo</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
