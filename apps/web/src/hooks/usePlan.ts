"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchSubscriptionStatus } from "@/lib/plan/subscriptionStatus";
import { useSessionUserId } from "@/hooks/useSessionUserId";
import {
  PAYWALL_ACTIVE, PAYWALL_PREVIEW_KEY, canTier, ndLimitFor, resolveTier,
  type Feature, type Tier, type TierReason,
} from "@/lib/plan/entitlements";

export interface PlanState {
  tier: Tier;
  reason: TierReason;
  until?: string;
  /** Sperren wirken (Bezahlschranke an oder Super-Admin-Vorschau) */
  active: boolean;
  /** Super-Admin sieht gerade die Basic-Ansicht */
  preview: boolean;
  isSuperAdmin: boolean;
  can: (feature: Feature) => boolean;
  /** Notdienste pro Kalendermonat (Infinity = unbegrenzt) */
  ndLimit: number;
}

/** Tarif des eingeloggten Nutzers. Solange unbekannt oder Schranke aus → alles erlaubt. */
export function usePlan(): PlanState {
  const userId = useSessionUserId();
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    try { setPreview(localStorage.getItem(PAYWALL_PREVIEW_KEY) === "basic"); } catch {}
  }, []);

  const q = useQuery({
    queryKey:  ["plan_info", userId ?? "anon"],
    enabled:   typeof userId === "string",
    staleTime: 5 * 60_000,
    queryFn:   async () => {
      const supabase = createClient();
      const [{ data, error }, subs] = await Promise.all([
        supabase.from("profiles")
          .select("plan, created_at, company_id, is_super_admin")
          .eq("user_id", userId!)
          .maybeSingle(),
        fetchSubscriptionStatus(supabase),
      ]);
      if (error) throw new Error(error.message);
      if (!data) return null;
      return { ...(data as { plan: string | null; created_at: string | null; company_id: string | null; is_super_admin: boolean | null }), subs };
    },
  });

  const info = resolveTier({
    plan: q.data?.plan,
    createdAt: q.data?.created_at,
    hasCompany: !!q.data?.company_id,
    subs: q.data?.subs,
  });
  const tier: Tier = preview ? "basic" : info.tier;
  // Bis die Daten da sind, nichts sperren (kein Aufblitzen von Schlössern)
  const active = preview || (PAYWALL_ACTIVE && !!q.data);

  return {
    tier,
    reason: preview ? "basic" : info.reason,
    ...(info.until && !preview ? { until: info.until } : {}),
    active,
    preview,
    isSuperAdmin: q.data?.is_super_admin === true,
    can: (f) => !active || canTier(tier, f),
    ndLimit: active ? ndLimitFor(tier) : Infinity,
  };
}

/** Super-Admin-Schalter: Basic-Ansicht auf diesem Gerät simulieren */
export function setPaywallPreview(on: boolean) {
  try {
    if (on) localStorage.setItem(PAYWALL_PREVIEW_KEY, "basic");
    else localStorage.removeItem(PAYWALL_PREVIEW_KEY);
  } catch {}
}
