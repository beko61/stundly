import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as POST_DELETE  } from "../delete/route";
import { POST as POST_RESTORE } from "../restore/route";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockGetContext = vi.fn();
const mockLogAudit   = vi.fn().mockResolvedValue(undefined);
const mockUpdate     = vi.fn();

vi.mock("@/lib/company/admin", () => ({
  getCompanyAdminContext: () => mockGetContext(),
}));
vi.mock("@/lib/audit/logger", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));
// Rate limit her testte allowed:true (env yok, gerçek DB'ye gitmesin)
vi.mock("@/lib/rateLimit/check", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, count: 1, limit: 100, retryAfterSec: 0 }),
}));

function makeAdminClient(opts: {
  profile: unknown;
  updateError?: { message: string } | null;
}) {
  return {
    from: (table: string) => {
      if (table !== "profiles") throw new Error("Unexpected table: " + table);
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: opts.profile }),
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          mockUpdate(payload);
          return { eq: () => Promise.resolve({ error: opts.updateError ?? null }) };
        },
      };
    },
  };
}

const ACTIVE_PROFILE = {
  user_id:    "11111111-2222-3333-4444-555555555555",
  company_id: "co-1",
  role:       "employee",
  full_name:  "Max Mustermann",
  email:      "max@example.com",
  deleted_at: null,
};
const DELETED_PROFILE = { ...ACTIVE_PROFILE, deleted_at: "2026-06-01T10:00:00Z" };

function ctxAdmin(opts: { profile?: unknown; updateError?: { message: string } | null } = {}) {
  return {
    user: { id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" },
    profile: { full_name: "Anna Admin", role: "company_admin", company_id: "co-1" },
    companyId: "co-1",
    admin: makeAdminClient({
      profile: opts.profile !== undefined ? opts.profile : ACTIVE_PROFILE,
      updateError: opts.updateError ?? null,
    }),
  };
}

function makeReq(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ── Tests: DELETE ──────────────────────────────────────────────────────────
describe("POST /api/company/employees/delete", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("403 — admin değil", async () => {
    mockGetContext.mockResolvedValue(null);
    const res = await POST_DELETE(makeReq("http://l/api/company/employees/delete", { userId: "11111111-2222-3333-4444-555555555555" }));
    expect(res.status).toBe(403);
  });

  it("400 — userId yok", async () => {
    mockGetContext.mockResolvedValue(ctxAdmin());
    const res = await POST_DELETE(makeReq("http://l/api/company/employees/delete", {}));
    expect(res.status).toBe(400);
  });

  it("404 — Mitarbeiter yok", async () => {
    mockGetContext.mockResolvedValue(ctxAdmin({ profile: null }));
    const res = await POST_DELETE(makeReq("http://l/api/company/employees/delete", { userId: "99999999-9999-4999-8999-999999999999" }));
    expect(res.status).toBe(404);
  });

  it("404 — cross-company", async () => {
    mockGetContext.mockResolvedValue(ctxAdmin({
      profile: { ...ACTIVE_PROFILE, company_id: "co-2" },
    }));
    const res = await POST_DELETE(makeReq("http://l/api/company/employees/delete", { userId: "11111111-2222-3333-4444-555555555555" }));
    expect(res.status).toBe(404);
  });

  it("400 — admin kendi kendini silemez", async () => {
    mockGetContext.mockResolvedValue(ctxAdmin({
      profile: { ...ACTIVE_PROFILE, user_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" },
    }));
    const res = await POST_DELETE(makeReq("http://l/api/company/employees/delete", { userId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }));
    expect(res.status).toBe(400);
  });

  it("409 — zaten silinmiş", async () => {
    mockGetContext.mockResolvedValue(ctxAdmin({ profile: DELETED_PROFILE }));
    const res = await POST_DELETE(makeReq("http://l/api/company/employees/delete", { userId: "11111111-2222-3333-4444-555555555555" }));
    expect(res.status).toBe(409);
  });

  it("200 — başarılı: deleted_at + is_active=false set, audit log atılır", async () => {
    mockGetContext.mockResolvedValue(ctxAdmin());
    const res = await POST_DELETE(makeReq("http://l/api/company/employees/delete", { userId: "11111111-2222-3333-4444-555555555555" }));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      deleted_by: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      is_active:  false,
    }));
    expect(mockUpdate.mock.calls[0]?.[0]).toHaveProperty("deleted_at");
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "employee.soft_deleted",
      resourceId: "11111111-2222-3333-4444-555555555555",
    }));
  });

  it("500 — DB update hatasında audit log atılmaz", async () => {
    mockGetContext.mockResolvedValue(ctxAdmin({ updateError: { message: "rls" } }));
    const res = await POST_DELETE(makeReq("http://l/api/company/employees/delete", { userId: "11111111-2222-3333-4444-555555555555" }));
    expect(res.status).toBe(500);
    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});

// ── Tests: RESTORE ─────────────────────────────────────────────────────────
describe("POST /api/company/employees/restore", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("403 — admin değil", async () => {
    mockGetContext.mockResolvedValue(null);
    const res = await POST_RESTORE(makeReq("http://l/api/company/employees/restore", { userId: "11111111-2222-3333-4444-555555555555" }));
    expect(res.status).toBe(403);
  });

  it("400 — userId yok", async () => {
    mockGetContext.mockResolvedValue(ctxAdmin());
    const res = await POST_RESTORE(makeReq("http://l/api/company/employees/restore", {}));
    expect(res.status).toBe(400);
  });

  it("404 — cross-company", async () => {
    mockGetContext.mockResolvedValue(ctxAdmin({
      profile: { ...DELETED_PROFILE, company_id: "co-2" },
    }));
    const res = await POST_RESTORE(makeReq("http://l/api/company/employees/restore", { userId: "11111111-2222-3333-4444-555555555555" }));
    expect(res.status).toBe(404);
  });

  it("409 — Mitarbeiter zaten aktif", async () => {
    mockGetContext.mockResolvedValue(ctxAdmin({ profile: ACTIVE_PROFILE }));
    const res = await POST_RESTORE(makeReq("http://l/api/company/employees/restore", { userId: "11111111-2222-3333-4444-555555555555" }));
    expect(res.status).toBe(409);
  });

  it("200 — başarılı: deleted_at=null, is_active=true, audit log", async () => {
    mockGetContext.mockResolvedValue(ctxAdmin({ profile: DELETED_PROFILE }));
    const res = await POST_RESTORE(makeReq("http://l/api/company/employees/restore", { userId: "11111111-2222-3333-4444-555555555555" }));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({
      deleted_at: null,
      deleted_by: null,
      is_active:  true,
    });
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "employee.restored",
    }));
  });
});
