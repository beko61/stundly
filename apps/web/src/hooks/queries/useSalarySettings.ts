"use client";

/**
 * React Query wrapper for salary_settings — je Jahr (lib/salary/byYear).
 *
 * Query key: ["salary_settings", user_id] — lädt alle Zeilen des Nutzers (wenige), `select` wählt
 * die Zeile für das gewünschte Jahr (Standard: aktuelles Jahr).
 *
 * Public API:
 *   useSalarySettingsQuery(year?) → { data: Zeile für das Jahr | null, … }
 *   useUpsertSalarySettings()     → mutate({ year, values }) — speichert in die Zeile dieses Jahres,
 *                                    fehlt sie: neue Zeile ab 01.01. (andere Jahre bleiben unverändert)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useSessionUserId } from "@/hooks/useSessionUserId";
import type { SalarySettings } from "@workly/shared";
import { ownRowForYear, rowForYear } from "@/lib/salary/byYear";

export function salarySettingsKey(userId: string | null | undefined) {
  return ["salary_settings", userId ?? "anon"] as const;
}

/** Älterer gespeicherter Cache (Offline-Persistenz) enthielt nur eine Zeile statt einer Liste */
function asRows(v: unknown): SalarySettings[] {
  if (Array.isArray(v)) return v as SalarySettings[];
  return v ? [v as SalarySettings] : [];
}

async function fetchRows(userId: string | null | undefined): Promise<SalarySettings[]> {
  if (!userId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("salary_settings")
    .select("*")
    .eq("user_id", userId)
    .order("valid_from", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SalarySettings[];
}

export function useSalarySettingsQuery(year: number = new Date().getFullYear()) {
  const userId = useSessionUserId();

  return useQuery({
    queryKey: salarySettingsKey(userId),
    enabled:  typeof userId === "string",
    queryFn:  () => fetchRows(userId),
    select: (rows: SalarySettings[]) => rowForYear(asRows(rows), year),
  });
}

/** Alle Zeilen (alle Jahre) — z. B. Überstunden-Übertrag (Vorjahr + dieses Jahr) */
export function useSalarySettingsRows() {
  const userId = useSessionUserId();
  return useQuery({
    queryKey: salarySettingsKey(userId),
    enabled:  typeof userId === "string",
    queryFn:  () => fetchRows(userId),
    select: (rows: SalarySettings[]) => asRows(rows),
  });
}

type UpsertPayload = Partial<Omit<SalarySettings, "id" | "user_id" | "valid_from">>;

export function useUpsertSalarySettings() {
  const qc = useQueryClient();
  const userId = useSessionUserId();

  return useMutation({
    mutationFn: async ({ year, values }: { year: number; values: UpsertPayload }) => {
      if (!userId) throw new Error("Not authenticated");
      const supabase = createClient();

      const { data: rows } = await supabase
        .from("salary_settings")
        .select("id, valid_from, created_at")
        .eq("user_id", userId);
      const own = ownRowForYear((rows ?? []) as { id: string; valid_from: string | null; created_at: string | null }[], year);

      if (own) {
        const { data, error } = await supabase
          .from("salary_settings").update(values).eq("id", own.id).select().single();
        if (error) throw new Error(error.message);
        return data as SalarySettings;
      }

      // Neue Zeile für dieses Jahr — gilt ab 01.01., frühere Jahre behalten ihre Werte
      const { data, error } = await supabase
        .from("salary_settings")
        .insert({ ...values, user_id: userId, valid_from: `${year}-01-01` })
        .select().single();
      if (error) throw new Error(error.message);
      return data as SalarySettings;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salarySettingsKey(userId) });
    },
  });
}
