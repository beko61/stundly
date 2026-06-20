import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { BETA_MODE, BETA_END_DATE_LABEL, betaDaysRemaining } from "@/lib/beta";

const APP_URL = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://stundly.de";

/** schema.org JSON-LD — Google'a "bu bir SaaS" der, fiyat + organisator info ile rich snippet üretir. */
const SCHEMA_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Stundly",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web, iOS, Android",
  "url": APP_URL,
  "inLanguage": "de-DE",
  "description": "Arbeitszeiterfassung, Urlaubsverwaltung und Notdienst-Tracking für deutsche Handwerk-Betriebe. DSGVO-konform, ArbZG-ready, mobil nutzbar.",
  "offers": [
    { "@type": "Offer", "name": "Einzelperson",  "price": "5.99",  "priceCurrency": "EUR", "priceValidUntil": "2027-12-31" },
    { "@type": "Offer", "name": "Team",          "price": "19.99", "priceCurrency": "EUR", "priceValidUntil": "2027-12-31" },
    { "@type": "Offer", "name": "Unternehmen",   "price": "49.99", "priceCurrency": "EUR", "priceValidUntil": "2027-12-31" },
  ],
  "creator": {
    "@type": "Organization",
    "name": "Stundly",
    "url": APP_URL,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Hannover",
      "addressRegion": "Niedersachsen",
      "addressCountry": "DE",
    },
  },
  "featureList": [
    "Arbeitszeiterfassung",
    "Lohn- & Steuerberechnung",
    "Urlaubsantrag PDF",
    "Notdienst-Verwaltung",
    "Monatsbericht PDF Export",
    "DSGVO-konforme EU-Speicherung",
  ],
};

/** Telefon-Rahmen (iPhone-style) für Landing-Mockups — Mobile-first. */
function PhoneMock({ children }: { children: ReactNode }) {
  return (
    <div style={{
      width: "100%",
      maxWidth: 290,
      aspectRatio: "9 / 19",
      margin: "0 auto",
      background: "#0a0a0a",
      borderRadius: 38,
      padding: 8,
      boxShadow: "0 12px 40px rgba(0,0,0,0.45), inset 0 0 0 1.5px #2a2a2a",
      position: "relative",
    }}>
      {/* Notch */}
      <div style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        width: 92,
        height: 22,
        background: "#000",
        borderRadius: 12,
        zIndex: 3,
      }} />

      {/* Screen */}
      <div style={{
        background: "var(--bg)",
        borderRadius: 30,
        overflow: "hidden",
        height: "100%",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Status bar */}
        <div style={{
          padding: "10px 22px 4px",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: "var(--text)",
          fontWeight: 700,
          fontFamily: "'DM Mono', monospace",
          flexShrink: 0,
        }}>
          <span>09:41</span>
          <span style={{ letterSpacing: 1.5 }}>● 5G ▮</span>
        </div>

        {/* Content area — scrollable */}
        <div style={{ padding: "8px 10px 16px", flex: 1, overflow: "hidden" }}>
          {children}
        </div>

        {/* Home indicator */}
        <div style={{
          position: "absolute",
          bottom: 7,
          left: "50%",
          transform: "translateX(-50%)",
          width: 100,
          height: 3,
          background: "rgba(255,255,255,0.4)",
          borderRadius: 2,
        }} />
      </div>
    </div>
  );
}

/** Browser-Fensterrahmen für Landing-Mockups (Desktop-Variante). */
function BrowserMock({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
    }}>
      {/* Chrome */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px",
        background: "var(--surface2)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
        </div>
        <div style={{
          flex: 1, background: "var(--bg)", borderRadius: 6,
          padding: "4px 10px", fontSize: 10, color: "var(--muted)",
          fontFamily: "'DM Mono',monospace", textAlign: "center",
        }}>
          🔒 {url}
        </div>
      </div>
      {/* Body */}
      {children}
    </div>
  );
}

