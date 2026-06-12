"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BETA_MODE, BETA_END_DATE_LABEL, betaDaysRemaining } from "@/lib/beta";

type PlanId  = "individual" | "team" | "business";
type Interval = "monthly" | "yearly";

interface Plan {
  id: PlanId | "trial";
  name: string;
  desc: string;
  monthlyPrice: number | null;   // null = trial (free)
  yearlyPrice:  number | null;   // ay başına, yıllık fatura
  features: string[];
  cta: string;
  highlight?: boolean;
  badge?: string | null;
  isTrial?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "trial",
    name: "Kostenlos testen",
    desc: "14 Tage gratis · keine Kreditkarte",
    monthlyPrice: 0,
    yearlyPrice:  0,
    isTrial: true,
    features: ["1 Benutzer", "Alle Grundfunktionen", "PDF Export", "Mobile App", "Volle 14 Tage"],
    cta: "Jetzt starten",
  },
  {
    id: "individual",
    name: "Einzelperson",
    desc: "Für Freelancer & Selbstständige",
    monthlyPrice: 5.99,
    yearlyPrice:  4.92,         // 59/12 ≈ 4.92, ~17% Ersparnis (2 Monate gratis)
    features: ["1 Benutzer", "Arbeitszeiterfassung", "Lohn- & Steuerberechnung", "Notdienst-Verwaltung", "PDF Monatsbericht", "Mobile App"],
    cta: "14 Tage gratis testen",
  },
  {
    id: "team",
    name: "Team",
    desc: "Für Handwerk-Betriebe bis 10 MA",
    monthlyPrice: 19.99,
    yearlyPrice:  16.58,        // 199/12 ≈ 16.58
    highlight: true,
    badge: "BELIEBTESTE WAHL",
    features: ["Bis zu 10 Mitarbeiter", "Admin-Panel", "Mitarbeiter einladen", "Alle Berichte & Exporte", "ArbZG-Warnungen", "Prioritäts-Support"],
    cta: "14 Tage gratis testen",
  },
  {
    id: "business",
    name: "Unternehmen",
    desc: "Für größere Betriebe",
    monthlyPrice: 49.99,
    yearlyPrice:  41.58,        // 499/12 ≈ 41.58
    features: ["Bis zu 50 Mitarbeiter", "Alle Team-Funktionen", "API-Zugang (geplant)", "Eigene Berichte", "Onboarding-Service", "Dedizierter Support"],
    cta: "14 Tage gratis testen",
  },
];

const COMPARISON_ROWS = [
  { feature: "Benutzer",              trial: "1",   individual: "1",   team: "Bis 10", business: "Bis 50" },
  { feature: "Arbeitszeiterfassung",  trial: "✓",  individual: "✓",  team: "✓",     business: "✓" },
  { feature: "Lohn- & Steuerberechnung", trial: "✓", individual: "✓", team: "✓",   business: "✓" },
  { feature: "PDF Export",            trial: "✓",  individual: "✓",  team: "✓",     business: "✓" },
  { feature: "Mobile App / PWA",      trial: "✓",  individual: "✓",  team: "✓",     business: "✓" },
  { feature: "Admin-Panel",           trial: "–",  individual: "–",  team: "✓",     business: "✓" },
  { feature: "Mitarbeiter einladen",  trial: "–",  individual: "–",  team: "✓",     business: "✓" },
  { feature: "KI-Funktionen",         trial: "–",  individual: "–",  team: "✓",     business: "✓" },
  { feature: "API-Zugang",            trial: "–",  individual: "–",  team: "–",     business: "✓" },
  { feature: "Prioritäts-Support",    trial: "–",  individual: "–",  team: "✓",     business: "✓" },
];

