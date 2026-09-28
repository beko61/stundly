import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  calls: [] as { table: string; op: string; args: unknown[] }[],
  result: vi.fn(),
  session: { user: { id: "u1" } } as unknown,
}));

vi.mock("@/providers/QueryProvider", () => ({ getBrowserQueryClient: () => undefined }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: h.session } }) },
    from: (table: string) => {
      const chain = (op: string, args: unknown[]) => {
        h.calls.push({ table, op, args });
        const res = Promise.resolve().then(() => h.result(table, op));
        return Object.assign(res, { eq: (...a: unknown[]) => { h.calls.push({ table, op: "eq", args: a }); return chain2(res); } });
      };
      const chain2 = (res: Promise<unknown>): unknown =>
        Object.assign(res, { eq: (...a: unknown[]) => { h.calls.push({ table, op: "eq", args: a }); return chain2(res); } });
      return {
        upsert: (...a: unknown[]) => chain("upsert", a),
        update: (...a: unknown[]) => chain("update", a),
        delete: (...a: unknown[]) => chain("delete", a),
      };
    },
  }),
}));

import { flushOutbox } from "../sync";
import { enqueue, getOutbox, getFailed } from "../outbox";

const teRow = (date: string) => ({ date, day_type: "arbeiten" as const, start_time: "07:00", end_time: "16:00", break_minutes: 30, is_night_shift: false, note: null, tags: [] });

describe("flushOutbox", () => {
  beforeEach(() => {
    localStorage.clear();
    h.calls = [];
    h.session = { user: { id: "u1" } };
    h.result.mockReset().mockReturnValue({ error: null });
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });

  it("sendet in Reihenfolge und leert die Outbox", async () => {
    enqueue({ kind: "te_upsert", key: "te:2026-09-01", userId: "u1", date: "2026-09-01", row: teRow("2026-09-01"), at: 1 });
    enqueue({ kind: "nd_upsert", key: "nd:x", userId: "u1", id: "x", isNew: true, row: { date: "2026-09-01", kunde: "K" }, at: 2 });
    enqueue({ kind: "te_delete", key: "te:2026-09-02", userId: "u1", date: "2026-09-02", at: 3 });

    expect(await flushOutbox()).toBe(3);
    expect(getOutbox()).toEqual([]);
    const main = h.calls.filter((c) => c.op !== "eq");
    expect(main.map((c) => `${c.table}.${c.op}`)).toEqual(["time_entries.upsert", "notdienst_entries.upsert", "time_entries.delete"]);
    expect(main[0]!.args).toEqual([{ ...teRow("2026-09-01"), user_id: "u1" }, { onConflict: "user_id,date" }]);
    expect(main[1]!.args[0]).toMatchObject({ id: "x", user_id: "u1", kunde: "K" });
    expect(h.calls.filter((c) => c.op === "eq").map((c) => c.args)).toEqual([["user_id", "u1"], ["date", "2026-09-02"]]);
  });

  it("Netzwerkfehler → abbrechen, alles bleibt in der Outbox", async () => {
    enqueue({ kind: "te_upsert", key: "te:2026-09-01", userId: "u1", date: "2026-09-01", row: teRow("2026-09-01"), at: 1 });
    enqueue({ kind: "te_upsert", key: "te:2026-09-02", userId: "u1", date: "2026-09-02", row: teRow("2026-09-02"), at: 2 });
    h.result.mockReturnValue({ error: { message: "TypeError: Failed to fetch" } });
    expect(await flushOutbox()).toBe(0);
    expect(getOutbox()).toHaveLength(2);
    expect(h.calls.filter((c) => c.op !== "eq")).toHaveLength(1);
  });

  it("Serverfehler → in Fehlerliste, Rest wird trotzdem gesendet", async () => {
    enqueue({ kind: "te_upsert", key: "te:2026-09-01", userId: "u1", date: "2026-09-01", row: teRow("2026-09-01"), at: 1 });
    enqueue({ kind: "te_upsert", key: "te:2026-09-02", userId: "u1", date: "2026-09-02", row: teRow("2026-09-02"), at: 2 });
    h.result.mockReturnValueOnce({ error: { message: "new row violates check constraint" } });
    expect(await flushOutbox()).toBe(1);
    expect(getOutbox()).toEqual([]);
    expect(getFailed()).toEqual([expect.objectContaining({ error: "new row violates check constraint" })]);
  });

  it("offline oder ohne Session → nichts senden", async () => {
    enqueue({ kind: "te_upsert", key: "te:2026-09-01", userId: "u1", date: "2026-09-01", row: teRow("2026-09-01"), at: 1 });
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    expect(await flushOutbox()).toBe(0);
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    h.session = null;
    expect(await flushOutbox()).toBe(0);
    expect(getOutbox()).toHaveLength(1);
    expect(h.calls).toEqual([]);
  });

  it("Änderungen anderer Nutzer bleiben liegen", async () => {
    enqueue({ kind: "te_upsert", key: "te:2026-09-01", userId: "u2", date: "2026-09-01", row: teRow("2026-09-01"), at: 1 });
    expect(await flushOutbox()).toBe(0);
    expect(getOutbox()).toHaveLength(1);
  });
});
