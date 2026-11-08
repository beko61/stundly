import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

import { parseStandardTimes, saveStandardTimes, syncStandardTimes } from "@/lib/utils/standardTimesSync";
import { getStandardTimes, STANDARD_TIMES_LS_KEY, DEFAULT_STANDARD_TIMES } from "@/lib/utils/standardTimes";

const MINE = { monThuStart: "06:30", monThuEnd: "15:00", monThuPause: 30, friStart: "06:30", friEnd: "12:00", friPause: 0 };

/** Mock: Profil-Wert lesen, Updates merken */
function mockClient(dbValue: unknown, userId: string | null = "u1") {
  const updates: unknown[] = [];
  const client = {
    auth: { getSession: async () => ({ data: { session: userId ? { user: { id: userId } } : null } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { standard_times: dbValue }, error: null }) }) }),
      update: (payload: unknown) => ({ eq: async () => { updates.push(payload); return { error: null }; } }),
    }),
  } as unknown as SupabaseClient;
  return { client, updates };
}

beforeEach(() => localStorage.clear());

describe("parseStandardTimes", () => {
  it("vollständig + gültig → übernehmen; sonst null", () => {
    expect(parseStandardTimes(MINE)).toEqual(MINE);
    expect(parseStandardTimes(null)).toBeNull();
    expect(parseStandardTimes({ ...MINE, friEnd: "12" })).toBeNull();
    expect(parseStandardTimes({ ...MINE, friPause: "30" })).toBeNull();
  });
});

describe("syncStandardTimes", () => {
  it("Profil hat Zeiten → aufs Gerät (anderes Gerät eingestellt)", async () => {
    const { client, updates } = mockClient(MINE);
    expect(await syncStandardTimes(client)).toBe("pulled");
    expect(getStandardTimes()).toEqual(MINE);
    expect(updates).toEqual([]);
  });

  it("Profil leer, Gerät hat eigene Zeiten → hochladen (nichts geht verloren)", async () => {
    localStorage.setItem(STANDARD_TIMES_LS_KEY, JSON.stringify(MINE));
    const { client, updates } = mockClient(null);
    expect(await syncStandardTimes(client)).toBe("pushed");
    expect(updates).toEqual([{ standard_times: MINE }]);
  });

  it("beides leer → nichts tun (Standardwerte)", async () => {
    const { client, updates } = mockClient(null);
    expect(await syncStandardTimes(client)).toBe("none");
    expect(updates).toEqual([]);
    expect(getStandardTimes()).toEqual(DEFAULT_STANDARD_TIMES);
  });
});

describe("saveStandardTimes", () => {
  it("Gerät + Profil", async () => {
    const { client, updates } = mockClient(null);
    expect(await saveStandardTimes(MINE, client)).toEqual({ error: null });
    expect(getStandardTimes()).toEqual(MINE);
    expect(updates).toEqual([{ standard_times: MINE }]);
  });
});
