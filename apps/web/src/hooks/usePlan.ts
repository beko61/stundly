"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
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
      const { data, error } = await createClient()
        .from("profiles")
        .select("plan, created_at, company_id, role")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as { plan: string | null; created_at: string | null; company_id: string | null; role: string | null } | null;
    },
  });

  const info = resolveTier({
    plan: q.data?.plan,
    createdAt: q.data?.created_at,
    hasCompany: !!q.data?.company_id,
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
    isSuperAdmin: q.data?.role === "super_admin",
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
