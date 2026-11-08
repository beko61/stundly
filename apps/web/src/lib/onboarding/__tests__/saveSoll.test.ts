import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { saveSollFromOnboarding } from "../saveSoll";

/** Minimal-Mock: liest "neueste Zeile", merkt sich insert/update */
function mockClient(existingId: string | null) {
  const calls: { op: string; payload?: unknown; id?: unknown }[] = [];
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({
        maybeSingle: async () => ({ data: existingId ? { id: existingId } : null, error: null }),
      }) }) }) }),
      update: (payload: unknown) => ({
        eq: async (_c: string, id: unknown) => { calls.push({ op: "update", payload, id }); return { error: null }; },
      }),
      insert: async (payload: unknown) => { calls.push({ op: "insert", payload }); return { error: null }; },
    }),
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("saveSollFromOnboarding", () => {
  it("noch keine Lohn-Einstellungen → neue Zeile mit Soll und Stundenlohn 0", async () => {
    const { client, calls } = mockClient(null);
    expect(await saveSollFromOnboarding(client, "u1", 170.08, "2026-11-08")).toEqual({ error: null });
    expect(calls).toEqual([{ op: "insert", payload: {
      user_id: "u1", valid_from: "2026-11-08", monthly_target_hours: 170.08, hourly_rate: 0,
    } }]);
  });

  it("vorhandene Einstellungen → nur Soll ändern, Stundenlohn bleibt", async () => {
    const { client, calls } = mockClient("row-7");
    await saveSollFromOnboarding(client, "u1", 173.33);
    expect(calls).toEqual([{ op: "update", payload: { monthly_target_hours: 173.33 }, id: "row-7" }]);
  });
});
