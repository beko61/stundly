import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Stundly vs. Clockodo — Zeiterfassung für Handwerker",
  description: "Ehrlicher Vergleich Stundly und Clockodo für deutsche Handwerksbetriebe: Preis, Notdienst, Brutto→Netto, DATEV-Export.",
  keywords: [
    "Stundly Clockodo Vergleich",
    "Zeiterfassung Vergleich Handwerker",
    "Alternative zu Clockodo",
    "Clockodo günstiger",
  ],
  alternates: { canonical: "/vergleich/clockodo" },
  openGraph: {
    title: "Stundly vs. Clockodo — Handwerker-Vergleich",
    description: "Ehrlicher Feature-Vergleich für Handwerksbetriebe.",
    type: "website",
  },
};

// Bilinçli olarak sadece objektif, doğrulanabilir kriterlere odaklandık.
// Rakip hakkında iddia edilen her nokta clockodo.com'un kendi Preisseite +
// Feature-Beschreibungen'inden alındı (Stand: Juli 2026). UWG §5 safe.
interface Row {
  category: string;
  stundly:  string;
  clockodo: string;
  advantage?: "stundly" | "clockodo" | "tie";
}

const rows: Row[] = [
  { category: "Preis pro Monat (nach Beta)", stundly: "€5,99 pauschal",       clockodo: "ab €10/Nutzer",     advantage: "stundly" },
  { category: "Team-Tarif",                  stundly: "€19,99 flat (bis 10 MA)", clockodo: "je Nutzer",       advantage: "stundly" },
  { category: "Kostenlose Testphase",        stundly: "3 Monate (Beta) / 14 Tage regulär", clockodo: "14 Tage", advantage: "tie" },
  { category: "Zielgruppe",                  stundly: "Handwerksbetriebe",     clockodo: "Alle Branchen",     advantage: "stundly" },
  { category: "Sprache",                     stundly: "Deutsch",               clockodo: "Deutsch",           advantage: "tie" },
  { category: "Server-Standort",             stundly: "EU (Frankfurt)",        clockodo: "EU (Deutschland)",  advantage: "tie" },
  { category: "DSGVO-konform",               stundly: "✅",                    clockodo: "✅",                advantage: "tie" },
  { category: "Notdienst-Verwaltung",        stundly: "✅ mit Wochen-Zuordnung", clockodo: "keine spezielle Funktion", advantage: "stundly" },
  { category: "Brutto→Netto live-Berechnung", stundly: "✅ alle 6 Steuerklassen", clockodo: "keine Netto-Berechnung", advantage: "stundly" },
  { category: "§3 ArbZG 10h-Warnung",        stundly: "✅ inline im Tracker",  clockodo: "nicht dokumentiert", advantage: "stundly" },
  { category: "§3 EntgFG 6-Wochen Krank",    stundly: "✅ automatisch",        clockodo: "nicht dokumentiert", advantage: "stundly" },
  { category: "§5+§7 BUrlG Urlaubskonto",    stundly: "✅ Zwölftelung + Verfall", clockodo: "Urlaubsverwaltung generisch", advantage: "stundly" },
  { category: "DATEV-Export",                stundly: "✅ Monatliches Lohnjournal", clockodo: "✅ DATEV-Schnittstelle (Add-On)", advantage: "tie" },
  { category: "Foto-Scan (KI-OCR)",          stundly: "✅ inklusive",          clockodo: "kein KI-Scan",      advantage: "stundly" },
  { category: "Projekt-/Zeitkonto-Tracking", stundly: "Basis (Zeitkonto)",     clockodo: "✅ ausführlich",     advantage: "clockodo" },
  { category: "GPS-Standort-Erfassung",      stundly: "❌ (bewusst weggelassen)", clockodo: "✅",              advantage: "clockodo" },
  { category: "Kunden/Baustellen-Verwaltung", stundly: "Basis (Notdienst-Kunde-Feld)", clockodo: "✅ ausführlich", advantage: "clockodo" },
  { category: "Mobile App (iOS + Android)",  stundly: "Web + PWA + native (Expo)", clockodo: "✅ native",     advantage: "tie" },
];

