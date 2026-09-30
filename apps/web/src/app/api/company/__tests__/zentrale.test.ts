import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH as PATCH_SETTINGS } from "../settings/route";
import { POST as POST_ROTA } from "../notdienst-rota/route";

const mockGetContext = vi.fn();
const mockLogAudit = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/company/admin", () => ({ getCompanyAdminContext: () => mockGetContext() }));
vi.mock("@/lib/audit/logger", () => ({ logAudit: (...a: unknown[]) => mockLogAudit(...a) }));

type Call = { table: string; op: string; payload?: unknown; filter?: unknown };

function makeAdmin(members: string[], fail?: string) {
  const calls: Call[] = [];
  const admin = {
    from: (table: string) => ({
      select: () => {
        const chain = { eq: () => chain, is: () => chain, in: () => Promise.resolve({ data: members.map((user_id) => ({ user_id })) }) };
        return chain;
      },
      update: (payload: unknown) => { calls.push({ table, op: "update", payload }); return { eq: () => Promise.resolve({ error: fail ? { message: fail } : null }) }; },
      upsert: (payload: unknown) => { calls.push({ table, op: "upsert", payload }); return Promise.resolve({ error: fail ? { message: fail } : null }); },
      delete: () => {
        const chain = { eq: () => chain, in: (_c: string, v: unknown) => { calls.push({ table, op: "delete", filter: v }); return Promise.resolve({ error: null }); } };
        return chain;
      },
    }),
  };
  return { admin, calls };
}

const ctx = (admin: unknown) => ({ user: { id: "boss" }, profile: {}, companyId: "co-1", admin });
const req = (body: unknown, method = "POST") => new NextRequest("http://l/x", { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";

beforeEach(() => { vi.clearAllMocks(); });

describe("PATCH /api/company/settings", () => {
  it("setzt die Pauschale (auf Cent gerundet)", async () => {
    const { admin, calls } = makeAdmin([]);
    mockGetContext.mockResolvedValue(ctx(admin));
    const res = await PATCH_SETTINGS(req({ notdienst_pauschale: 79.999 }, "PATCH"));
    expect(res.status).toBe(200);
    expect(calls[0]).toEqual({ table: "companies", op: "update", payload: { notdienst_pauschale: 80 } });
  });
  it("400 bei negativem Betrag, 403 ohne Admin", async () => {
    mockGetContext.mockResolvedValue(ctx(makeAdmin([]).admin));
    expect((await PATCH_SETTINGS(req({ notdienst_pauschale: -5 }, "PATCH"))).status).toBe(400);
    mockGetContext.mockResolvedValue(null);
    expect((await PATCH_SETTINGS(req({ notdienst_pauschale: 5 }, "PATCH"))).status).toBe(403);
  });
  it("verständliche Meldung ohne Migration 034", async () => {
    mockGetContext.mockResolvedValue(ctx(makeAdmin([], 'column "notdienst_pauschale" does not exist').admin));
    const res = await PATCH_SETTINGS(req({ notdienst_pauschale: 80 }, "PATCH"));
    expect((await res.json()).error).toMatch(/Migration 034/);
  });
});

describe("POST /api/company/notdienst-rota", () => {
  it("nur Montage", async () => {
    mockGetContext.mockResolvedValue(ctx(makeAdmin([A]).admin));
    expect((await POST_ROTA(req({ assignments: [{ week_start: "2026-10-06", user_id: A }] }))).status).toBe(400);
  });
  it("404 für fremde Mitarbeiter", async () => {
    mockGetContext.mockResolvedValue(ctx(makeAdmin([A]).admin));
    expect((await POST_ROTA(req({ assignments: [{ week_start: "2026-10-05", user_id: B }] }))).status).toBe(404);
  });
  it("setzt und leert Wochen in einem Aufruf", async () => {
    const { admin, calls } = makeAdmin([A, B]);
    mockGetContext.mockResolvedValue(ctx(admin));
    const res = await POST_ROTA(req({ assignments: [
      { week_start: "2026-10-05", user_id: A }, { week_start: "2026-10-12", user_id: B }, { week_start: "2026-10-19", user_id: null },
    ] }));
    expect(res.status).toBe(200);
    expect(calls[0]).toEqual({ table: "notdienst_rota", op: "upsert", payload: [
      { company_id: "co-1", week_start: "2026-10-05", user_id: A },
      { company_id: "co-1", week_start: "2026-10-12", user_id: B },
    ] });
    expect(calls[1]).toEqual({ table: "notdienst_rota", op: "delete", filter: ["2026-10-19"] });
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "notdienst.rota_updated" }));
  });
});
