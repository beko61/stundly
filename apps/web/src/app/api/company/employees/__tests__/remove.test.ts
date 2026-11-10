import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../remove/route";

const mockGetContext = vi.fn();
const mockEnd        = vi.fn();
const mockLogAudit   = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/company/admin", () => ({ getCompanyAdminContext: () => mockGetContext() }));
vi.mock("@/lib/company/membership", () => ({ endMembership: (...a: unknown[]) => mockEnd(...a) }));
vi.mock("@/lib/audit/logger", () => ({ logAudit: (...a: unknown[]) => mockLogAudit(...a) }));

const EMP = "11111111-2222-3333-4444-555555555555";
const BOSS = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function ctx(target: unknown) {
  return {
    user: { id: BOSS }, companyId: "co-1", profile: { role: "company_admin", company_id: "co-1" },
    admin: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: target }) }) }) }) },
  };
}
const req = (body: unknown) => new NextRequest("http://l/api/company/employees/remove", {
  method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
});
const employee = { user_id: EMP, company_id: "co-1", role: "employee", full_name: "Max", email: "max@example.com" };

describe("POST /api/company/employees/remove", () => {
  beforeEach(() => { vi.clearAllMocks(); mockEnd.mockResolvedValue({ ok: true }); });

  it("403 ohne Firmen-Admin", async () => {
    mockGetContext.mockResolvedValue(null);
    expect((await POST(req({ userId: EMP }))).status).toBe(403);
  });

  it("400 bei ungültiger ID", async () => {
    mockGetContext.mockResolvedValue(ctx(employee));
    expect((await POST(req({ userId: "x" }))).status).toBe(400);
  });

  it("400 — sich selbst entfernen", async () => {
    mockGetContext.mockResolvedValue(ctx(employee));
    expect((await POST(req({ userId: BOSS }))).status).toBe(400);
    expect(mockEnd).not.toHaveBeenCalled();
  });

  it("404 — andere Firma", async () => {
    mockGetContext.mockResolvedValue(ctx({ ...employee, company_id: "co-2" }));
    expect((await POST(req({ userId: EMP }))).status).toBe(404);
    expect(mockEnd).not.toHaveBeenCalled();
  });

  it("400 — Mit-Admin kann nicht entfernt werden", async () => {
    mockGetContext.mockResolvedValue(ctx({ ...employee, role: "company_admin" }));
    expect((await POST(req({ userId: EMP }))).status).toBe(400);
    expect(mockEnd).not.toHaveBeenCalled();
  });

  it("200 — Austritt + Audit", async () => {
    mockGetContext.mockResolvedValue(ctx(employee));
    const res = await POST(req({ userId: EMP }));
    expect(res.status).toBe(200);
    expect(mockEnd).toHaveBeenCalledWith(expect.anything(), { userId: EMP, companyId: "co-1", actorId: BOSS, reason: "removed" });
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "employee.removed", resourceId: EMP }));
  });

  it("500 wenn der Austritt scheitert", async () => {
    mockGetContext.mockResolvedValue(ctx(employee));
    mockEnd.mockResolvedValue({ ok: false, error: "x" });
    expect((await POST(req({ userId: EMP }))).status).toBe(500);
    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});
