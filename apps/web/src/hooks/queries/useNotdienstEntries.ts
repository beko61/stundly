"use client";

/**
 * React Query wrapper for notdienst_entries — range-based (start, end ISO).
 *
 * Query keys:
 *   ["notdienst_entries", user_id, start, end]
 *
 * NOT: Notdienst entry'leri hem tarih hem hafta bazlı hesaba katıldığı için
 * range-based sorgu esneklik veriyor. Ay bazlı: `notdienstLoadRange(y, m)`
 * ile hafta taşması dahil.
 *
 * Public API:
 *   useNotdienstEntriesQuery(start, end) → { data, isLoading, error }
 *   useCreateNotdienstEntry() → mutate({ date, start_time, end_time, ... })
 *   useDeleteNotdienstEntry() → mutate({ id, date })
 *
 * Not: notdienst mutation'ları invalidate `["notdienst_entries", user_id]`
 * partial prefix ile → o user'ın tüm ranges'ı invalide olur (dedup için ok).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export interface NotdienstEntry {
  id:          string;
  user_id:     string;
  date:        string;
  start_time:  string | null;
  end_time:    string | null;
  erledigt:    boolean | null;
  bezahlt:     boolean | null;
  note:        string | null;
  created_at:  string;
}

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

export function notdienstEntriesKey(userId: string | null | undefined, start: string, end: string) {
  return ["notdienst_entries", userId ?? "anon", start, end] as const;
}

export function notdienstEntriesPrefix(userId: string | null | undefined) {
  return ["notdienst_entries", userId ?? "anon"] as const;
}

export function useNotdienstEntriesQuery(start: string, end: string) {
  const userId = useSessionUserId();

  return useQuery({
    queryKey: notdienstEntriesKey(userId, start, end),
    enabled:  typeof userId === "string" && !!start && !!end,
    queryFn:  async (): Promise<NotdienstEntry[]> => {
      if (!userId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("notdienst_entries")
        .select("*")
        .eq("user_id", userId)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as NotdienstEntry[];
    },
  });
}

type CreatePayload = Omit<NotdienstEntry, "id" | "user_id" | "created_at">;

export function useCreateNotdienstEntry() {
  const qc = useQueryClient();
  const userId = useSessionUserId();

  return useMutation({
    mutationFn: async (payload: CreatePayload) => {
      if (!userId) throw new Error("Not authenticated");
      const supabase = createClient();
      const { data, error } = await supabase
        .from("notdienst_entries")
        .insert({ ...payload, user_id: userId })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as NotdienstEntry;
    },
    onSuccess: () => {
      // Tüm user'ın notdienst range'leri invalide (range'ler örtüşür)
      qc.invalidateQueries({ queryKey: notdienstEntriesPrefix(userId) });
    },
  });
}

export function useDeleteNotdienstEntry() {
  const qc = useQueryClient();
  const userId = useSessionUserId();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const supabase = createClient();
      const { error } = await supabase.from("notdienst_entries").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notdienstEntriesPrefix(userId) });
    },
  });
}
