import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Zeiterfassung für Handwerker — Stundly",
  description: "Zeiterfassung speziell für deutsche Handwerksbetriebe: Notdienst-Verwaltung, Brutto→Netto live, ArbZG-Warnungen, DATEV-Export. Solo & KMU.",
  keywords: [
    "Zeiterfassung Handwerker",
    "Arbeitszeiterfassung Handwerksbetrieb",
    "Stundenzettel Handwerk",
    "Notdienst Erfassung",
    "Handwerker App",
  ],
  alternates: { canonical: "/handwerker" },
  openGraph: {
    title: "Zeiterfassung für Handwerker — Stundly",
    description: "Für Solo-Handwerker und KMU-Betriebe. Notdienst, Brutto→Netto live, DSGVO-konform.",
    type: "website",
  },
};

const painPoints = [
  {
    problem: "Notdienst-Stunden gehen unter",
    solution:
      "Trag deine Wochenend- und Nacht-Einsätze mit einem Klick ein. Bonus wird korrekt zum Vormonat gebucht.",
  },
  {
    problem: "Excel-Chaos am Monatsende",
    solution:
      "Stundenzettel direkt aus dem Handy — Baustelle, Kunde, Notiz. Am Monatsende ein PDF + DATEV-CSV für deinen Steuerberater.",
  },
  {
    problem: "Was bleibt am Ende netto?",
    solution:
      "Brutto→Netto live berechnet. Steuerklasse, SV-Beiträge, Notdienst-Bonus — alles im Blick, kein Rätselraten.",
  },
  {
    problem: "Angst vor der Betriebsprüfung",
    solution:
      "Automatische Warnungen bei §3 ArbZG (10h Tagesgrenze), §5 Ruhezeit, §3 EntgFG (6 Wochen Krank), §7 BUrlG (Urlaubs­übertrag).",
  },
];

const features = [
  { icon: "🚨", title: "Notdienst mit Wochen-Zuordnung",
    desc: "Sa-So Einsatz? Bonus geht automatisch zum Monat des Wochen-Anfangs (Montag). Kein manuelles Verschieben." },
  { icon: "📷", title: "Foto-Scan (KI)",
    desc: "Papier-Stundenzettel abfotografiert, KI liest Datum + Uhrzeiten. Bei Kunden vor Ort ideal." },
  { icon: "🏖", title: "Urlaub PDF mit Unterschrift",
    desc: "Antrag ausfüllen, Unterschrift auf dem Handy, PDF wird direkt an Vorgesetzten gemailt." },
  { icon: "💶", title: "Brutto → Netto live",
    desc: "Alle 6 Steuerklassen, aktueller Grundfreibetrag, Kirchensteuer, Pflegeversicherung mit/ohne Kind." },
  { icon: "📊", title: "DATEV-Export für Steuerberater",
    desc: "Monatliche CSV im Lohnjournal-Format. Personalnummer, Sollstunden, Bruttolohn — direkt import­fähig." },
  { icon: "⚖", title: "Deutsches Arbeitsrecht ready",
    desc: "ArbZG, EntgFG, BUrlG — automatische Warnungen im Tracker und im Wochen-Bericht." },
];

export default function HandwerkerLandingPage() {
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
          background: "color-mix(in srgb, var(--accent2) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--accent2) 30%, transparent)",
          borderRadius: 20, padding: "6px 14px", marginBottom: 24,
          fontSize: 12, fontWeight: 700, color: "var(--accent2)",
        }}>
          🧑‍🔧 Für deutsche Handwerksbetriebe
        </div>

        <h1 style={{ fontSize: "clamp(30px, 5vw, 48px)", fontWeight: 800, lineHeight: 1.15, marginBottom: 20 }}>
          Zeiterfassung für <span style={{ color: "var(--accent2)" }}>Handwerker</span> — <br />
          endlich richtig gedacht.
        </h1>
        <p style={{ fontSize: 17, color: "var(--muted)", lineHeight: 1.7, maxWidth: 640, margin: "0 auto 32px" }}>
          Stundly ist die einzige Zeiterfassung, die deinen <strong style={{ color: "var(--text)" }}>Notdienst-Bonus</strong> richtig zuordnet
          und deinen <strong style={{ color: "var(--text)" }}>Netto live</strong> berechnet.
          Für Solo-Handwerker, kleine Betriebe (5–30 MA) und Notdienst-Rotationen.
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/register" className="btn btn-primary" style={{ fontSize: 15, padding: "12px 24px" }}>
            3 Monate gratis starten
          </Link>
          <Link href="/demo" className="btn" style={{
            fontSize: 15, padding: "12px 24px",
            background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)",
          }}>
            Live-Demo →
          </Link>
        </div>
      </section>

      {/* PAIN POINTS */}
      <section style={{ padding: "48px 24px", maxWidth: 900, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 26, fontWeight: 800, marginBottom: 12 }}>
          Was Handwerker wirklich brauchen
        </h2>
        <p style={{ textAlign: "center", color: "var(--muted)", marginBottom: 40, fontSize: 14 }}>
          Aus 20+ Gesprächen mit Handwerksbetrieben in NRW und NI.
        </p>
        <div style={{ display: "grid", gap: 14 }}>
          {painPoints.map((p) => (
            <div key={p.problem} className="card" style={{ padding: "18px 22px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--red)", marginBottom: 6 }}>
                ❌ {p.problem}
              </div>
              <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6 }}>
                ✅ {p.solution}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: "16px 24px 64px", maxWidth: 1100, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 26, fontWeight: 800, marginBottom: 40 }}>
          Was Stundly kann
        </h2>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {features.map((f) => (
            <div key={f.title} className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "48px 24px 80px", maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
        <div className="card" style={{ padding: "36px 28px" }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
            Kostenlos ausprobieren
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            3 Monate komplett kostenlos während der Beta-Phase. Keine Kreditkarte,
            keine Verpflichtung. Danach nur <span style={{ textDecoration: "line-through", opacity: 0.7 }}>€19,99</span>{" "}
            <strong style={{ color: "var(--accent2)" }}>€5,99/Monat</strong> lebenslang.
          </p>
          <Link href="/register" className="btn btn-primary" style={{ fontSize: 15, padding: "12px 28px", display: "inline-block" }}>
            Jetzt registrieren →
          </Link>
          <div style={{ marginTop: 12, fontSize: 11, color: "var(--muted)" }}>
            <Link href="/demo" style={{ color: "var(--accent2)" }}>Oder erst die Demo ansehen</Link>
            {" · "}
            <Link href="/notdienst-verwaltung" style={{ color: "var(--accent2)" }}>Notdienst-Details</Link>
            {" · "}
            <Link href="/vergleich/clockodo" style={{ color: "var(--accent2)" }}>Vergleich Clockodo</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
