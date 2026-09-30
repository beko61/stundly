import type { Metadata } from "next";
import Link from "next/link";
import { BETA_END_DATE_LABEL } from "@/lib/beta";
import { BETA_PRICE_LINE } from "@/lib/pricing";
import { isReferralCode } from "@/lib/marketing/referral";

export const metadata: Metadata = {
  title: "Für Betriebe — Stundenzettel ohne Abtippen",
  description:
    "Mitarbeiter erfassen ihre Zeiten und Notdienste am Handy, du gibst den Monat frei und schickst die Lohn-Vorbereitung an den Steuerberater. Für Handwerksbetriebe.",
  alternates: { canonical: "/firma" },
  openGraph: {
    title: "Stundly für Betriebe",
    description: "Monatsabschluss in 5 Minuten: Zeiten, Notdienste, Urlaub — fertig für das Lohnbüro.",
    type: "website",
  },
};

const steps = [
  { n: "1", title: "Mitarbeiter erfassen am Handy", desc: "Arbeitszeit, Urlaub, Krank und Notdienst-Einsätze mit Fotos und Kundenunterschrift — auch ohne Netz auf der Baustelle." },
  { n: "2", title: "Du prüfst nur das Auffällige", desc: "Stundly markiert über 10 Stunden, fehlende Pausen, zu kurze Ruhezeit nach dem Notdienst und fehlende Tage. Der Rest ist mit einem Klick freigegeben." },
  { n: "3", title: "Lohnbüro bekommt alles fertig", desc: "Soll, Ist, Überstunden, Urlaub, Krank und Notdienst-Pauschalen pro Mitarbeiter — als CSV und PDF, auf Wunsch automatisch am 5." },
];

const features = [
  { icon: "🚨", title: "Notdienst-Zentrale", desc: "Rufbereitschaft planen (auch reihum automatisch), alle Einsätze mit Fotos, Unterschrift und PDF-Bericht, Bezahlt-Status, CSV für die Rechnung." },
  { icon: "✏️", title: "Korrekturen nur mit Grund", desc: "Du kannst Zeiten korrigieren — der Mitarbeiter sieht Vorher, Nachher und deinen Grund. Das schafft Vertrauen statt Streit." },
  { icon: "🔒", title: "Monat freigeben", desc: "Mitarbeiter reichen ihren Monat ein, du gibst frei. Danach ist er gesperrt — wichtig für Lohn und Betriebsprüfung." },
  { icon: "📄", title: "Verträge im Griff", desc: "Wochenstunden, Urlaubsanspruch und Beschäftigungsbeginn legst du fest — Soll und Urlaubskonto rechnen sich daraus." },
  { icon: "📬", title: "Montags-Überblick", desc: "Jeden Montag eine kurze Mail: Team-Stunden, wer Rufbereitschaft hat, was zu erledigen ist." },
  { icon: "🛡", title: "Kein GPS, keine Überwachung", desc: "Stundly erfasst Zeiten, nicht Standorte. Server in Frankfurt, DSGVO-konform, AVV auf Anfrage." },
];

export default async function FirmaPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const registerHref = isReferralCode(ref) ? `/register?ref=${ref}` : "/register";

  return (
    <div style={{ background: "var(--bg)", minHeight: "100dvh" }}>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <Link href="/" style={{ color: "var(--accent2)", fontWeight: 800, fontSize: 14, letterSpacing: 2, textDecoration: "none" }}>STUNDLY</Link>
        <Link href={registerHref} className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>Kostenlos starten</Link>
      </nav>

      <section style={{ padding: "40px 24px 24px", maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
        {ref && (
          <div style={{
            display: "inline-block", background: "color-mix(in srgb, var(--green) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--green) 30%, transparent)", borderRadius: 20, padding: "6px 14px",
            marginBottom: 20, fontSize: 12, fontWeight: 700, color: "var(--green)",
          }}>
            👋 Einer deiner Mitarbeiter nutzt Stundly schon
          </div>
        )}
        <h1 style={{ fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 800, lineHeight: 1.15, marginBottom: 18 }}>
          Stundenzettel <span style={{ color: "var(--accent2)" }}>ohne Abtippen</span> —<br />
          Monats{"­"}abschluss in 5 Minuten.
        </h1>
        <p style={{ fontSize: 17, color: "var(--muted)", lineHeight: 1.7, maxWidth: 620, margin: "0 auto 28px" }}>
          Deine Leute tragen Zeiten und Notdienste am Handy ein. Du siehst nur, was auffällig ist, gibst den Monat frei —
          und das Lohnbüro bekommt alles fertig.
        </p>
        <Link href={registerHref} className="btn btn-primary" style={{ fontSize: 15, padding: "12px 26px" }}>Betrieb kostenlos anlegen</Link>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>Bis {BETA_END_DATE_LABEL} kostenlos · keine Kreditkarte</p>
      </section>

      <section style={{ padding: "32px 24px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {steps.map((s) => (
            <div key={s.n} className="card" style={{ padding: 20 }}>
              <div style={{ width: 30, height: 30, borderRadius: 15, background: "var(--accent)", color: "white", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>{s.n}</div>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{s.title}</h2>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "24px 24px 48px", maxWidth: 1100, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 24, fontWeight: 800, marginBottom: 28 }}>Was dein Büro davon hat</h2>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {features.map((f) => (
            <div key={f.title} className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>{f.icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "16px 24px 80px", maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
        <div className="card" style={{ padding: "32px 24px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>In 2 Minuten eingerichtet</h2>
          <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 22 }}>
            Betrieb anlegen, Mitarbeiter hinzufügen, fertig. Wer Stundly schon privat nutzt, behält seine Einträge.
            Bis {BETA_END_DATE_LABEL} kostenlos. {BETA_PRICE_LINE}.
          </p>
          <Link href={registerHref} className="btn btn-primary" style={{ fontSize: 15, padding: "12px 28px", display: "inline-block" }}>Jetzt starten →</Link>
          <div style={{ marginTop: 12, fontSize: 11, color: "var(--muted)" }}>
            <Link href="/pricing" style={{ color: "var(--accent2)" }}>Preise</Link>{" · "}
            <Link href="/notdienst-verwaltung" style={{ color: "var(--accent2)" }}>Notdienst-Details</Link>{" · "}
            <Link href="/kontakt" style={{ color: "var(--accent2)" }}>Fragen? Kontakt</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