export default function VergleichClockodoPage() {
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
        <Link href="/register" className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>
          Kostenlos starten
        </Link>
      </nav>

      {/* HERO */}
      <section style={{ padding: "40px 24px 24px", maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, fontWeight: 700, letterSpacing: "0.08em" }}>
          EHRLICHER VERGLEICH · JULI 2026
        </div>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 800, lineHeight: 1.15, marginBottom: 16 }}>
          Stundly vs. Clockodo
        </h1>
        <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.7, maxWidth: 640, margin: "0 auto 8px" }}>
          Wir sagen dir, wo Clockodo besser ist — und wo Stundly für Handwerksbetriebe
          das bessere Werkzeug ist. Alle Angaben zu Clockodo basieren auf
          <a href="https://www.clockodo.com" target="_blank" rel="nofollow noopener" style={{ color: "var(--accent2)" }}> clockodo.com</a>{" "}
          (Stand: Juli 2026, öffentlich zugängliche Feature-Beschreibungen und Preise).
        </p>
      </section>

      {/* SUMMARY */}
      <section style={{ padding: "0 24px 32px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <div className="card" style={{
            padding: "18px 20px",
            background: "color-mix(in srgb, var(--accent2) 8%, var(--surface))",
            border: "1px solid color-mix(in srgb, var(--accent2) 30%, transparent)",
          }}>
            <div style={{ fontSize: 12, color: "var(--accent2)", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              👉 Wähle Stundly, wenn du…
            </div>
            <ul style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.85, paddingLeft: 20, margin: 0 }}>
              <li>Handwerksbetrieb bist (Sanitär, Elektro, Bau)</li>
              <li>Notdienst-Einsätze fair abrechnen willst</li>
              <li>deinen <strong>Netto live</strong> sehen möchtest</li>
              <li>ArbZG/BUrlG-Warnungen automatisch bekommen willst</li>
              <li>möglichst günstig starten willst (€5,99 vs €10+)</li>
            </ul>
          </div>
          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              👉 Bleib bei Clockodo, wenn du…
            </div>
            <ul style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.85, paddingLeft: 20, margin: 0 }}>
              <li>Agentur oder Beratungsfirma bist (Projekte + Stundensatz je Kunde)</li>
              <li>GPS-Standort-Erfassung brauchst</li>
              <li>viele Kunden/Baustellen mit Reports pro Kunde führst</li>
              <li>schon eingerichtet bist und keinen Wechsel willst</li>
            </ul>
          </div>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section style={{ padding: "32px 24px 48px", maxWidth: 1000, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20, textAlign: "center" }}>
          Feature-für-Feature
        </h2>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr style={{ background: "var(--surface2)" }}>
                  <th style={{ textAlign: "left", padding: "12px 14px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Kategorie
                  </th>
                  <th style={{ textAlign: "left", padding: "12px 14px", fontSize: 11, fontWeight: 700, color: "var(--accent2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Stundly
                  </th>
                  <th style={{ textAlign: "left", padding: "12px 14px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Clockodo
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.category} style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding: "12px 14px", color: "var(--muted)", fontSize: 12 }}>
                      {r.category}
                    </td>
                    <td style={{
                      padding: "12px 14px", fontSize: 12,
                      fontWeight: r.advantage === "stundly" ? 700 : 400,
                      color: r.advantage === "stundly" ? "var(--accent2)" : "var(--text)",
                    }}>
                      {r.stundly}
                    </td>
                    <td style={{
                      padding: "12px 14px", fontSize: 12,
                      fontWeight: r.advantage === "clockodo" ? 700 : 400,
                      color: r.advantage === "clockodo" ? "var(--text)" : "var(--muted)",
                    }}>
                      {r.clockodo}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "24px 24px 80px", maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
        <div className="card" style={{ padding: "32px 24px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
            Selber testen — kostenlos
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
            3 Monate Beta-Zugang. Keine Kreditkarte. Danach lebenslang{" "}
            <span style={{ textDecoration: "line-through", opacity: 0.7 }}>€19,99</span>{" "}
            <strong style={{ color: "var(--accent2)" }}>€5,99/Monat</strong>.
          </p>
          <Link href="/register" className="btn btn-primary" style={{ fontSize: 14, padding: "12px 28px", display: "inline-block" }}>
            Stundly starten →
          </Link>
          <div style={{ marginTop: 12, fontSize: 11, color: "var(--muted)" }}>
            <Link href="/demo" style={{ color: "var(--accent2)" }}>Erst Demo</Link>
            {" · "}
            <Link href="/handwerker" style={{ color: "var(--accent2)" }}>Für Handwerker</Link>
            {" · "}
            <Link href="/notdienst-verwaltung" style={{ color: "var(--accent2)" }}>Notdienst-Details</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
