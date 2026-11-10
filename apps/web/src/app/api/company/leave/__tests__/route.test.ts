import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";

const h = vi.hoisted(() => ({
  user:    null as { id: string } | null,
  profile: null as Record<string, unknown> | null,
  end:     vi.fn(),
  audit:   vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.profile }) }) }) }),
  }),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/company/membership", () => ({ endMembership: (...a: unknown[]) => h.end(...a) }));
vi.mock("@/lib/audit/logger", () => ({ logAudit: (...a: unknown[]) => h.audit(...a) }));

describe("POST /api/company/leave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.user = { id: "u1" };
    h.profile = { role: "employee", company_id: "co-1", full_name: "Max", email: "m@x.de" };
    h.end.mockResolvedValue({ ok: true });
    h.audit.mockResolvedValue(undefined);
  });

  it("401 ohne Anmeldung", async () => {
    h.user = null;
    expect((await POST()).status).toBe(401);
  });

  it("400 ohne Firma", async () => {
    h.profile = { role: "individual", company_id: null };
    expect((await POST()).status).toBe(400);
    expect(h.end).not.toHaveBeenCalled();
  });

  it("400 für Inhaber", async () => {
    h.profile = { role: "company_admin", company_id: "co-1" };
    expect((await POST()).status).toBe(400);
    expect(h.end).not.toHaveBeenCalled();
  });

  it("200 — Mitarbeiter tritt selbst aus", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(h.end).toHaveBeenCalledWith(expect.anything(), { userId: "u1", companyId: "co-1", actorId: "u1", reason: "left" });
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "employee.left", companyId: "co-1" }));
  });

  it("500 wenn der Austritt scheitert", async () => {
    h.end.mockResolvedValue({ ok: false, error: "x" });
    expect((await POST()).status).toBe(500);
  });
});
