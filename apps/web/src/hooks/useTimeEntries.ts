"use client";

import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTrackerStore } from "@/store/trackerStore";
import type { TimeEntry } from "@workly/shared";

export function useTimeEntries() {
  const { year, month, setEntries, addEntry, updateEntry, deleteEntry, setLoading } =
    useTrackerStore();

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const startDate   = `${year}-${String(month).padStart(2, "0")}-01`;
      const daysInMonth = new Date(year, month, 0).getDate();
      const endDate     = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true });

      if (error) console.error("fetchEntries error:", error.message);
      if (data) setEntries(data as TimeEntry[]);
    } finally {
      setLoading(false);
    }
  }, [year, month, setEntries, setLoading]);

  const create = useCallback(
    async (entry: Omit<TimeEntry, "id" | "user_id" | "created_at" | "updated_at" | "synced_at">) => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return { error: "Not authenticated" };

      const { data, error } = await supabase
        .from("time_entries")
        .upsert({ ...entry, user_id: user.id }, { onConflict: "user_id,date" })
        .select()
        .single();

      if (!error && data) addEntry(data as TimeEntry);
      return { error: error?.message ?? null };
    },
    [addEntry]
  );

  const update = useCallback(
    async (id: string, patch: Partial<TimeEntry>) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("time_entries")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

      if (!error && data) updateEntry(data as TimeEntry);
      return { error: error?.message ?? null };
    },
    [updateEntry]
  );

  const remove = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("time_entries").delete().eq("id", id);
      if (!error) deleteEntry(id);
      return { error: error?.message ?? null };
    },
    [deleteEntry]
  );

  return { fetchEntries, create, update, remove };
}
