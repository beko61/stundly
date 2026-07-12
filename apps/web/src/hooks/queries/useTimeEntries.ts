"use client";

/**
 * React Query wrapper for time_entries table (per-user, per-month).
 *
 * Query keys:
 *   ["time_entries", user_id, year, month]        — single-month read
 *
 * Public API:
 *   useTimeEntriesQuery(year, month) → { data, isLoading, error, refetch }
 *   useCreateTimeEntry()  → mutate(entry)
 *   useUpdateTimeEntry()  → mutate({ id, patch })
 *   useDeleteTimeEntry()  → mutate(id)
 *
 * Mutations invalidate cache automatically → sonraki useQuery fresh fetch.
 *
 * NOT: user_id session'dan alınır. Session yoksa useQuery `enabled: false`
 * ile idle kalır ve boş array döner.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { TimeEntry } from "@workly/shared";
import { useEffect, useState } from "react";

// ── Utility: current user id (client-side session) ───────────────────────────
function useSessionUserId(): string | null | undefined {
  // undefined  → henüz belirlenmedi (loading)
  // null       → session yok (unauthenticated)
  // string     → user id
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

export function timeEntriesKey(userId: string | null | undefined, year: number, month: number) {
  return ["time_entries", userId ?? "anon", year, month] as const;
}

// ── Query: month range read ───────────────────────────────────────────────────
export function useTimeEntriesQuery(year: number, month: number) {
  const userId = useSessionUserId();

  return useQuery({
    queryKey: timeEntriesKey(userId, year, month),
    enabled:  typeof userId === "string",
    queryFn:  async (): Promise<TimeEntry[]> => {
      if (!userId) return [];
      const supabase   = createClient();
      const startDate  = `${year}-${String(month).padStart(2, "0")}-01`;
      const daysIn     = new Date(year, month, 0).getDate();
      const endDate    = `${year}-${String(month).padStart(2, "0")}-${String(daysIn).padStart(2, "0")}`;

      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", userId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as TimeEntry[];
    },
  });
}

// ── Mutation: create (upsert on conflict user_id,date) ────────────────────────
type CreatePayload = Omit<TimeEntry, "id" | "user_id" | "created_at" | "updated_at" | "synced_at">;

export function useCreateTimeEntry() {
  const qc = useQueryClient();
  const userId = useSessionUserId();

  return useMutation({
    mutationFn: async (entry: CreatePayload) => {
      if (!userId) throw new Error("Not authenticated");
      const supabase = createClient();
      const { data, error } = await supabase
        .from("time_entries")
        .upsert({ ...entry, user_id: userId }, { onConflict: "user_id,date" })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as TimeEntry;
    },
    onSuccess: (created) => {
      // Ay/yıl'ı date'den çıkar → sadece o ay'ın query'sini invalide et
      const [y, m] = created.date.split("-").map(Number);
      if (y && m) qc.invalidateQueries({ queryKey: timeEntriesKey(userId, y, m) });
    },
  });
}

// ── Mutation: update by id ────────────────────────────────────────────────────
export function useUpdateTimeEntry() {
  const qc = useQueryClient();
  const userId = useSessionUserId();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TimeEntry> }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("time_entries")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as TimeEntry;
    },
    onSuccess: (updated) => {
      const [y, m] = updated.date.split("-").map(Number);
      if (y && m) qc.invalidateQueries({ queryKey: timeEntriesKey(userId, y, m) });
    },
  });
}

// ── Mutation: delete by id ────────────────────────────────────────────────────
// date bilgisi id'de yok — silinen row cache'te tespit edilir ve o ay invalide.
export function useDeleteTimeEntry() {
  const qc = useQueryClient();
  const userId = useSessionUserId();

  return useMutation({
    mutationFn: async ({ id, date }: { id: string; date: string }) => {
      const supabase = createClient();
      const { error } = await supabase.from("time_entries").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return { id, date };
    },
    onSuccess: ({ date }) => {
      const [y, m] = date.split("-").map(Number);
      if (y && m) qc.invalidateQueries({ queryKey: timeEntriesKey(userId, y, m) });
    },
  });
}
