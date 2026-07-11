import Link from "next/link";
import type { Metadata } from "next";
import { ContactForm } from "./form";

export const metadata: Metadata = {
  title: "Kontakt · Stundly",
  description: "Frage, Feedback oder Bug-Report? Schreib direkt an den Entwickler von Stundly — Solo-Indie, Antwort meist in 24h.",
};

export default function KontaktPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100dvh", color: "var(--text)" }}>
      {/* NAV (lite) */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(15,15,19,0.85)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border)",
        padding: "0 16px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link href="/" style={{
          color: "var(--accent2)", fontWeight: 800, fontSize: 18,
          letterSpacing: 3, textDecoration: "none",
        }}>STUNDLY</Link>
        <div style={{ display: "flex", gap: 16 }}>
          <Link href="/demo" style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Demo</Link>
          <Link href="/login" style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Anmelden</Link>
        </div>
      </nav>

      <section style={{
        maxWidth: 560, margin: "0 auto", padding: "40px 16px 60px",
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Sag mir, was du brauchst</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>
            Frage, Feedback, Bug-Report, Feature-Wunsch — alles willkommen.<br/>
            Antwort meist innerhalb von 24h, direkt vom Entwickler.
          </p>
        </div>

        <ContactForm />

        <div style={{
          marginTop: 28, padding: "16px 18px",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, fontSize: 12, color: "var(--muted)", lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>🤝 Was du erwarten kannst</div>
          <div>• Antwort meist in 24h (max. 48h an Wochenenden)</div>
          <div>• Solo-Indie — du redest direkt mit Yusuf, dem Entwickler</div>
          <div>• Bug-Reports werden meist am selben Tag gefixt (im Rahmen)</div>
          <div>• Feature-Wünsche werden im Backlog priorisiert, du bekommst Feedback</div>
        </div>

        <div style={{ marginTop: 16, textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
          Lieber direkt per E-Mail?
          {" "}
          <a href="mailto:info@stundly.de" style={{ color: "var(--accent2)", fontWeight: 700, textDecoration: "none" }}>
            info@stundly.de
          </a>
        </div>
      </section>
    </div>
  );
}
