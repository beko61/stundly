"use client";

/**
 * Gehört der Nutzer als Mitarbeiter zu einer Firma — und hat die Firma Vertragsdaten gesetzt?
 *
 * Query key: ["company_membership", user_id]
 *
 *   isCompanyEmployee → Notdienst-"Bezahlt" setzt die Firma (Migration 033, DB-Trigger)
 *   contract          → Soll-Stunden / Urlaubsanspruch / Beschäftigungsbeginn von der Firma
 *
 * Vertragsspalten getrennt abfragen: vor Migration 033 gibt es sie nicht — dann einfach kein Vertrag.
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useSessionUserId } from "@/hooks/useSessionUserId";
import { contractFromProfile, type Contract } from "@/lib/company/contract";

export interface CompanyMembership {
  isCompanyEmployee: boolean;
  /** Gehört zu irgendeiner Firma (auch als Chef) */
  hasCompany:        boolean;
  contract:          Contract | null;
}

export function useCompanyMembership() {
  const userId = useSessionUserId();
  return useQuery({
    queryKey:  ["company_membership", userId ?? "anon"],
    enabled:   typeof userId === "string",
    staleTime: 5 * 60_000,
    queryFn:   async (): Promise<CompanyMembership> => {
      const supabase = createClient();
      const { data: p, error } = await supabase
        .from("profiles")
        .select("role, company_id")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const isCompanyEmployee = !!p?.company_id && p.role === "employee";
      if (!p?.company_id) return { isCompanyEmployee, hasCompany: false, contract: null };

      const { data: c, error: cErr } = await supabase
        .from("profiles")
        .select("contract_weekly_hours, contract_vacation_days, contract_start")
        .eq("user_id", userId!)
        .maybeSingle();
      return { isCompanyEmployee, hasCompany: true, contract: cErr ? null : contractFromProfile(c as Record<string, unknown> | null) };
    },
  });
}