const features = [
  { icon: "⏱️", title: "Arbeitszeiterfassung", desc: "Start, Ende, Pausen – automatische Berechnung inklusive Überstunden und Nachtschichten." },
  { icon: "📊", title: "Monats- & Jahresübersicht", desc: "Detaillierte Auswertung mit Donut-Charts. Urlaub, Krank, Feiertage, Überstunden auf einen Blick." },
  { icon: "💰", title: "Lohnberechnung", desc: "Automatische Gehaltsberechnung mit Überstundenzuschlag, Notdienst und Nachtbonus." },
  { icon: "📄", title: "PDF Export", desc: "Professionelle Berichte und Urlaubsanträge als PDF – direkt per E-Mail versenden." },
  { icon: "🏖️", title: "Urlaubsverwaltung", desc: "Urlaubsanträge erstellen, unterschreiben und als PDF exportieren. BURLG-konform." },
  { icon: "📱", title: "Mobile App", desc: "iOS & Android App – auch offline nutzbar. Daten werden automatisch synchronisiert." },
];

const plans = [
  {
    id: "individual",
    name: "Einzelperson",
    price: "5,99",
    period: "/ Monat",
    desc: "Für Freelancer & Selbstständige",
    features: ["1 Benutzer", "Arbeitszeiterfassung", "Lohn- & Steuerberechnung", "Notdienst-Verwaltung", "PDF Monatsbericht", "Mobile App"],
    cta: "14 Tage gratis testen",
    highlight: false,
  },
  {
    id: "team",
    name: "Team",
    price: "19,99",
    period: "/ Monat",
    desc: "Für Handwerk-Betriebe bis 10 MA",
    features: ["Bis zu 10 Mitarbeiter", "Admin-Panel", "Mitarbeiter einladen", "Alle Berichte & Exporte", "ArbZG-Warnungen", "Prioritäts-Support"],
    cta: "14 Tage gratis testen",
    highlight: true,
  },
  {
    id: "business",
    name: "Unternehmen",
    price: "49,99",
    period: "/ Monat",
    desc: "Für größere Betriebe",
    features: ["Bis zu 50 Mitarbeiter", "Alle Team-Funktionen", "API-Zugang (geplant)", "Eigene Berichte", "Onboarding-Service", "Dedizierter Support"],
    cta: "14 Tage gratis testen",
    highlight: false,
  },
];

const faqs = [
  { q: "Ist Stundly DSGVO-konform?", a: "Ja. Alle Daten werden ausschließlich auf EU-Servern (Frankfurt) gespeichert. Wir bieten vollständige Datenportabilität und das Recht auf Löschung." },
  { q: "Muss ich eine Kreditkarte angeben?", a: "Nein. Die kostenlose Testphase ist vollständig ohne Zahlungsdaten – während der Beta-Phase sogar 3 Monate komplett gratis." },
  { q: "Kann ich Stundly in Deutschland nutzen?", a: "Ja. Stundly ist speziell für das deutsche Arbeitsrecht entwickelt – inklusive ArbZG-Warnungen und Mindestlohn-Kontrolle." },
  { q: "Gibt es eine mobile App?", a: "Ja. Stundly ist als PWA für iOS und Android verfügbar und funktioniert auch offline." },
];

