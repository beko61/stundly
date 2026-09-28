// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

type Call = { table: string; op: string; args: unknown[]; filters: unknown[][] };

const h = vi.hoisted(() => ({
  caller: { id: "me" } as { id: string } | null,
  company: { id: "c1", name: "Muster GmbH" } as Record<string, unknown> | null,
  sub: null as Record<string, unknown> | null,
  members: [] as Record<string, unknown>[],
  calls: [] as Call[],
  deleted: [] as string[],
}));

function builder(table: string) {
  const call: Call = { table, op: "select", args: [], filters: [] };
  const result = () => {
    if (table === "companies" && call.op === "select") return { data: h.company, error: null };
    if (table === "subscriptions") return { data: h.sub, error: null };
    if (table === "profiles" && call.op === "select") return { data: h.members, error: null };
    return { data: null, error: null };
  };
  const b: Record<string, unknown> = {};
  for (const op of ["select", "insert", "update", "delete"]) {
    b[op] = (...args: unknown[]) => {
      call.op = op === "select" && call.op !== "select" ? call.op : op;
      call.args = args;
      if (op !== "select") h.calls.push(call);
      return b;
    };
  }
  for (const f of ["eq", "in", "is", "not"]) b[f] = (...args: unknown[]) => { call.filters.push([f, ...args]); return b; };
  b.maybeSingle = async () => result();
  b.then = (res: (v: unknown) => unknown) => Promise.resolve(result()).then(res);
  return b;
}

vi.mock("@/lib/superadmin/auth", () => ({
  checkSuperAdmin: async () => h.caller,
  adminClient: () => ({
    from: (t: string) => builder(t),
    auth: { admin: { deleteUser: async (id: string) => { h.deleted.push(id); return { error: null }; } } },
  }),
}));

import { DELETE } from "../[id]/route";

const call = (qs: string) =>
  DELETE(new Request(`https://x/api/superadmin/companies/c1?${qs}`, { method: "DELETE" }) as never, { params: Promise.resolve({ id: "c1" }) });

beforeEach(() => {
  h.caller = { id: "me" };
  h.company = { id: "c1", name: "Muster GmbH" };
  h.sub = null;
  h.members = [
    { user_id: "a", email: "chef@x.de", role: "company_admin" },
    { user_id: "b", email: "ma@x.de", role: "employee" },
    { user_id: "sa", email: "boss@stundly.de", role: "super_admin" },
  ];
  h.calls = [];
  h.deleted = [];
});

describe("DELETE /api/superadmin/companies/[id]", () => {
  it("nur Super-Admin", async () => {
    h.caller = null;
    expect((await call("confirm=Muster GmbH")).status).toBe(403);
  });

  it("falscher / fehlender Firmenname → 400, nichts gelöscht", async () => {
    expect((await call("confirm=Muster")).status).toBe(400);
    expect((await call("")).status).toBe(400);
    expect(h.calls).toEqual([]);
  });

  it("aktives Stripe-Abo → 409", async () => {
    h.sub = { status: "active", stripe_subscription_id: "sub_123" };
    expect((await call("confirm=muster gmbh")).status).toBe(409);
    expect(h.calls.find((c) => c.table === "companies" && c.op === "delete")).toBeUndefined();
  });

  it("ohne users=1: Mitglieder werden 'individual', Firma gelöscht, Audit ohne company_id", async () => {
    const res = await call("confirm=Muster%20GmbH");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, deleted_users: 0, detached_users: 3 });
    expect(h.deleted).toEqual([]);
    const roleUpdate = h.calls.find((c) => c.table === "profiles" && c.op === "update" && (c.args[0] as Record<string, unknown>).role === "individual");
    expect(roleUpdate?.filters).toContainEqual(["in", "role", ["employee", "company_admin"]]);
    expect(h.calls.find((c) => c.table === "companies" && c.op === "delete")).toBeTruthy();
    const audit = h.calls.find((c) => c.table === "audit_log");
    expect((audit?.args[0] as Record<string, unknown>).company_id).toBeNull();
  });

  it("mit users=1: Konten gelöscht — nie Super-Admin oder Aufrufer", async () => {
    h.members.push({ user_id: "me", email: "me@x.de", role: "company_admin" });
    const res = await call("confirm=Muster GmbH&users=1");
    expect(await res.json()).toMatchObject({ deleted_users: 2, detached_users: 2 });
    expect(h.deleted.sort()).toEqual(["a", "b"]);
  });
});
