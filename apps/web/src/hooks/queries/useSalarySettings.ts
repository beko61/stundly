"use client";

/**
 * React Query wrapper for salary_settings — kullanıcının en güncel satırı.
 *
 * Query key: ["salary_settings", user_id]
 *
 * Public API:
 *   useSalarySettingsQuery()  → { data, isLoading, error }
 *   useUpsertSalarySettings() → mutate(payload)
 *
 * NOT: salary_settings tablosunda user başına birden fazla satır olabilir
 * (historic versions). Bu hook `.order("created_at", desc).limit(1)` ile
 * SADECE en güncel satırı çeker. Historic view için ayrı sorgu gerekir.
 *
 * Mutation: upsert değil INSERT strategy — her değişiklik yeni satır yaratır
 * (audit trail için). onSuccess'te invalidate → yeni satır fetch edilir.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { SalarySettings } from "@workly/shared";
import { useEffect, useState } from "react";

function useSessionUserId(): string | null | undefined {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled) setUid(session?.user?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, []);
  return uid;
}

export function salarySettingsKey(userId: string | null | undefined) {
  return ["salary_settings", userId ?? "anon"] as const;
}

export function useSalarySettingsQuery() {
  const userId = useSessionUserId();

  return useQuery({
    queryKey: salarySettingsKey(userId),
    enabled:  typeof userId === "string",
    queryFn:  async (): Promise<SalarySettings | null> => {
      if (!userId) return null;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("salary_settings")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as SalarySettings | null;
    },
  });
}

type UpsertPayload = Partial<Omit<SalarySettings, "id" | "user_id" | "valid_from">>;

export function useUpsertSalarySettings() {
  const qc = useQueryClient();
  const userId = useSessionUserId();

  return useMutation({
    mutationFn: async (payload: UpsertPayload) => {
      if (!userId) throw new Error("Not authenticated");
      const supabase = createClient();

      // Mevcut latest row var mı?
      const { data: existing } = await supabase
        .from("salary_settings")
        .select("id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        // Update existing
        const { data, error } = await supabase
          .from("salary_settings")
          .update(payload)
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        return data as SalarySettings;
      }

      // Insert new
      const { data, error } = await supabase
        .from("salary_settings")
        .insert({
          ...payload,
          user_id: userId,
          valid_from: new Date().toISOString().split("T")[0],
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as SalarySettings;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salarySettingsKey(userId) });
    },
  });
}
