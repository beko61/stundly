import type { Metadata } from "next";
import Link from "next/link";
import { BETA_END_DATE_LABEL } from "@/lib/beta";
import { StundenzettelExcelForm } from "@/components/tools/StundenzettelExcelForm";

export const metadata: Metadata = {
  title: "Stundenzettel Excel-Vorlage 2026/2027 – kostenlos mit Formeln",
  description:
    "Kostenlose Stundenzettel-Vorlage für Excel: 12 Monatsblätter und Jahresübersicht, Stunden, Soll und Überstunden rechnen sich automatisch, Feiertage deines Bundeslands sind schon eingetragen.",
  keywords: [
    "Stundenzettel Excel Vorlage", "Stundenzettel Excel", "Arbeitszeiterfassung Excel Vorlage",
    "Stundenzettel xlsx", "Überstunden Excel Vorlage", "Stundennachweis Excel", "Stundenzettel 2027",
  ],
  alternates: { canonical: "/stundenzettel-excel-vorlage" },
  openGraph: {
    title: "Stundenzettel Excel-Vorlage – kostenlos mit Formeln",
    description: "12 Monate + Jahresübersicht, Überstunden automatisch, Feiertage eingetragen.",
    type: "website",
  },
};

const faq = [
  {
    q: "Wie rechnet die Excel-Vorlage?",
    a: "Stunden = Ende − Beginn − Pause. Schichten über Mitternacht (z. B. 22:00 bis 2:00) werden richtig gerechnet. Unter jedem Monat stehen Summe, Soll-Stunden und Überstunden; das Blatt „Jahr“ sammelt alle Monate.",
  },
  {
    q: "Wo stelle ich meine Soll-Stunden ein?",
    a: "Im Blatt „Jahr“ in Zelle B4 (voreingestellt: 8 Stunden pro Arbeitstag). Arbeitstage sind Montag bis Freitag ohne die Feiertage deines Bundeslands. Alle Monate übernehmen den Wert automatisch.",
  },
  {
    q: "Was trage ich bei Urlaub oder Krankheit ein?",
    a: "Schreib „Urlaub“ oder „Krank“ in die Spalte Bemerkung. Der Tag zählt dann mit deinen Soll-Stunden, damit keine Minusstunden entstehen.",
  },
  {
    q: "Mit welchen Programmen funktioniert die Datei?",
    a: "Die Vorlage ist eine normale .xlsx-Datei und wurde mit Microsoft Excel getestet. LibreOffice Calc und Google Tabellen können .xlsx-Dateien ebenfalls öffnen.",
  },
  {
    q: "Ist Arbeitszeiterfassung Pflicht?",
    a: "Ja. Nach dem Bundesarbeitsgericht (Beschluss vom 13. September 2022, 1 ABR 22/21) müssen Arbeitgeber die Arbeitszeit ihrer Beschäftigten erfassen. Eine bestimmte Form ist bisher nicht vorgeschrieben — auch eine Excel-Tabelle ist möglich.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

const vergleich: [string, string, string][] = [
  ["Eintragen", "am PC, Zelle für Zelle", "am Handy, direkt auf der Baustelle"],
  ["Überstunden", "Formeln in der Datei", "automatisch, auch über Monate"],
  ["Notdienst", "eigene Zeilen nötig", "Einsatz mit Foto, Unterschrift und PDF-Bericht"],
  ["Urlaub", "von Hand zählen", "Urlaubskonto und Antrag als PDF"],
  ["Kosten", "kostenlos", `in der Beta kostenlos bis ${BETA_END_DATE_LABEL}`],
];

export default function StundenzettelExcelVorlagePage() {
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
          Stundenzettel-Vorlage für Excel
        </h1>
        <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.7, maxWidth: 620, margin: "0 auto 24px" }}>
          Ein ganzes Jahr in einer Datei: 12 Monatsblätter und eine Jahresübersicht. Stunden, Soll und
          Überstunden rechnen sich selbst, die Feiertage deines Bundeslands sind schon markiert.
          Kostenlos, ohne Anmeldung.
        </p>
      </section>

      <section style={{ padding: "0 16px 32px", maxWidth: 760, margin: "0 auto" }}>
        <StundenzettelExcelForm />
      </section>

      <section style={{ padding: "24px 16px", maxWidth: 760, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>Das steckt in der Datei</h2>
        <div className="card" style={{ padding: "18px 20px", fontSize: 14, color: "var(--muted)", lineHeight: 1.8 }}>
          <p>• Pro Monat ein Blatt mit allen Tagen — Wochenenden grau, Feiertage gelb mit Namen</p>
          <p>• Spalten für Beginn, Ende, Pause, Stunden, Tätigkeit / Baustelle und Bemerkung</p>
          <p>• Summe, Arbeitstage, Soll-Stunden und Überstunden unter jedem Monat</p>
          <p>• Blatt „Jahr“ mit allen Monaten und der Jahressumme</p>
          <p>• Unterschriftsfelder, A4 hochformatig druckbar</p>
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 10 }}>
          Lieber auf Papier? <Link href="/stundenzettel-vorlage" style={{ color: "var(--accent2)" }}>Stundenzettel als PDF zum Ausdrucken</Link>
        </p>
      </section>

      <section style={{ padding: "24px 16px", maxWidth: 760, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>Excel oder App?</h2>
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 460 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12 }}>
                <th style={{ padding: "12px 16px" }}></th>
                <th style={{ padding: "12px 16px" }}>Excel-Vorlage</th>
                <th style={{ padding: "12px 16px" }}>Stundly</th>
              </tr>
            </thead>
            <tbody>
              {vergleich.map(([k, excel, app]) => (
                <tr key={k} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 16px", fontWeight: 700 }}>{k}</td>
                  <td style={{ padding: "10px 16px", color: "var(--muted)" }}>{excel}</td>
                  <td style={{ padding: "10px 16px" }}>{app}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
            Stundenzettel ohne Excel
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
            Mit Stundly erfasst du Arbeitszeit, Urlaub und Notdienste am Handy — Überstunden sind immer
            ausgerechnet, der Monatsbericht entsteht als PDF. In der Beta kostenlos bis {BETA_END_DATE_LABEL}.
          </p>
          <Link href="/register" className="btn btn-primary" style={{ fontSize: 15, padding: "12px 28px", display: "inline-block" }}>
            Kostenlos starten →
          </Link>
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
            <Link href="/ueberstundenrechner" style={{ color: "var(--accent2)" }}>Überstundenrechner</Link>
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
