"use client";

/**
 * Fotos + Kundenunterschrift eines Notdienst-Einsatzes (Tabelle notdienst_anhaenge,
 * Migration 029). Nur geladen, wenn ein einzelner Einsatz offen ist.
 *
 * Query key: ["notdienst_anhaenge", notdienstId]
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface NotdienstAnhang {
  id:            string;
  notdienst_id:  string;
  art:           "foto" | "unterschrift";
  data:          string;
  unterzeichner: string | null;
  created_at:    string;
}

export const MAX_FOTOS = 6;

const key = (notdienstId: string | null) => ["notdienst_anhaenge", notdienstId] as const;

export function useNotdienstAnhaenge(notdienstId: string | null) {
  return useQuery({
    queryKey: key(notdienstId),
    enabled:  !!notdienstId,
    queryFn:  async (): Promise<NotdienstAnhang[]> => {
      const { data, error } = await createClient()
        .from("notdienst_anhaenge")
        .select("id, notdienst_id, art, data, unterzeichner, created_at")
        .eq("notdienst_id", notdienstId!)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as NotdienstAnhang[];
    },
  });
}

function useInvalidate(notdienstId: string | null) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: key(notdienstId) });
}

export function useAddFoto(notdienstId: string | null) {
  const invalidate = useInvalidate(notdienstId);
  return useMutation({
    mutationFn: async (data: string) => {
      const { error } = await createClient()
        .from("notdienst_anhaenge")
        .insert({ notdienst_id: notdienstId, art: "foto", data });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteAnhang(notdienstId: string | null) {
  const invalidate = useInvalidate(notdienstId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from("notdienst_anhaenge").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

/** Ersetzt eine vorhandene Unterschrift (max. eine pro Einsatz, Unique-Index). */
export function useSaveUnterschrift(notdienstId: string | null) {
  const invalidate = useInvalidate(notdienstId);
  return useMutation({
    mutationFn: async ({ data, name }: { data: string; name: string }) => {
      const supabase = createClient();
      const { error: delErr } = await supabase
        .from("notdienst_anhaenge")
        .delete()
        .eq("notdienst_id", notdienstId!)
        .eq("art", "unterschrift");
      if (delErr) throw new Error(delErr.message);
      const { error } = await supabase
        .from("notdienst_anhaenge")
        .insert({ notdienst_id: notdienstId, art: "unterschrift", data, unterzeichner: name.trim() || null });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}
