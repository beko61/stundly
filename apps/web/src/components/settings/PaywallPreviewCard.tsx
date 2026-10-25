"use client";

import Link from "next/link";
import { usePlan, setPaywallPreview } from "@/hooks/usePlan";
import { PAYWALL_ACTIVE } from "@/lib/plan/entitlements";

const TIER_TR = { basic: "Basic (ücretsiz)", plus: "Plus", firma: "Firma" } as const;
const REASON_TR = { company: "firma üyesi", paid: "ödeme", beta: "beta", trial: "30 gün deneme", basic: "—" } as const;

/** Nur Super-Admin (Türkçe): Bezahlschranke vorab als Basic-Nutzer ansehen — nur dieses Gerät. */
export function PaywallPreviewCard() {
  const plan = usePlan();
  if (!plan.isSuperAdmin && !plan.preview) return null;

  function toggle(on: boolean) {
    setPaywallPreview(on);
    window.location.reload();
  }

  return (
    <div className="card" style={{ borderColor: "color-mix(in srgb, var(--orange) 40%, transparent)" }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🔒 Ücretli katmanlar (Basic / Plus / Firma)</div>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, lineHeight: 1.5 }}>
        Kilitler şu an {PAYWALL_ACTIVE ? "AÇIK (herkes için)" : "kapalı — herkes her şeyi kullanıyor"}.
        Aşağıdaki anahtar sadece bu cihazda uygulamayı Basic kullanıcısı gibi gösterir.
      </p>
      <div style={{ fontSize: 12, marginBottom: 10 }}>
        Senin katmanın: <strong>{TIER_TR[plan.tier]}</strong>
        {!plan.preview && <> · sebep: {REASON_TR[plan.reason]}{plan.until ? ` · ${plan.until} tarihine kadar` : ""}</>}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={plan.preview} onChange={(e) => toggle(e.target.checked)} />
        Basic görünümünü önizle
      </label>
      {plan.preview && (
        <Link href="/tracker" style={{ display: "inline-block", marginTop: 10, fontSize: 13, color: "var(--accent2)" }}>
          Uygulamada dene → (Notdienst raporu, Urlaub)
        </Link>
      )}
    </div>
  );
}
