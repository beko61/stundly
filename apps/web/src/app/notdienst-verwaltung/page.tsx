import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Notdienst-Verwaltung für Handwerker — Stundly",
  description: "Notdienst-Einsätze richtig erfassen: Wochen-Zuordnung zum Vormonat, Bonus-Berechnung, Handy-Eintrag. Speziell für Sanitär, Elektro, Heizungsbau.",
  keywords: [
    "Notdienst Erfassung",
    "Notdienst Verwaltung Handwerker",
    "Rufbereitschaft App",
    "Notdienst Bonus berechnen",
    "Wochenend-Einsatz Handwerker",
  ],
  alternates: { canonical: "/notdienst-verwaltung" },
  openGraph: {
    title: "Notdienst-Verwaltung für Handwerker",
    description: "Wochen-Zuordnung, Bonus-Berechnung, Handy-Eintrag — für Sanitär, Elektro, Heizungsbau.",
    type: "website",
  },
};

const problems = [
  {
    q: "Wann gehört ein Wochenend-Notdienst zu welchem Monat?",
    a: "Bei Stundly: Der Monat des Wochen-Montags. Beispiel: Notdienst-Woche 28. April – 4. Mai → komplett April. Kein manuelles Verschieben, keine Verwirrung bei der Lohnabrechnung.",
  },
  {
    q: "Wie viel Bonus zahle ich pro Einsatz?",
    a: "Du legst €/Tag in den Lohn-Einstellungen fest. Jeder Einsatz zählt automatisch. Am Monatsende siehst du Anzahl Einsätze × Bonus im Brutto-Aufschlag.",
  },
  {
    q: "Wann wurde der Notdienst bezahlt?",
    a: "Ein Klick auf ⏳ / ✅ neben dem Einsatz. Grün = bezahlt, gelb = offen. Am Monatsende ein Blick — was ist noch offen?",
  },
  {
    q: "Was ist mit Rufbereitschaft (kein Einsatz)?",
    a: "Anders als Notdienst-Einsatz (aktives Arbeiten): Rufbereitschaft (nur bereit) wird in Version v2 als eigene Kategorie ergänzt. Aktuell empfehlen wir, sie als Notiz im Notdienst-Eintrag zu vermerken.",
  },
];

export default function NotdienstLandingPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100dvh" }}>
      {/* Nav */}
      <nav style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "18px 24px", maxWidth: 1100, margin: "0 auto",
      }}>
        <Link href="/" style={{ color: "var(--accent2)", fontWeight: 800, fontSize: 14, letterSpacing: 2, textDecoration: "none" }}>
          ← STUNDLY
        </Link>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/demo" style={{ color: "var(--muted)", fontSize: 13, textDecoration: "none" }}>Demo</Link>
          <Link href="/register" className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>
            Kostenlos starten
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding: "48px 24px 32px", maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <div style={{
          display: "inline-block",
          background: "color-mix(in srgb, var(--orange) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--orange) 30%, transparent)",
          borderRadius: 20, padding: "6px 14px", marginBottom: 24,
          fontSize: 12, fontWeight: 700, color: "var(--orange)",
        }}>
          🚨 Notdienst richtig verwalten
        </div>

        <h1 style={{ fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 800, lineHeight: 1.15, marginBottom: 20 }}>
          Notdienst-Verwaltung mit <br />
          <span style={{ color: "var(--orange)" }}>Wochen-Zuordnung</span> und Bonus-Berechnung
        </h1>
        <p style={{ fontSize: 16, color: "var(--muted)", lineHeight: 1.7, maxWidth: 640, margin: "0 auto 32px" }}>
          Für Sanitär, Elektro, Heizungsbau: der Notdienst-Einsatz gehört genau zu dem
          Monat, in dem die Woche beginnt. Stundly rechnet das automatisch —
          und der Bonus (€/Tag) fließt korrekt in deinen Brutto.
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/demo?tab=zeit" className="btn btn-primary" style={{ fontSize: 15, padding: "12px 24px" }}>
            Live-Demo öffnen
          </Link>
          <Link href="/register" className="btn" style={{
            fontSize: 15, padding: "12px 24px",
            background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)",
          }}>
            Konto erstellen
          </Link>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: "40px 24px", maxWidth: 900, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 24, fontWeight: 800, marginBottom: 40 }}>
          So funktioniert es
        </h2>
        <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {[
            { step: "1", title: "Notdienst-Eintrag anlegen",
              desc: "Am Handy auf den Tag tippen → „+ Notdienst hinzufügen“. Uhrzeit, Kunde, Notiz — fertig." },
            { step: "2", title: "Wochen-Regel automatisch",
              desc: "Der Einsatz gehört zu dem Kalendermonat, in dem der Wochen-Montag liegt. Kein Verschieben nötig." },
            { step: "3", title: "Bonus wird berechnet",
              desc: "Anzahl Einsätze × dein €/Tag Bonus (aus Lohn-Einstellungen). Fließt in Brutto → Netto." },
            { step: "4", title: "Bezahlt-Status verwalten",
              desc: "✅ erledigt / ⏳ offen mit einem Tap. Am Monatsende siehst du, was noch aussteht." },
          ].map((s) => (
            <div key={s.step} className="card" style={{ padding: 20 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 999,
                background: "var(--orange)", color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 800, marginBottom: 10,
              }}>{s.step}</div>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{s.title}</h3>
              <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "48px 24px 32px", maxWidth: 800, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 24, fontWeight: 800, marginBottom: 32 }}>
          Häufige Fragen
        </h2>
        <div style={{ display: "grid", gap: 12 }}>
          {problems.map((p) => (
            <div key={p.q} className="card" style={{ padding: "18px 22px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
                {p.q}
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7 }}>
                {p.a}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "40px 24px 80px", maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
        <div className="card" style={{ padding: "32px 24px", background: "color-mix(in srgb, var(--orange) 6%, var(--surface))" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
            Notdienst richtig erfassen — kostenlos testen
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
            3 Monate Beta-Zugang. Keine Kreditkarte. Danach lebenslang €5,99/Monat statt €19,99.
          </p>
          <Link href="/register" className="btn btn-primary" style={{ fontSize: 14, padding: "12px 28px", display: "inline-block" }}>
            Kostenlos starten →
          </Link>
          <div style={{ marginTop: 12, fontSize: 11, color: "var(--muted)" }}>
            <Link href="/handwerker" style={{ color: "var(--accent2)" }}>Für Handwerker</Link>
            {" · "}
            <Link href="/vergleich/clockodo" style={{ color: "var(--accent2)" }}>Vergleich Clockodo</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
