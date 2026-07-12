"use client";

/**
 * React Query wrapper for vacation_requests (per-user list).
 *
 * Query key: ["vacation_requests", user_id]
 *
 * Public API:
 *   useVacationRequestsQuery()   → { data, isLoading, error, refetch }
 *   useCreateVacationRequest()   → mutate({ ...request })
 *   useDeleteVacationRequest()   → mutate({ id })
 *   useUpdateVacationRequest()   → mutate({ id, patch })
 *
 * NOT: Vacation-Antrag genellikle time_entries'te "urlaub" day_type olarak
 * eş-zamanlı yaratılır/silinir. Bu hook sadece vacation_requests tablosunu
 * yönetir — caller ayrı olarak time_entries mutation'ı da yürütür.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { VacationRequest } from "@workly/shared";
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

export function vacationRequestsKey(userId: string | null | undefined) {
  return ["vacation_requests", userId ?? "anon"] as const;
}

export function useVacationRequestsQuery() {
  const userId = useSessionUserId();

  return useQuery({
    queryKey: vacationRequestsKey(userId),
    enabled:  typeof userId === "string",
    queryFn:  async (): Promise<VacationRequest[]> => {
      if (!userId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("vacation_requests")
        .select("*")
        .eq("user_id", userId)
        .order("start_date", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as VacationRequest[];
    },
  });
}

/**
 * Create için minimum required alanlar — id/user_id server-side ekleniyor,
 * signature_url/pdf_url/email_sent_at nullable, onay-akışı alanları
 * (approved_at, rejected_at, ...) da server-side set edilir.
 */
type CreatePayload = {
  start_date: string;
  end_date:   string;
  days_count: number;
  reason:     string | null;
  status:     "pending" | "approved" | "rejected";
  urlaub_art?: VacationRequest["urlaub_art"];
  vertretung?: string | null;
};

export function useCreateVacationRequest() {
  const qc = useQueryClient();
  const userId = useSessionUserId();

  return useMutation({
    mutationFn: async (payload: CreatePayload) => {
      if (!userId) throw new Error("Not authenticated");
      const supabase = createClient();
      const { data, error } = await supabase
        .from("vacation_requests")
        .insert({ ...payload, user_id: userId })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as VacationRequest;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vacationRequestsKey(userId) });
    },
  });
}

export function useDeleteVacationRequest() {
  const qc = useQueryClient();
  const userId = useSessionUserId();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const supabase = createClient();
      const { error } = await supabase.from("vacation_requests").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vacationRequestsKey(userId) });
    },
  });
}

export function useUpdateVacationRequest() {
  const qc = useQueryClient();
  const userId = useSessionUserId();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<VacationRequest> }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("vacation_requests")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as VacationRequest;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vacationRequestsKey(userId) });
    },
  });
}
