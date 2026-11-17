"use client";

import type { PaidPlanId } from "@/lib/pricing";

/**
 * Kauf aus der App starten (Plus-Fenster, Firmen-Abo, /pricing) — eine Stelle für alle.
 * Leitet bei Erfolg zu Stripe weiter; sonst kommt die Meldung des Servers zurück
 * (z. B. während der Beta: "komplett kostenlos …", oder nicht angemeldet).
 */
export async function startCheckout(plan: PaidPlanId, interval: "monthly" | "yearly" = "monthly"): Promise<string | null> {
  try {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, interval }),
    });
    if (res.status === 401) {
      window.location.href = "/login?next=/pricing";
      return null;
    }
    const data = await res.json().catch(() => ({})) as { url?: string; error?: string };
    if (res.ok && data.url) {
      window.location.href = data.url;
      return null;
    }
    return data.error ?? "Kauf konnte nicht gestartet werden. Bitte später erneut versuchen.";
  } catch {
    return "Keine Verbindung — bitte mit Internet erneut versuchen.";
  }
}