export default async function LandingPage() {
  // PWA'da ana sayfayı tekrar açan giriş yapmış kullanıcıyı doğrudan rolüne göre yönlendir.
  // (Telefon ekranından açan kişi "anmelden → dashboard"a gitmek zorunda kalmasın.)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const role = (profile?.role as string | null) ?? "individual";
    if (role === "super_admin")        redirect("/superadmin");
    else if (role === "company_admin") redirect("/company/dashboard");
    else                                redirect("/dashboard");
  }

  return (
    <div style={{ background: "var(--bg)", color: "var(--text)", fontFamily: "Syne, sans-serif" }}>

      {/* schema.org SoftwareApplication structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA_JSON_LD) }}
      />

      {/* BETA-Streifen — ganz oben, durchgehend */}
      {BETA_MODE && (
        <div style={{
          background: "linear-gradient(90deg, color-mix(in srgb, var(--accent) 60%, transparent) 0%, color-mix(in srgb, var(--accent2) 60%, transparent) 100%)",
          color: "white",
          textAlign: "center",
          padding: "9px 24px",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}>
          🎁 BETA: 3 Monate komplett kostenlos — alle Funktionen freigeschaltet bis {BETA_END_DATE_LABEL} (noch {betaDaysRemaining()} Tage)
        </div>
      )}

      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(15,15,19,0.85)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border)",
        padding: "0 24px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ color: "var(--accent2)", fontWeight: 800, fontSize: 18, letterSpacing: 3 }}>STUNDLY</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {!BETA_MODE && (
            <Link href="/pricing" style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Preise</Link>
          )}
          <Link href="/login" style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Anmelden</Link>
          <Link href="/register" className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>
            Kostenlos starten
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        minHeight: "90vh", display: "flex", alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: "80px 24px",
        background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,106,247,0.15) 0%, transparent 70%)",
      }}>
        <div style={{ maxWidth: 700 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "color-mix(in srgb, var(--accent2) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent2) 30%, transparent)",
            borderRadius: 20, padding: "6px 14px", marginBottom: 32,
            fontSize: 12, fontWeight: 700, color: "var(--accent2)",
          }}>
            🇩🇪 Für Deutschland & Europa entwickelt
          </div>

          <h1 style={{ fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 800, lineHeight: 1.1, marginBottom: 24 }}>
            Arbeitszeit einfach<br />
            <span style={{ color: "var(--accent2)" }}>erfassen & verwalten</span>
          </h1>

          <p style={{ fontSize: 18, color: "var(--muted)", lineHeight: 1.7, marginBottom: 40, maxWidth: 520, margin: "0 auto 40px" }}>
            Stundly ist die moderne Zeiterfassungssoftware für Einzelpersonen und Unternehmen – DSGVO-konform, ArbZG-ready, mobil nutzbar.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/register" className="btn btn-primary" style={{ fontSize: 16, padding: "14px 28px" }}>
              {BETA_MODE ? "3 Monate gratis starten" : "14 Tage gratis testen"}
            </Link>
            <Link href={BETA_MODE ? "#features" : "/pricing"} className="btn" style={{
              fontSize: 16, padding: "14px 28px",
              background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)",
            }}>
              {BETA_MODE ? "Features ansehen" : "Preise ansehen"}
            </Link>
          </div>

          <p style={{ marginTop: 16, fontSize: 12, color: "var(--muted)" }}>
            Keine Kreditkarte · Keine Verpflichtung · Jederzeit kündbar
          </p>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: "80px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 800, marginBottom: 12 }}>
          Alles was du brauchst
        </h2>
        <p style={{ textAlign: "center", color: "var(--muted)", marginBottom: 56, fontSize: 15 }}>
          Von der einfachen Zeiterfassung bis zur vollständigen Lohnabrechnung.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          {features.map((f) => (
            <div key={f.title} className="card" style={{ padding: "24px" }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>{f.icon}</div>
              <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* STUNDLY IM EINSATZ — Browser-mockups */}
      <section style={{ padding: "0 24px 80px", maxWidth: 1200, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 800, marginBottom: 12 }}>
          Stundly im Einsatz
        </h2>
        <p style={{ textAlign: "center", color: "var(--muted)", marginBottom: 48, fontSize: 15 }}>
          📱 Auf dem Handy unterwegs · 🖥 Am Desktop im Büro — gleiche Daten, beide Geräte.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 36, justifyItems: "center" }}>

          {/* ─── MOCKUP 1: Tracker (Desktop + Phone) ─── */}
          <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
            {/* Desktop browser */}
            <div style={{ width: "100%", position: "relative", zIndex: 1 }}>
              <BrowserMock url="stundly.de/tracker">
                <div style={{ padding: "12px 14px", background: "var(--bg)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                    <div style={{ background: "color-mix(in srgb, var(--green) 10%, var(--surface))", border: "1px solid color-mix(in srgb, var(--green) 30%, transparent)", borderRadius: 7, padding: "7px 9px" }}>
                      <div style={{ fontSize: 8, fontWeight: 800, color: "var(--green)", textTransform: "uppercase" }}>📊 Differenz</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: "var(--green)", marginTop: 2 }}>+04:15</div>
                      <div style={{ fontSize: 8, color: "var(--muted)", marginTop: 1 }}>Überstunden</div>
                    </div>
                    <div style={{ background: "color-mix(in srgb, var(--blue) 10%, var(--surface))", border: "1px solid color-mix(in srgb, var(--blue) 30%, transparent)", borderRadius: 7, padding: "7px 9px" }}>
                      <div style={{ fontSize: 8, fontWeight: 800, color: "var(--blue)", textTransform: "uppercase" }}>⏱ Gearbeitet</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: "var(--blue)", marginTop: 2 }}>178:15</div>
                      <div style={{ fontSize: 8, color: "var(--muted)", marginTop: 1 }}>von 174 Std</div>
                    </div>
                  </div>
                  {[
                    { d: "01.06.", dow: "Mo", type: "Arbeiten", se: "07:45–17:00", dur: "08:15", color: "var(--green)", icon: "✓" },
                    { d: "02.06.", dow: "Di", type: "Arbeiten", se: "07:45–17:00", dur: "08:15", color: "var(--green)", icon: "✓" },
                    { d: "03.06.", dow: "Mi", type: "Urlaub",   se: "—",          dur: "08:00", color: "var(--blue)",  icon: "🏖" },
                    { d: "04.06.", dow: "Do", type: "Arbeiten", se: "07:45–17:00", dur: "08:15", color: "var(--green)", icon: "✓" },
                    { d: "05.06.", dow: "Fr", type: "Arbeiten", se: "07:45–14:30", dur: "06:15", color: "var(--green)", icon: "✓" },
                  ].map((e) => (
                    <div key={e.d} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      background: "var(--surface)", border: "1px solid var(--border)",
                      borderLeft: `2px solid ${e.color}`,
                      borderRadius: 5, padding: "6px 9px", marginBottom: 3,
                    }}>
                      <div style={{ width: 28, fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--muted)", fontWeight: 700 }}>{e.d}</div>
                      <div style={{ width: 18, fontSize: 9, color: "var(--muted)" }}>{e.dow}</div>
                      <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: e.color }}>{e.icon} {e.type}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--muted)" }}>{e.se}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 700, color: e.color, width: 34, textAlign: "right" }}>{e.dur}</div>
                    </div>
                  ))}
                </div>
              </BrowserMock>
            </div>
            {/* Phone overlapping at bottom */}
            <div style={{ width: "55%", maxWidth: 180, marginTop: -50, position: "relative", zIndex: 2, transform: "translateX(38%) rotate(2deg)" }}>
              <PhoneMock>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 4px 6px" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "var(--accent2)", letterSpacing: 1.5 }}>STUNDLY</span>
                  <span style={{ fontSize: 8, color: "var(--muted)" }}>Juni</span>
                </div>
                {[
                  { d: "01", dow: "Mo", dur: "08:15", color: "var(--green)", icon: "✓" },
                  { d: "02", dow: "Di", dur: "08:15", color: "var(--green)", icon: "✓" },
                  { d: "03", dow: "Mi", dur: "08:00", color: "var(--blue)",  icon: "🏖" },
                  { d: "04", dow: "Do", dur: "08:15", color: "var(--green)", icon: "✓" },
                  { d: "05", dow: "Fr", dur: "06:15", color: "var(--green)", icon: "✓" },
                ].map((e) => (
                  <div key={e.d} style={{
                    display: "flex", alignItems: "center", gap: 4,
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderLeft: `2px solid ${e.color}`,
                    borderRadius: 4, padding: "3px 5px", marginBottom: 2,
                  }}>
                    <div style={{ width: 14, fontFamily: "'DM Mono',monospace", fontSize: 8, color: "var(--muted)", fontWeight: 700 }}>{e.d}</div>
                    <div style={{ width: 14, fontSize: 7, color: "var(--muted)" }}>{e.dow}</div>
                    <div style={{ flex: 1, fontSize: 8, fontWeight: 700, color: e.color }}>{e.icon}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 8, fontWeight: 700, color: e.color }}>{e.dur}</div>
                  </div>
                ))}
              </PhoneMock>
            </div>
            <div style={{ textAlign: "center", marginTop: 24, color: "var(--muted)", fontSize: 13 }}>
              <strong style={{ color: "var(--text)" }}>Zeiterfassung</strong> — desktop + handy synchron
            </div>
          </div>

          {/* ─── MOCKUP 2: Lohn (Desktop + Phone) ─── */}
          <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
            <div style={{ width: "100%", position: "relative", zIndex: 1 }}>
              <BrowserMock url="stundly.de/salary">
                <div style={{ padding: "14px 14px", background: "var(--bg)" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>💰 Juni 2026 — Schätzung</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center", marginBottom: 12 }}>
                    <div style={{ textAlign: "center", background: "color-mix(in srgb, var(--green) 14%, transparent)", borderRadius: 10, padding: "10px 8px" }}>
                      <div style={{ fontSize: 8, color: "var(--muted)", fontWeight: 700, marginBottom: 2 }}>BRUTTO</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 700, color: "var(--green)" }}>€ 2.847</div>
                    </div>
                    <div style={{ fontSize: 18, color: "var(--muted)" }}>→</div>
                    <div style={{ textAlign: "center", background: "color-mix(in srgb, var(--accent2) 14%, transparent)", borderRadius: 10, padding: "10px 8px" }}>
                      <div style={{ fontSize: 8, color: "var(--muted)", fontWeight: 700, marginBottom: 2 }}>NETTO</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 700, color: "var(--accent2)" }}>€ 1.973</div>
                    </div>
                  </div>
                  <div style={{ background: "color-mix(in srgb, var(--red) 8%, var(--surface))", border: "1px solid color-mix(in srgb, var(--red) 25%, transparent)", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 8, color: "var(--red)", fontWeight: 800, textTransform: "uppercase", marginBottom: 5 }}>🧾 Abzüge</div>
                    {[
                      { l: "Lohnsteuer", v: "318,40" },
                      { l: "RV (9,3 %)", v: "264,77" },
                      { l: "KV (8,15 %)", v: "232,03" },
                      { l: "AV (1,3 %)", v: "37,01" },
                      { l: "PV (2,35 %)", v: "66,90" },
                    ].map((r) => (
                      <div key={r.l} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, padding: "2px 0" }}>
                        <span style={{ color: "var(--muted)" }}>{r.l}</span>
                        <span style={{ fontFamily: "'DM Mono',monospace", color: "var(--red)" }}>−€ {r.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </BrowserMock>
            </div>
            <div style={{ width: "55%", maxWidth: 180, marginTop: -50, position: "relative", zIndex: 2, transform: "translateX(38%) rotate(2deg)" }}>
              <PhoneMock>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 4px 6px" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "var(--accent2)", letterSpacing: 1.5 }}>STUNDLY</span>
                  <span style={{ fontSize: 8, color: "var(--muted)" }}>💰</span>
                </div>
                <div style={{ background: "color-mix(in srgb, var(--green) 14%, transparent)", borderRadius: 7, padding: "7px 8px", marginBottom: 3, textAlign: "center" }}>
                  <div style={{ fontSize: 7, color: "var(--muted)", fontWeight: 700 }}>BRUTTO</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, color: "var(--green)" }}>€ 2.847</div>
                </div>
                <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 11, margin: "1px 0" }}>↓</div>
                <div style={{ background: "color-mix(in srgb, var(--accent2) 14%, transparent)", borderRadius: 7, padding: "7px 8px", marginBottom: 4, textAlign: "center" }}>
                  <div style={{ fontSize: 7, color: "var(--muted)", fontWeight: 700 }}>NETTO</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, color: "var(--accent2)" }}>€ 1.973</div>
                </div>
              </PhoneMock>
            </div>
            <div style={{ textAlign: "center", marginTop: 24, color: "var(--muted)", fontSize: 13 }}>
              <strong style={{ color: "var(--text)" }}>Lohn & Steuer</strong> — Brutto → Netto auf beiden
            </div>
          </div>

          {/* ─── MOCKUP 3: Dashboard Setup (Desktop + Phone) ─── */}
          <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
            <div style={{ width: "100%", position: "relative", zIndex: 1 }}>
              <BrowserMock url="stundly.de/dashboard">
                <div style={{ padding: "16px 16px", background: "var(--bg)" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>Guten Morgen, Yusuf 👋</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 14 }}>Willkommen bei Stundly — in 3 Schritten startklar.</div>
                  <div style={{
                    background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 16%, transparent) 0%, color-mix(in srgb, var(--accent2) 10%, transparent) 100%)",
                    border: "1px solid color-mix(in srgb, var(--accent2) 30%, transparent)",
                    borderRadius: 11, padding: "12px 11px",
                  }}>
                    <div style={{ fontSize: 8, color: "var(--accent2)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 9 }}>
                      🚀 In 3 Schritten startklar
                    </div>
                    {[
                      { n: 1, icon: "🕐", title: "Standardzeiten festlegen" },
                      { n: 2, icon: "💰", title: "Stundenlohn & Steuer" },
                      { n: 3, icon: "⏱", title: "Ersten Arbeitstag erfassen" },
                    ].map((s) => (
                      <div key={s.n} style={{
                        display: "flex", alignItems: "center", gap: 9,
                        background: "var(--surface)", border: "1px solid var(--border)",
                        borderRadius: 7, padding: "8px 10px", marginBottom: 5,
                      }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "color-mix(in srgb, var(--accent2) 18%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "var(--accent2)", fontSize: 11, flexShrink: 0 }}>{s.n}</div>
                        <div style={{ flex: 1, fontSize: 11, fontWeight: 700 }}>{s.icon} {s.title}</div>
                        <div style={{ fontSize: 10, color: "var(--accent2)", fontWeight: 700 }}>→</div>
                      </div>
                    ))}
                  </div>
                </div>
              </BrowserMock>
            </div>
            <div style={{ width: "55%", maxWidth: 180, marginTop: -50, position: "relative", zIndex: 2, transform: "translateX(38%) rotate(2deg)" }}>
              <PhoneMock>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 4px 6px" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "var(--accent2)", letterSpacing: 1.5 }}>STUNDLY</span>
                  <span style={{ fontSize: 8, color: "var(--muted)" }}>🏠</span>
                </div>
                <div style={{ fontSize: 10, fontWeight: 800, marginBottom: 1 }}>Hi Yusuf 👋</div>
                <div style={{ fontSize: 7, color: "var(--muted)", marginBottom: 6 }}>3 Schritte</div>
                {[
                  { n: 1, icon: "🕐", title: "Standardzeiten" },
                  { n: 2, icon: "💰", title: "Lohn" },
                  { n: 3, icon: "⏱", title: "1. Tag" },
                ].map((s) => (
                  <div key={s.n} style={{
                    display: "flex", alignItems: "center", gap: 5,
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 5, padding: "5px 6px", marginBottom: 3,
                  }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: "color-mix(in srgb, var(--accent2) 22%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "var(--accent2)", fontSize: 7 }}>{s.n}</div>
                    <div style={{ flex: 1, fontSize: 8, fontWeight: 700 }}>{s.icon} {s.title}</div>
                  </div>
                ))}
              </PhoneMock>
            </div>
            <div style={{ textAlign: "center", marginTop: 24, color: "var(--muted)", fontSize: 13 }}>
              <strong style={{ color: "var(--text)" }}>Onboarding</strong> — startklar in 60 Sek.
            </div>
          </div>

        </div>
      </section>

      {/* COMPLIANCE BANNER */}
      <section style={{
        padding: "56px 24px",
        background: "linear-gradient(135deg, rgba(124,106,247,0.08) 0%, rgba(192,132,252,0.08) 100%)",
        borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>
            Konform mit deutschem Recht
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 40 }}>
            Stundly wurde speziell für den deutschen und europäischen Markt entwickelt.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {[
              { icon: "🔒", label: "DSGVO-konform", sub: "Daten in EU (Frankfurt)" },
              { icon: "⚖️", label: "ArbZG-Warnungen", sub: "Max. 8h/Tag Kontrolle" },
              { icon: "💶", label: "Mindestlohn", sub: "Automatische Prüfung" },
              { icon: "🏖️", label: "BUrlG", sub: "Urlaubsanspruch korrekt" },
            ].map((item) => (
              <div key={item.label} style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "20px 16px",
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{item.label}</div>
                <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING — während Beta-Phase komplett ausgeblendet */}
      {BETA_MODE ? (
        <section style={{ padding: "60px 24px 80px", maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
          <div style={{
            background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 16%, transparent) 0%, color-mix(in srgb, var(--accent2) 16%, transparent) 100%)",
            border: "1px solid color-mix(in srgb, var(--accent2) 40%, transparent)",
            borderRadius: 18,
            padding: "44px 36px",
          }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>🎁</div>
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
              Beta-Phase: 3 Monate komplett kostenlos
            </h2>
            <p style={{ color: "var(--text)", fontSize: 15, lineHeight: 1.7, marginBottom: 22 }}>
              Stundly ist gerade neu gestartet. Bis zum <strong>{BETA_END_DATE_LABEL}</strong> bekommst
              du <strong>alle Funktionen</strong> ohne Einschränkung — keine Kreditkarte, keine
              versteckten Kosten.
            </p>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 28 }}>
              Beta-Tester erhalten danach <strong style={{ color: "var(--accent2)" }}>50% lebenslangen Rabatt</strong> als Dankeschön.
            </p>
            <Link href="/register" className="btn btn-primary" style={{ fontSize: 16, padding: "14px 32px", display: "inline-block" }}>
              Jetzt kostenlos starten →
            </Link>
          </div>
        </section>
      ) : (
      <section id="pricing" style={{ padding: "80px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Einfache Preise</h2>
        <p style={{ textAlign: "center", color: "var(--muted)", marginBottom: 16, fontSize: 15 }}>
          Gemäß § 19 UStG ohne Umsatzsteuer · Monatlich kündbar
        </p>
        <p style={{ textAlign: "center", color: "var(--accent2)", fontWeight: 700, fontSize: 13, marginBottom: 52 }}>
          14 Tage kostenlos testen – keine Kreditkarte erforderlich
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {plans.map((plan) => (
            <div key={plan.id} className="card" style={{
              padding: "28px 24px",
              border: plan.highlight ? "2px solid var(--accent2)" : "1px solid var(--border)",
              position: "relative",
            }}>
              {plan.highlight && (
                <div style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  background: "var(--accent2)", color: "#fff",
                  fontSize: 11, fontWeight: 700, padding: "4px 14px", borderRadius: 20,
                  whiteSpace: "nowrap",
                }}>
                  BELIEBTESTE WAHL
                </div>
              )}
              <div style={{ marginBottom: 6, fontSize: 13, color: "var(--muted)" }}>{plan.desc}</div>
              <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 4 }}>{plan.name}</div>
              <div style={{ marginBottom: 24 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: plan.highlight ? "var(--accent2)" : "var(--text)" }}>
                  €{plan.price}
                </span>
                <span style={{ color: "var(--muted)", fontSize: 14 }}>{plan.period}</span>
              </div>

              <ul style={{ listStyle: "none", marginBottom: 28 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ fontSize: 13, color: "var(--muted)", padding: "5px 0", display: "flex", gap: 8 }}>
                    <span style={{ color: "var(--green)" }}>✓</span> {f}
                  </li>
                ))}
              </ul>

              <Link href="/register" className="btn" style={{
                display: "block", textAlign: "center", textDecoration: "none",
                background: plan.highlight ? "var(--accent)" : "var(--surface2)",
                color: plan.highlight ? "#fff" : "var(--text)",
                border: plan.highlight ? "none" : "1px solid var(--border)",
                padding: "12px", borderRadius: 10, fontWeight: 700, fontSize: 14,
              }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* FAQ */}
      <section style={{ padding: "80px 24px", maxWidth: 700, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 800, marginBottom: 48 }}>
          Häufige Fragen
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {faqs.map((faq) => (
            <div key={faq.q} className="card" style={{ padding: "20px 22px" }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{faq.q}</div>
              <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.7 }}>{faq.a}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA BANNER */}
      <section style={{
        padding: "80px 24px", textAlign: "center",
        background: "radial-gradient(ellipse 60% 80% at 50% 50%, rgba(124,106,247,0.12) 0%, transparent 70%)",
      }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, marginBottom: 16 }}>
          Bereit anzufangen?
        </h2>
        <p style={{ color: "var(--muted)", fontSize: 15, marginBottom: 32 }}>
          {BETA_MODE
            ? "3 Monate Beta-Zugang kostenlos – keine Kreditkarte – sofort loslegen"
            : "14 Tage kostenlos – keine Kreditkarte – sofort loslegen"}
        </p>
        <Link href="/register" className="btn btn-primary" style={{ fontSize: 16, padding: "16px 36px" }}>
          Jetzt kostenlos starten
        </Link>
      </section>

      {/* TRUST STRIP — kleine Icons-Reihe vor Footer */}
      <section style={{
        padding: "24px 24px 0",
        maxWidth: 1100, margin: "0 auto",
      }}>
        <div style={{
          display: "flex", flexWrap: "wrap", justifyContent: "center",
          gap: "20px 32px",
          padding: "20px 0",
          borderTop: "1px solid var(--border)",
          fontSize: 12, color: "var(--muted)",
        }}>
          {[
            { icon: "🇩🇪", text: "Entwickelt in Hannover" },
            { icon: "🔒", text: "Server in Frankfurt (EU)" },
            { icon: "🚫", text: "0 Tracking-Cookies" },
            { icon: "⚖️", text: "DSGVO & ArbZG-konform" },
            { icon: "💶", text: "Für Handwerk-Betriebe" },
          ].map((b) => (
            <div key={b.text} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>{b.icon}</span>
              <span style={{ fontWeight: 600 }}>{b.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        borderTop: "1px solid var(--border)", padding: "32px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16,
        maxWidth: 1100, margin: "0 auto",
      }}>
        <span style={{ color: "var(--accent2)", fontWeight: 800, letterSpacing: 2 }}>STUNDLY</span>
        <div style={{ display: "flex", gap: 24 }}>
          <Link href="/impressum" style={{ color: "var(--muted)", fontSize: 13, textDecoration: "none" }}>Impressum</Link>
          <Link href="/datenschutz" style={{ color: "var(--muted)", fontSize: 13, textDecoration: "none" }}>Datenschutz</Link>
          <Link href="/agb" style={{ color: "var(--muted)", fontSize: 13, textDecoration: "none" }}>AGB</Link>
          {!BETA_MODE && (
            <Link href="/pricing" style={{ color: "var(--muted)", fontSize: 13, textDecoration: "none" }}>Preise</Link>
          )}
        </div>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>© 2026 Stundly · gemäß § 19 UStG keine MwSt.</span>
      </footer>
    </div>
  );
}
