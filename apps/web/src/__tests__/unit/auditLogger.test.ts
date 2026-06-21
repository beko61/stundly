import { describe, it, expect, vi, beforeEach } from "vitest";
import { logAudit } from "@/lib/audit/logger";

function makeAdmin(insertResult: { error: { message: string } | null } = { error: null }) {
  const insertMock = vi.fn().mockResolvedValue(insertResult);
  const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
  return {
    admin: { from: fromMock } as unknown as Parameters<typeof logAudit>[0]["admin"],
    insertMock,
    fromMock,
  };
}

describe("logAudit", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("audit_log tablosuna doğru satırı insert eder", async () => {
    const { admin, insertMock, fromMock } = makeAdmin();
    await logAudit({
      admin,
      actorUserId:  "user-1",
      companyId:    "co-1",
      action:       "vacation.approved",
      resourceType: "vacation_request",
      resourceId:   "vac-42",
      payload:      { start_date: "2026-06-15" },
    });
    expect(fromMock).toHaveBeenCalledWith("audit_log");
    expect(insertMock).toHaveBeenCalledWith({
      actor_user_id: "user-1",
      company_id:    "co-1",
      action:        "vacation.approved",
      resource_type: "vacation_request",
      resource_id:   "vac-42",
      payload:       { start_date: "2026-06-15" },
    });
  });

  it("opsiyonel alanlar yoksa null/empty default ile yazılır", async () => {
    const { admin, insertMock } = makeAdmin();
    await logAudit({
      admin,
      actorUserId: "user-1",
      companyId:   "co-1",
      action:      "test.action",
    });
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      resource_type: null,
      resource_id:   null,
      payload:       {},
    }));
  });

  it("DB hatasında throw etmez (fire-and-forget)", async () => {
    const { admin } = makeAdmin({ error: { message: "rls denied" } });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(logAudit({
      admin, actorUserId: "u", companyId: "c", action: "x",
    })).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("exception fırlatıldığında bile yutar", async () => {
    const admin = {
      from: () => { throw new Error("client broken"); },
    } as unknown as Parameters<typeof logAudit>[0]["admin"];
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(logAudit({
      admin, actorUserId: "u", companyId: "c", action: "x",
    })).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