export default function PricingPage() {
  const router = useRouter();
  const [interval, setInterval] = useState<Interval>("monthly");
  const [loading, setLoading]   = useState<PlanId | null>(null);
  const [error, setError]       = useState<string | null>(null);

  async function handleCheckout(plan: PlanId) {
    setError(null);
    setLoading(plan);

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      router.push(`/register?next=/pricing`);
      return;
    }

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Checkout konnte nicht gestartet werden. Stripe ist möglicherweise noch nicht konfiguriert.");
        setLoading(null);
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setLoading(null);
    }
  }

  return (
    <div style={{ background: "var(--bg)", color: "var(--text)", fontFamily: "Syne, sans-serif", minHeight: "100vh" }}>
      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(15,15,19,0.85)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border)",
        padding: "0 24px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link href="/" style={{ color: "var(--accent2)", fontWeight: 800, fontSize: 18, letterSpacing: 3, textDecoration: "none" }}>STUNDLY</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/login" style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Anmelden</Link>
          <Link href="/register" className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>
            Kostenlos starten
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px" }}>
        {/* BETA-Modus: Plan-Auswahl ist während der 3-monatigen Beta-Phase ausgeblendet. */}
        {BETA_MODE && (
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div style={{
                display: "inline-block",
                background: "color-mix(in srgb, var(--accent2) 18%, transparent)",
                border: "1px solid color-mix(in srgb, var(--accent2) 40%, transparent)",
                color: "var(--accent2)",
                padding: "6px 16px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 24,
              }}>
                🎁 Beta-Phase
              </div>
              <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 800, marginBottom: 16, lineHeight: 1.15 }}>
                3 Monate <span style={{ color: "var(--accent2)" }}>100% kostenlos</span>
              </h1>
              <p style={{ color: "var(--text)", fontSize: 17, lineHeight: 1.7, marginBottom: 8 }}>
                Stundly ist gerade neu gestartet — und du bekommst <strong>alle Funktionen</strong> bis
                zum <strong>{BETA_END_DATE_LABEL}</strong> komplett gratis.
              </p>
              <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 32 }}>
                Keine Kreditkarte. Keine versteckten Kosten. Noch {betaDaysRemaining()} Tage übrig.
              </p>
            </div>

            <div className="card" style={{ padding: "32px 28px", marginBottom: 28 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 18 }}>
                Was du während der Beta bekommst:
              </h2>
              <ul style={{ listStyle: "none", padding: 0, marginBottom: 24 }}>
                {[
                  "Unbegrenzte Arbeitszeiterfassung",
                  "Notdienst-Verwaltung mit Kunden & Adressen",
                  "Lohn- & Steuerberechnung (Netto/Brutto, alle Steuerklassen)",
                  "PDF Monatsbericht — fertig zum Versenden",
                  "Urlaubsantrag & Kalender",
                  "JSON / CSV Datenexport",
                  "Mobile App (PWA) — auf jedem Handy installierbar",
                  "DSGVO-konform · EU-Server in Frankfurt",
                ].map((f) => (
                  <li key={f} style={{ fontSize: 14, padding: "8px 0", display: "flex", gap: 10, color: "var(--text)" }}>
                    <span style={{ color: "var(--green)", fontWeight: 800, flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className="btn btn-primary"
                style={{ width: "100%", padding: "16px", fontSize: 16, display: "block", textAlign: "center", textDecoration: "none" }}
              >
                Jetzt kostenlos starten →
              </Link>
              <p style={{ textAlign: "center", fontSize: 11, color: "var(--muted)", marginTop: 14 }}>
                In 30 Sekunden registriert · kein Setup nötig
              </p>
            </div>

            <div style={{
              background: "color-mix(in srgb, var(--accent) 8%, var(--surface))",
              border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
              borderRadius: 14,
              padding: "18px 22px",
              marginBottom: 32,
              fontSize: 13,
              color: "var(--text)",
              lineHeight: 1.7,
            }}>
              <strong style={{ color: "var(--accent2)" }}>💡 Was passiert nach der Beta?</strong>
              <br />
              Am {BETA_END_DATE_LABEL} starten die regulären Pläne. Beta-Tester (du!) erhalten
              <strong> 50% lebenslangen Rabatt</strong> als Dankeschön. Du entscheidest dann, ob
              du weitermachen möchtest — niemand bucht dir automatisch etwas ab.
            </div>

            <div style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", lineHeight: 1.8 }}>
              Mit der Nutzung akzeptierst du unsere{" "}
              <Link href="/agb" style={{ color: "var(--accent2)" }}>AGB</Link>{" und "}
              <Link href="/datenschutz" style={{ color: "var(--accent2)" }}>Datenschutzerklärung</Link>.
              <br />
              <Link href="/impressum" style={{ color: "var(--accent2)" }}>Impressum</Link>
            </div>
          </div>
        )}

        {/* Normale Pricing (nach Beta-Ende). Bleibt im Code für späteren Wechsel. */}
        {!BETA_MODE && (
        <>
        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 800, marginBottom: 12 }}>
            Einfache, transparente Preise
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 15 }}>
            14 Tage kostenlos testen · keine Kreditkarte erforderlich · jederzeit kündbar
          </p>
        </div>

        {/* Beta-Tester banner */}
        <div style={{
          maxWidth: 720,
          margin: "0 auto 32px",
          background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 18%, transparent) 0%, color-mix(in srgb, var(--accent2) 18%, transparent) 100%)",
          border: "1px solid color-mix(in srgb, var(--accent2) 40%, transparent)",
          borderRadius: 14,
          padding: "16px 22px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}>
          <div style={{ fontSize: 28 }}>🎁</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginBottom: 2 }}>
              Beta-Tester-Aktion: 30% Rabatt für immer
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              Nur für die ersten 20 Kunden. Code <strong style={{ color: "var(--accent2)" }}>BETA30</strong> beim Checkout eingeben.
            </div>
          </div>
        </div>

        {/* Interval toggle */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
          <div style={{
            display: "inline-flex", background: "var(--surface)",
            border: "1px solid var(--border)", borderRadius: 12, padding: 4,
          }}>
            {(["monthly", "yearly"] as Interval[]).map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                style={{
                  padding: "10px 22px", borderRadius: 8, border: "none",
                  background: interval === iv ? "var(--accent)" : "transparent",
                  color: interval === iv ? "white" : "var(--muted)",
                  fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {iv === "monthly" ? "Monatlich" : "Jährlich"}
                {iv === "yearly" && (
                  <span style={{
                    marginLeft: 8, background: "var(--green)", color: "white",
                    padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 800,
                  }}>
                    2 Monate gratis
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            maxWidth: 600, margin: "0 auto 24px", padding: "12px 16px",
            background: "color-mix(in srgb, var(--red) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)",
            color: "var(--red)", borderRadius: 10, fontSize: 13, textAlign: "center",
          }}>
            ❌ {error}
          </div>
        )}

        {/* Plan kartları */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 80 }}>
          {PLANS.map((plan) => {
            const price = interval === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
            const yearlyTotal = plan.yearlyPrice ? (plan.yearlyPrice * 12).toFixed(0) : null;
            const isLoading = plan.id !== "trial" && loading === plan.id;
            return (
              <div key={plan.id} className="card" style={{
                padding: "28px 22px",
                border: plan.highlight ? "2px solid var(--accent2)" : "1px solid var(--border)",
                position: "relative",
              }}>
                {plan.badge && (
                  <div style={{
                    position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
                    background: "var(--accent2)", color: "#fff",
                    fontSize: 10, fontWeight: 700, padding: "4px 14px", borderRadius: 20, whiteSpace: "nowrap",
                  }}>
                    {plan.badge}
                  </div>
                )}
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{plan.desc}</div>
                <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>{plan.name}</div>
                <div style={{ marginBottom: 20 }}>
                  <span style={{
                    fontSize: 34, fontWeight: 800,
                    color: plan.highlight ? "var(--accent2)" : "var(--text)",
                  }}>
                    {plan.isTrial ? "€0" : `€${price?.toFixed(2)}`}
                  </span>
                  <span style={{ color: "var(--muted)", fontSize: 13 }}>
                    {plan.isTrial ? " / 14 Tage" : " / Monat"}
                  </span>
                  {!plan.isTrial && interval === "yearly" && yearlyTotal && (
                    <div style={{ fontSize: 11, color: "var(--green)", marginTop: 2 }}>
                      Jährlich €{yearlyTotal} (2 Monate gratis)
                    </div>
                  )}
                </div>

                <ul style={{ listStyle: "none", marginBottom: 24 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ fontSize: 12, color: "var(--muted)", padding: "4px 0", display: "flex", gap: 8 }}>
                      <span style={{ color: "var(--green)", flexShrink: 0 }}>✓</span> {f}
                    </li>
                  ))}
                </ul>

                {plan.isTrial ? (
                  <Link
                    href="/register"
                    style={{
                      display: "block", textAlign: "center", textDecoration: "none",
                      background: "var(--surface2)", color: "var(--text)",
                      border: "1px solid var(--border)",
                      padding: "11px", borderRadius: 10, fontWeight: 700, fontSize: 13,
                    }}
                  >
                    {plan.cta}
                  </Link>
                ) : (
                  <button
                    onClick={() => void handleCheckout(plan.id as PlanId)}
                    disabled={isLoading}
                    style={{
                      width: "100%", border: "none", cursor: isLoading ? "wait" : "pointer",
                      background: plan.highlight ? "var(--accent)" : "var(--surface2)",
                      color: plan.highlight ? "#fff" : "var(--text)",
                      borderColor: plan.highlight ? "transparent" : "var(--border)",
                      borderWidth: 1, borderStyle: "solid",
                      padding: "11px", borderRadius: 10, fontWeight: 700, fontSize: 13,
                      fontFamily: "'Syne', sans-serif",
                    }}
                  >
                    {isLoading ? "Lädt..." : plan.cta}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Karşılaştırma Tablosu */}
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 28, textAlign: "center" }}>Detaillierter Vergleich</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "12px 16px", color: "var(--muted)", fontWeight: 600 }}>Funktion</th>
                {["Kostenlos", "Einzelperson", "Team", "Unternehmen"].map((h) => (
                  <th key={h} style={{ textAlign: "center", padding: "12px 16px", color: h === "Team" ? "var(--accent2)" : "var(--muted)", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, i) => (
                <tr key={row.feature} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                  <td style={{ padding: "12px 16px", color: "var(--text)" }}>{row.feature}</td>
                  {[row.trial, row.individual, row.team, row.business].map((val, j) => (
                    <td key={j} style={{ textAlign: "center", padding: "12px 16px", color: val === "✓" ? "var(--green)" : val === "–" ? "var(--muted)" : "var(--text)", fontWeight: val === "✓" ? 700 : 400 }}>{val}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer not */}
        <p style={{ textAlign: "center", marginTop: 48, color: "var(--muted)", fontSize: 13, lineHeight: 1.8 }}>
          Alle Preise gemäß § 19 UStG ohne Umsatzsteuer (Kleinunternehmer-Regelung).
          Zahlung über Stripe (SEPA, Kreditkarte). DSGVO-konform · EU-Server in Frankfurt.
          <br />
          Mit der Buchung akzeptierst du unsere{" "}
          <Link href="/agb" style={{ color: "var(--accent2)" }}>AGB</Link> und{" "}
          <Link href="/datenschutz" style={{ color: "var(--accent2)" }}>Datenschutzerklärung</Link>.
          <br />
          <Link href="/impressum" style={{ color: "var(--accent2)" }}>Impressum</Link>
        </p>
        </>
        )}
      </div>
    </div>
  );
}
