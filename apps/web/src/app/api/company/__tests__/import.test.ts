import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../import/route";

const mockGetContext = vi.fn();
const mockApply = vi.fn();
vi.mock("@/lib/company/admin", () => ({ getCompanyAdminContext: () => mockGetContext() }));
vi.mock("@/lib/company/applyCorrection", () => ({ applyCorrection: (...a: unknown[]) => mockApply(...a) }));
vi.mock("@/lib/audit/logger", () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

function ctx(members: string[]) {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "in", "eq"]) c[m] = () => c;
  c.is = () => Promise.resolve({ data: members.map(user_id => ({ user_id })) });
  mockGetContext.mockResolvedValue({ user: { id: "admin" }, companyId: "co-1", admin: { from: () => c } });
}
const req = (rows: unknown) => new NextRequest("http://l/api/company/import", {
  method: "POST", body: JSON.stringify({ rows }), headers: { "Content-Type": "application/json" },
});
const row = (userId: string, date: string, extra: Record<string, unknown> = {}) =>
  ({ userId, date, day_type: "arbeiten", start_time: "07:00", end_time: "15:30", break_minutes: 30, ...extra });

describe("POST /api/company/import", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("403 ohne Firmen-Admin", async () => {
    mockGetContext.mockResolvedValue(null);
    expect((await POST(req([row(U1, "2026-11-03")]))).status).toBe(403);
  });

  it("400 bei Arbeiten ohne Zeiten oder doppelter Person+Tag", async () => {
    ctx([U1]);
    expect((await POST(req([row(U1, "2026-11-03", { start_time: null })]))).status).toBe(400);
    expect((await POST(req([row(U1, "2026-11-03"), row(U1, "2026-11-03")]))).status).toBe(400);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("404 wenn ein Mitarbeiter nicht zur Firma gehört — nichts geschrieben", async () => {
    ctx([U1]);
    expect((await POST(req([row(U1, "2026-11-03"), row(U2, "2026-11-03")]))).status).toBe(404);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("speichert jede Zeile als protokollierte Korrektur, zählt Ergebnisse", async () => {
    ctx([U1, U2]);
    mockApply
      .mockResolvedValueOnce({ ok: true, result: "created" })
      .mockResolvedValueOnce({ ok: true, result: "unchanged" })
      .mockResolvedValueOnce({ ok: true, result: "updated" });
    const res = await POST(req([row(U1, "2026-11-03"), row(U1, "2026-11-04"), row(U2, "2026-11-03", { day_type: "krank", start_time: null, end_time: null, break_minutes: 0 })]));
    expect(await res.json()).toEqual({ ok: true, created: 1, updated: 1, unchanged: 1, failed: 0 });
    expect(mockApply).toHaveBeenCalledTimes(3);
    expect(mockApply.mock.calls[0]![1]).toMatchObject({
      companyId: "co-1", actorId: "admin", userId: U1, date: "2026-11-03",
      reason: "Import aus Stundenzettel-Foto", skipUnchanged: true,
      entry: { day_type: "arbeiten", start_time: "07:00", end_time: "15:30", break_minutes: 30 },
    });
  });
});
