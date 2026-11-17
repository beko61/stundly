"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { PLAN_PRICES, euro } from "@/lib/pricing";
import { startCheckout } from "@/lib/stripe/checkoutClient";

// Preise aus lib/pricing (eine Quelle); nur, was es wirklich gibt
const plans = [
  { id: "team" as const, features: ["Bis 10 Mitarbeiter", "Alle Mitarbeiter mit Plus", "Firmen-Panel, Lohn-Vorbereitung, Foto-Import"] },
  { id: "business" as const, features: ["Bis 50 Mitarbeiter", "Alles aus Team", "Persönliche Einrichtung"] },
];

export default function CompanyBillingPage() {
  const [subscription, setSubscription] = useState<{ plan: string; status: string; current_period_end: string | null; trial_end: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
      if (!profile?.company_id) return;
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan, status, current_period_end, trial_end")
        .eq("company_id", profile.company_id)
        .maybeSingle();
      setSubscription(sub);
      setLoading(false);
    });
  }, []);

  async function handleUpgrade(planId: "team" | "business") {
    setUpgrading(planId);
    setBuyError(null);
    const err = await startCheckout(planId, "monthly");
    if (err) { setBuyError(err); setUpgrading(null); }
  }

  async function handlePortal() {
    setPortalLoading(true);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setPortalLoading(false);
  }

  if (loading) return <div style={{ color: "var(--muted)" }}>Laden...</div>;

  const planLabels: Record<string, string> = { trial: "Testphase", individual: "Plus", team: "Team", business: "Unternehmen" };
  const trialEnd = subscription?.trial_end ? new Date(subscription.trial_end) : null;
  const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000)) : 0;

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Abonnement</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 28 }}>Plan verwalten und Rechnungen einsehen.</p>

      {/* Aktueller Plan */}
      <div className="card" style={{ padding: "24px", marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Aktueller Plan</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent2)" }}>{planLabels[subscription?.plan ?? "trial"]}</div>
            {subscription?.status === "trialing" && (
              <div style={{ fontSize: 12, color: "var(--yellow)", marginTop: 4 }}>
                🕐 Testphase endet in {trialDaysLeft} Tagen ({trialEnd?.toLocaleDateString("de-DE")})
              </div>
            )}
            {subscription?.status === "active" && subscription.current_period_end && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                Nächste Zahlung: {new Date(subscription.current_period_end).toLocaleDateString("de-DE")}
              </div>
            )}
          </div>
          {subscription && subscription.plan !== "trial" && (
            <button
              className="btn"
              onClick={handlePortal}
              disabled={portalLoading}
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13 }}
            >
              {portalLoading ? "..." : "Abonnement verwalten"}
            </button>
          )}
        </div>
      </div>

      {/* Plan yükseltme */}
      {/* Auch ohne Abo-Zeile (z. B. Firma vor Migration/ohne Testzeile) muss man buchen können */}
      {(!subscription || subscription.plan === "trial" || subscription.plan === "individual") && (
        <>
          <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Firmen-Abo buchen</h2>
          {buyError && (
            <div role="alert" style={{ fontSize: 13, color: "var(--orange)", marginBottom: 14, lineHeight: 1.5 }}>{buyError}</div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            {plans.map(plan => (
              <div key={plan.id} className="card" style={{ padding: "22px" }}>
                <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 4 }}>{PLAN_PRICES[plan.id].name}</div>
                <div style={{ marginBottom: 16 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: "var(--accent2)" }}>{euro(PLAN_PRICES[plan.id].monthly)}</span>
                  <span style={{ color: "var(--muted)", fontSize: 13 }}> / Monat</span>
                  <div style={{ fontSize: 11, color: "var(--green)" }}>Beta-Tester: {euro(PLAN_PRICES[plan.id].beta)} / Monat</div>
                </div>
                <ul style={{ listStyle: "none", marginBottom: 18 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ fontSize: 12, color: "var(--muted)", padding: "3px 0", display: "flex", gap: 6 }}>
                      <span style={{ color: "var(--green)" }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button
                  className="btn btn-primary"
                  style={{ width: "100%", fontSize: 13 }}
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={upgrading === plan.id}
                >
                  {upgrading === plan.id ? "Weiterleitung..." : "Jetzt buchen"}
                </button>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 16, fontSize: 11, color: "var(--muted)" }}>
            Endpreise · gemäß § 19 UStG ohne Umsatzsteuer · Monatlich kündbar · Sichere Zahlung via Stripe
          </p>
        </>
      )}
    </div>
  );
}
