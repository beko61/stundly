"use client";

/**
 * Monatsabschluss + Korrekturen der Firma aus Sicht des Mitarbeiters (Migration 033).
 * RLS: eigene Zeilen lesbar. Schreiben über /api/month/submit und /api/corrections/seen.
 *
 * Query keys: ["month_closings", uid] · ["entry_corrections", uid]
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useSessionUserId } from "@/hooks/useSessionUserId";

export interface MonthClosing {
  year:         number;
  month:        number;
  status:       "submitted" | "approved";
  submitted_at: string | null;
  approved_at:  string | null;
}

export interface EntryCorrection {
  id:         string;
  entry_date: string;
  before:     { day_type?: string; start_time?: string | null; end_time?: string | null; break_minutes?: number | null } | null;
  after:      { day_type?: string; start_time?: string | null; end_time?: string | null; break_minutes?: number | null } | null;
  reason:     string;
  created_at: string;
  seen_at:    string | null;
}

export const monthKey = (year: number, month: number) => `${year}-${month}`;

export function useMonthClosings(enabled: boolean) {
  const uid = useSessionUserId();
  return useQuery({
    queryKey: ["month_closings", uid ?? "anon"],
    enabled:  enabled && typeof uid === "string",
    queryFn:  async (): Promise<Map<string, MonthClosing>> => {
      const { data, error } = await createClient()
        .from("month_closings")
        .select("year, month, status, submitted_at, approved_at")
        .eq("user_id", uid!);
      if (error) throw new Error(error.message);
      return new Map((data ?? []).map((r) => [monthKey(r.year as number, r.month as number), r as MonthClosing]));
    },
  });
}

export function useEntryCorrections(enabled: boolean) {
  const uid = useSessionUserId();
  return useQuery({
    queryKey: ["entry_corrections", uid ?? "anon"],
    enabled:  enabled && typeof uid === "string",
    queryFn:  async (): Promise<EntryCorrection[]> => {
      const { data, error } = await createClient()
        .from("entry_corrections")
        .select("id, entry_date, before, after, reason, created_at, seen_at")
        .eq("user_id", uid!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as EntryCorrection[];
    },
  });
}

/** Eigene Rufbereitschafts-Wochen (Migration 034) — Montage ab dieser Woche. Fehlt die Tabelle → leer. */
export function useMyRota(enabled: boolean, fromMonday: string, toMonday: string) {
  const uid = useSessionUserId();
  return useQuery({
    queryKey: ["notdienst_rota", uid ?? "anon", fromMonday, toMonday],
    enabled:  enabled && typeof uid === "string",
    queryFn:  async (): Promise<string[]> => {
      const { data, error } = await createClient()
        .from("notdienst_rota")
        .select("week_start")
        .eq("user_id", uid!)
        .gte("week_start", fromMonday)
        .lte("week_start", toMonday);
      if (error) return [];
      return (data ?? []).map((r) => r.week_start as string);
    },
  });
}

export function useSubmitMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { year: number; month: number; action: "submit" | "withdraw" }) => {
      const res = await fetch("/api/month/submit", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Fehlgeschlagen");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["month_closings"] }),
  });
}

export function useMarkCorrectionsSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/corrections/seen", { method: "POST" });
      if (!res.ok) throw new Error("Fehlgeschlagen");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["entry_corrections"] }),
  });
}

/** "Arbeiten 07:00–16:00, 30m Pause" / "Urlaub" / "gelöscht" */
export function describeEntry(e: EntryCorrection["after"]): string {
  if (!e) return "kein Eintrag";
  const t = (s?: string | null) => (s ? s.slice(0, 5) : "–");
  const label = (e.day_type ?? "").charAt(0).toUpperCase() + (e.day_type ?? "").slice(1);
  if (e.day_type === "arbeiten") return `${label} ${t(e.start_time)}–${t(e.end_time)}, ${e.break_minutes ?? 0}m Pause`;
  return label;
}
