import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { TimeEntry } from "@workly/shared";

const h = vi.hoisted(() => ({ upsert: vi.fn(), update: vi.fn() }));

vi.mock("@/hooks/useSessionUserId", () => ({ useSessionUserId: () => "u1" }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      upsert: (...a: unknown[]) => ({ select: () => ({ single: () => h.upsert(...a) }) }),
      update: (...a: unknown[]) => ({ eq: () => ({ select: () => ({ single: () => h.update(...a) }) }) }),
    }),
  }),
}));

import { useCreateTimeEntry, useUpdateTimeEntry, timeEntriesKey } from "../useTimeEntries";
import { getOutbox } from "@/lib/offline/outbox";

const existing: TimeEntry = {
  id: "e1", user_id: "u1", date: "2026-09-10", start_time: "07:00", end_time: "16:00", break_minutes: 30,
  day_type: "arbeiten", is_night_shift: false, note: null, tags: [], synced_at: null, created_at: "", updated_at: "",
};

function setup() {
  const qc = new QueryClient({ defaultOptions: { mutations: { networkMode: "always" } } });
  qc.setQueryData(timeEntriesKey("u1", 2026, 9), [existing]);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, wrapper };
}

const setOnline = (v: boolean) => Object.defineProperty(navigator, "onLine", { value: v, configurable: true });

describe("useTimeEntries offline", () => {
  beforeEach(() => {
    localStorage.clear();
    h.upsert.mockReset();
    h.update.mockReset();
    setOnline(true);
  });

  it("offline anlegen → Outbox + sofort im Cache, kein Server-Aufruf", async () => {
    setOnline(false);
    const { qc, wrapper } = setup();
    const { result } = renderHook(() => useCreateTimeEntry(), { wrapper });
    const row = { date: "2026-09-11", day_type: "arbeiten" as const, start_time: "06:30", end_time: "15:00", break_minutes: 30, is_night_shift: false, note: "Baustelle", tags: [] };
    let saved: unknown;
    await act(async () => { saved = await result.current.mutateAsync(row); });

    expect(h.upsert).not.toHaveBeenCalled();
    expect(saved).toMatchObject({ ...row, _pending: true, id: "offline-2026-09-11" });
    expect(getOutbox()).toEqual([expect.objectContaining({ kind: "te_upsert", date: "2026-09-11", row })]);
    const cached = qc.getQueryData<TimeEntry[]>(timeEntriesKey("u1", 2026, 9))!;
    expect(cached.map((e) => e.date)).toEqual(["2026-09-10", "2026-09-11"]);
  });

  it("Netzwerkfehler beim Bearbeiten → ganzer Tag in die Outbox (mit alten Feldern)", async () => {
    h.update.mockResolvedValue({ data: null, error: { message: "TypeError: Load failed" } });
    const { qc, wrapper } = setup();
    const { result } = renderHook(() => useUpdateTimeEntry(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ id: "e1", patch: { end_time: "17:00" } }); });

    const [op] = getOutbox();
    expect(op).toMatchObject({ kind: "te_upsert", date: "2026-09-10", row: { start_time: "07:00", end_time: "17:00", break_minutes: 30 } });
    expect(qc.getQueryData<TimeEntry[]>(timeEntriesKey("u1", 2026, 9))![0]).toMatchObject({ id: "e1", end_time: "17:00", _pending: true });
  });

  it("online: normaler Server-Aufruf, keine Outbox", async () => {
    h.upsert.mockResolvedValue({ data: { ...existing, id: "e2", date: "2026-09-12" }, error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => useCreateTimeEntry(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ ...existing, date: "2026-09-12" }); });
    expect(h.upsert).toHaveBeenCalledTimes(1);
    expect(getOutbox()).toEqual([]);
  });

  it("Serverfehler (kein Netzproblem) wird weiter als Fehler gemeldet", async () => {
    h.upsert.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    const { wrapper } = setup();
    const { result } = renderHook(() => useCreateTimeEntry(), { wrapper });
    await expect(act(() => result.current.mutateAsync({ ...existing, date: "2026-09-12" }))).rejects.toThrow("permission denied");
    expect(getOutbox()).toEqual([]);
  });
});
