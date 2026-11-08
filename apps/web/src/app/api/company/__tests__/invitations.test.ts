import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../invitations/route";

const mockGetContext = vi.fn();
vi.mock("@/lib/company/admin", () => ({ getCompanyAdminContext: () => mockGetContext() }));
vi.mock("@/lib/audit/logger", () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/rateLimit/check", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, count: 1, limit: 100, retryAfterSec: 0 }),
}));

type Inv = { id: string; token: string; status: string; expires_at: string } | null;

function ctx(opts: { member?: boolean; existing?: Inv }) {
  const writes: { op: string; payload: Record<string, unknown> }[] = [];
  const chain = (result: unknown) => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "ilike", "is"]) c[m] = () => c;
    c.maybeSingle = () => Promise.resolve({ data: result });
    return c;
  };
  const admin = {
    from: (table: string) => {
      if (table === "profiles") return chain(opts.member ? { user_id: "u-2" } : null);
      if (table === "invitations") return {
        ...chain(opts.existing ?? null),
        insert: (payload: Record<string, unknown>) => { writes.push({ op: "insert", payload }); return Promise.resolve({ error: null }); },
        update: (payload: Record<string, unknown>) => {
          writes.push({ op: "update", payload });
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
      throw new Error("Unexpected table " + table);
    },
  };
  mockGetContext.mockResolvedValue({ user: { id: "admin-1" }, companyId: "co-1", admin });
  return writes;
}

const req = (body: unknown) => new NextRequest("http://l/api/company/invitations", {
  method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
});
const future = new Date(Date.now() + 86_400_000).toISOString();
const past   = new Date(Date.now() - 86_400_000).toISOString();

describe("POST /api/company/invitations", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("403 ohne Firmen-Admin", async () => {
    mockGetContext.mockResolvedValue(null);
    expect((await POST(req({ email: "a@b.de" }))).status).toBe(403);
  });

  it("400 bei ungültiger E-Mail", async () => {
    ctx({});
    expect((await POST(req({ email: "kein-email" }))).status).toBe(400);
  });

  it("409 wenn schon im Team (Admin kann sich nicht selbst herabstufen)", async () => {
    const writes = ctx({ member: true });
    const res = await POST(req({ email: "Admin@Firma.de" }));
    expect(res.status).toBe(409);
    expect(writes).toHaveLength(0);
  });

  it("neue Einladung: Token + Insert als employee, E-Mail kleingeschrieben", async () => {
    const writes = ctx({});
    const res = await POST(req({ email: " Max@Example.de " }));
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(j.token).toMatch(/^[0-9a-f]{64}$/);
    expect(writes).toEqual([{ op: "insert", payload: expect.objectContaining({
      company_id: "co-1", email: "max@example.de", role: "employee", token: j.token, invited_by: "admin-1",
    }) }]);
  });

  it("offene gültige Einladung → derselbe Token, nichts geschrieben", async () => {
    const writes = ctx({ existing: { id: "i-1", token: "abc", status: "pending", expires_at: future } });
    const j = await (await POST(req({ email: "max@example.de" }))).json();
    expect(j.token).toBe("abc");
    expect(writes).toHaveLength(0);
  });

  it("abgelaufene/widerrufene Einladung → neu ausgestellt (neuer Token, pending)", async () => {
    for (const existing of [
      { id: "i-1", token: "old", status: "pending", expires_at: past },
      { id: "i-1", token: "old", status: "revoked", expires_at: future },
    ]) {
      const writes = ctx({ existing });
      const j = await (await POST(req({ email: "max@example.de" }))).json();
      expect(j.token).not.toBe("old");
      expect(writes[0]).toMatchObject({ op: "update", payload: { status: "pending", token: j.token, accepted_at: null } });
    }
  });
});
