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
import { useSessionUserId } from "@/hooks/useSessionUserId";
import { hasPending } from "@/lib/offline/outbox";
import { isNetworkError, isOffline } from "@/lib/offline/network";
import {
  findCachedTimeEntry, offlineDeleteTimeEntry, offlineUpsertTimeEntry, toRow, type MaybePending,
} from "@/lib/offline/timeEntries";
import type { TimeEntry } from "@workly/shared";


export function timeEntriesKey(userId: string | null | undefined, year: number, month: number) {
  return ["time_entries", userId ?? "anon", year, month] as const;
}

export function timeEntriesRangeKey(userId: string | null | undefined, start: string, end: string) {
  return ["time_entries_range", userId ?? "anon", start, end] as const;
}

export function timeEntriesPrefix(userId: string | null | undefined) {
  return ["time_entries", userId ?? "anon"] as const;
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

// ── Query: arbitrary date range (yıllık, YTD, last-7 vb.) ────────────────────
export function useTimeEntriesRangeQuery(start: string, end: string) {
  const userId = useSessionUserId();

  return useQuery({
    queryKey: timeEntriesRangeKey(userId, start, end),
    enabled:  typeof userId === "string" && !!start && !!end,
    queryFn:  async (): Promise<TimeEntry[]> => {
      if (!userId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", userId)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as TimeEntry[];
    },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────
// Offline-fähig: ohne Netz (oder bei Netzwerkfehler, oder wenn für den Tag schon eine
// Änderung in der Outbox wartet → Reihenfolge) landet die Änderung in der Offline-Outbox
// (lib/offline) und erscheint sofort im Cache mit `_pending`. OfflineSync sendet sie später.
type CreatePayload = Omit<TimeEntry, "id" | "user_id" | "created_at" | "updated_at" | "synced_at">;

/** Supabase-Aufruf; Netzwerkfehler → "network" statt Exception. */
async function tryOnline<T>(fn: () => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T | "network"> {
  try {
    const { data, error } = await fn();
    if (error) {
      if (isNetworkError(error)) return "network";
      throw new Error(error.message);
    }
    return data as T;
  } catch (e) {
    if (isNetworkError(e)) return "network";
    throw e;
  }
}

function useInvalidateAfterWrite() {
  const qc = useQueryClient();
  return (userId: string | null | undefined, entry: { date: string; _pending?: boolean }) => {
    if (entry._pending) return; // offline: Cache ist schon aktuell, Refetch würde ihn überschreiben
    const [y, m] = entry.date.split("-").map(Number);
    if (y && m) void qc.invalidateQueries({ queryKey: timeEntriesKey(userId, y, m) });
    void qc.invalidateQueries({ queryKey: ["time_entries_range", userId ?? "anon"] });
  };
}

export function useCreateTimeEntry() {
  const qc = useQueryClient();
  const userId = useSessionUserId();
  const invalidate = useInvalidateAfterWrite();

  return useMutation({
    mutationFn: async (entry: CreatePayload): Promise<MaybePending<TimeEntry>> => {
      if (!userId) throw new Error("Not authenticated");
      const offline = () => offlineUpsertTimeEntry(qc, userId, toRow(entry));
      if (isOffline() || hasPending(`te:${entry.date}`)) return offline();
      const res = await tryOnline<TimeEntry>(() => createClient()
        .from("time_entries")
        .upsert({ ...entry, user_id: userId }, { onConflict: "user_id,date" })
        .select()
        .single());
      return res === "network" ? offline() : res;
    },
    onSuccess: (created) => invalidate(userId, created),
  });
}

export function useUpdateTimeEntry() {
  const qc = useQueryClient();
  const userId = useSessionUserId();
  const invalidate = useInvalidateAfterWrite();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TimeEntry> }): Promise<MaybePending<TimeEntry>> => {
      const cached = userId ? findCachedTimeEntry(qc, userId, id) : null;
      const offline = () => {
        if (!userId || !cached) throw new Error("Offline — Eintrag konnte nicht zwischengespeichert werden.");
        return offlineUpsertTimeEntry(qc, userId, toRow({ ...cached, ...patch }));
      };
      if (isOffline() || id.startsWith("offline-") || (cached && hasPending(`te:${cached.date}`))) return offline();
      const res = await tryOnline<TimeEntry>(() => createClient()
        .from("time_entries")
        .update(patch)
        .eq("id", id)
        .select()
        .single());
      return res === "network" ? offline() : res;
    },
    onSuccess: (updated) => invalidate(userId, updated),
  });
}

// date bilgisi id'de yok — çağıran verir, o ay invalide.
export function useDeleteTimeEntry() {
  const qc = useQueryClient();
  const userId = useSessionUserId();
  const invalidate = useInvalidateAfterWrite();

  return useMutation({
    mutationFn: async ({ id, date }: { id: string; date: string }) => {
      const offline = () => {
        if (!userId) throw new Error("Not authenticated");
        offlineDeleteTimeEntry(qc, userId, date);
        return { id, date, _pending: true };
      };
      if (isOffline() || id.startsWith("offline-") || hasPending(`te:${date}`)) return offline();
      const res = await tryOnline<null>(() => createClient().from("time_entries").delete().eq("id", id));
      return res === "network" ? offline() : { id, date };
    },
    onSuccess: (deleted) => invalidate(userId, deleted),
  });
}
