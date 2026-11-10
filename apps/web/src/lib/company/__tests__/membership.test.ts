import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inRanges, loadMemberAccess, listFormerMembers, endMembership } from "../membership";

/** Kettenbarer Supabase-Mock: jede Abfrage wird protokolliert, `await` liefert resolve(table, ops). */
type Op = { op: string; args: unknown[] };
function fakeAdmin(resolve: (table: string, ops: Op[]) => { data?: unknown; error?: unknown }) {
  const log: { table: string; ops: Op[] }[] = [];
  const admin = {
    from(table: string) {
      const ops: Op[] = [];
      log.push({ table, ops });
      const chain: Record<string, unknown> = {};
      for (const name of ["select", "eq", "in", "is", "not", "gt", "order", "update", "delete"]) {
        chain[name] = (...args: unknown[]) => { ops.push({ op: name, args }); return chain; };
      }
      chain.then = (ok: (v: unknown) => unknown) => Promise.resolve(resolve(table, ops)).then(ok);
      return chain;
    },
  };
  return { admin: admin as unknown as SupabaseClient, log };
}
const has = (ops: Op[], op: string) => ops.some((o) => o.op === op);

describe("inRanges", () => {
  it("offene Grenzen und geschlossene Zeiträume", () => {
    expect(inRanges("2020-01-01", [{ from: null, to: null }])).toBe(true);
    expect(inRanges("2026-11-09", [{ from: "2026-11-10", to: null }])).toBe(false);
    expect(inRanges("2026-11-10", [{ from: "2026-11-10", to: null }])).toBe(true);
    expect(inRanges("2026-11-11", [{ from: null, to: "2026-11-10" }])).toBe(false);
    expect(inRanges("2026-11-10", [{ from: null, to: "2026-11-10" }])).toBe(true);
    expect(inRanges("2026-06-01", [])).toBe(false);
  });
  it("mehrere Mitgliedschaften (Austritt + Wiedereintritt)", () => {
    const r = [{ from: null, to: "2026-03-31" }, { from: "2026-09-01", to: null }];
    expect(inRanges("2026-02-15", r)).toBe(true);
    expect(inRanges("2026-06-15", r)).toBe(false);
    expect(inRanges("2026-10-01", r)).toBe(true);
  });
});

describe("loadMemberAccess", () => {
  it("aktuell + ehemalig, Austrittsdatum", async () => {
    const { admin } = fakeAdmin(() => ({
      data: [
        { user_id: "a", visible_from: null, left_at: null },
        { user_id: "b", visible_from: "2026-01-01", left_at: "2026-05-31" },
        { user_id: "b", visible_from: null, left_at: "2025-12-31" },
      ],
    }));
    const m = await loadMemberAccess(admin, "co", ["a", "b", "c"]);
    expect(m.get("a")).toEqual({ ranges: [{ from: null, to: null }], former: false, leftAt: null });
    expect(m.get("b")?.former).toBe(true);
    expect(m.get("b")?.leftAt).toBe("2026-05-31");
    expect(m.get("b")?.ranges).toHaveLength(2);
    expect(m.has("c")).toBe(false);
  });

  it("Tabelle fehlt (Migration 042 nicht gelaufen) → aktuelle Mitglieder ohne Einschränkung", async () => {
    const { admin } = fakeAdmin((table) => table === "company_memberships"
      ? { error: { message: "relation does not exist" } }
      : { data: [{ user_id: "a" }] });
    const m = await loadMemberAccess(admin, "co", ["a", "x"]);
    expect(m.get("a")).toEqual({ ranges: [{ from: null, to: null }], former: false, leftAt: null });
    expect(m.has("x")).toBe(false);
  });

  it("leere Liste → keine Abfrage", async () => {
    const { admin, log } = fakeAdmin(() => ({ data: [] }));
    expect((await loadMemberAccess(admin, "co", [])).size).toBe(0);
    expect(log).toHaveLength(0);
  });
});

describe("listFormerMembers", () => {
  it("ohne aktuelle Mitglieder, je Nutzer nur der neueste Austritt", async () => {
    const { admin } = fakeAdmin((_t, ops) => has(ops, "not")
      ? { data: [
          { user_id: "b", left_at: "2026-05-31", left_reason: "left" },
          { user_id: "b", left_at: "2025-12-31", left_reason: "removed" },
          { user_id: "a", left_at: "2025-01-31", left_reason: "removed" },
        ] }
      : { data: [{ user_id: "a" }] });   // a ist wieder Mitglied
    expect(await listFormerMembers(admin, "co")).toEqual([{ user_id: "b", left_at: "2026-05-31", left_reason: "left" }]);
  });

  it("Tabelle fehlt → leer", async () => {
    const { admin } = fakeAdmin(() => ({ error: { message: "x" } }));
    expect(await listFormerMembers(admin, "co")).toEqual([]);
  });
});

describe("endMembership", () => {
  it("Profil löst sich von der Firma, Grund wird nachgetragen, künftige Notdienst-Wochen frei", async () => {
    const { admin, log } = fakeAdmin(() => ({ error: null }));
    const res = await endMembership(admin, { userId: "u", companyId: "co", actorId: "boss", reason: "removed" });
    expect(res).toEqual({ ok: true });

    const prof = log.find((l) => l.table === "profiles")!;
    expect(prof.ops.find((o) => o.op === "update")?.args[0]).toEqual({
      company_id: null, role: "individual", contract_weekly_hours: null, contract_vacation_days: null, contract_start: null,
    });
    // nur, wenn noch in DIESER Firma
    expect(prof.ops).toContainEqual({ op: "eq", args: ["company_id", "co"] });

    const mem = log.find((l) => l.table === "company_memberships")!;
    expect(mem.ops.find((o) => o.op === "update")?.args[0]).toEqual({ left_reason: "removed", left_by: "boss" });

    const rota = log.find((l) => l.table === "notdienst_rota")!;
    expect(has(rota.ops, "delete")).toBe(true);
    expect(rota.ops.some((o) => o.op === "gt" && o.args[0] === "week_start")).toBe(true);
  });

  it("Fehler beim Profil → nichts weiter", async () => {
    const { admin, log } = fakeAdmin((t) => (t === "profiles" ? { error: { message: "boom" } } : { error: null }));
    const res = await endMembership(admin, { userId: "u", companyId: "co", actorId: "u", reason: "left" });
    expect(res).toEqual({ ok: false, error: "boom" });
    expect(log.map((l) => l.table)).toEqual(["profiles"]);
  });
});
