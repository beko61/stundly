import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH as PATCH_CONTRACT } from "../employees/[userId]/contract/route";
import { PATCH as PATCH_ND } from "../notdienst/[id]/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockGetContext = vi.fn();
const mockGetMember  = vi.fn();
const mockLogAudit   = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/company/admin", () => ({
  getCompanyAdminContext: () => mockGetContext(),
  getTeamMember: (...a: unknown[]) => mockGetMember(...a),
}));
vi.mock("@/lib/audit/logger", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

type Call = { table: string; op: "update" | "insert"; payload: Record<string, unknown> };

/** Minimaler Supabase-Admin-Fake: zeichnet update/insert auf, liefert feste Select-Ergebnisse. */
function makeAdmin(opts: {
  salaryRows?: { id: string }[];
  nd?: Record<string, unknown> | null;
  profileError?: { message: string } | null;
}) {
  const calls: Call[] = [];
  const admin = {
    from: (table: string) => ({
      select: () => {
        const chain = {
          eq: () => chain,
          order: () => chain,
          limit: () => Promise.resolve({ data: opts.salaryRows ?? [] }),
          maybeSingle: () => Promise.resolve({ data: opts.nd ?? null }),
        };
        return chain;
      },
      update: (payload: Record<string, unknown>) => {
        calls.push({ table, op: "update", payload });
        const err = table === "profiles" ? opts.profileError ?? null : null;
        return { eq: () => Promise.resolve({ error: err }) };
      },
      insert: (payload: Record<string, unknown>) => {
        calls.push({ table, op: "insert", payload });
        return Promise.resolve({ error: null });
      },
    }),
  };
  return { admin, calls };
}

const UID = "11111111-2222-3333-4444-555555555555";
const ND_ID = "99999999-8888-7777-6666-555555555555";

function ctx(admin: unknown) {
  return { user: { id: "admin-1" }, profile: { role: "company_admin", company_id: "co-1" }, companyId: "co-1", admin };
}
function req(body: unknown) {
  return new NextRequest("http://l/x", { method: "PATCH", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}
const contractParams = { params: Promise.resolve({ userId: UID }) };
const ndParams = (id = ND_ID) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  mockGetMember.mockResolvedValue({ user_id: UID, role: "employee", full_name: "Max" });
});

// ── Vertrag ────────────────────────────────────────────────────────────────
describe("PATCH /api/company/employees/[userId]/contract", () => {
  it("403 ohne Firmen-Admin", async () => {
    mockGetContext.mockResolvedValue(null);
    const res = await PATCH_CONTRACT(req({ weekly_hours: 40, vacation_days: 30, start_date: null }), contractParams);
    expect(res.status).toBe(403);
  });

  it("400 bei ungültigen Werten (Urlaub halbe Tage / 80 h)", async () => {
    mockGetContext.mockResolvedValue(ctx(makeAdmin({}).admin));
    expect((await PATCH_CONTRACT(req({ weekly_hours: 40, vacation_days: 27.5, start_date: null }), contractParams)).status).toBe(400);
    expect((await PATCH_CONTRACT(req({ weekly_hours: 80, vacation_days: 30, start_date: null }), contractParams)).status).toBe(400);
  });

  it("404 wenn Mitarbeiter nicht zur Firma gehört", async () => {
    mockGetContext.mockResolvedValue(ctx(makeAdmin({}).admin));
    mockGetMember.mockResolvedValue(null);
    const res = await PATCH_CONTRACT(req({ weekly_hours: 40, vacation_days: 30, start_date: null }), contractParams);
    expect(res.status).toBe(404);
  });

  it("setzt Vertrag und übernimmt Soll (40 h → 173,33) + Urlaub in die neueste Lohn-Einstellung", async () => {
    const { admin, calls } = makeAdmin({ salaryRows: [{ id: "s1" }] });
    mockGetContext.mockResolvedValue(ctx(admin));
    const res = await PATCH_CONTRACT(req({ weekly_hours: 40, vacation_days: 30, start_date: "2026-01-15" }), contractParams);
    expect(res.status).toBe(200);
    expect(calls[0]).toEqual({
      table: "profiles", op: "update",
      payload: { contract_weekly_hours: 40, contract_vacation_days: 30, contract_start: "2026-01-15" },
    });
    expect(calls[1]).toEqual({
      table: "salary_settings", op: "update",
      payload: { monthly_target_hours: 173.33, urlaub_anspruch: 30, employment_start_date: "2026-01-15" },
    });
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "employee.contract_updated", resourceId: UID }));
  });

  it("legt Lohn-Einstellung an, wenn der Mitarbeiter noch keine hat", async () => {
    const { admin, calls } = makeAdmin({ salaryRows: [] });
    mockGetContext.mockResolvedValue(ctx(admin));
    await PATCH_CONTRACT(req({ weekly_hours: 20, vacation_days: null, start_date: null }), contractParams);
    expect(calls[1]).toEqual({ table: "salary_settings", op: "insert", payload: { user_id: UID, monthly_target_hours: 86.67 } });
  });

  it("Zurücksetzen (alles null) ändert die Lohn-Einstellung nicht", async () => {
    const { admin, calls } = makeAdmin({ salaryRows: [{ id: "s1" }] });
    mockGetContext.mockResolvedValue(ctx(admin));
    const res = await PATCH_CONTRACT(req({ weekly_hours: null, vacation_days: null, start_date: null }), contractParams);
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.table).toBe("profiles");
  });

  it("verständliche Meldung, wenn Migration 033 fehlt", async () => {
    const { admin } = makeAdmin({ profileError: { message: 'column "contract_weekly_hours" does not exist' } });
    mockGetContext.mockResolvedValue(ctx(admin));
    const res = await PATCH_CONTRACT(req({ weekly_hours: 40, vacation_days: 30, start_date: null }), contractParams);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/Migration 033/);
  });
});

// ── Notdienst bezahlt ──────────────────────────────────────────────────────
describe("PATCH /api/company/notdienst/[id]", () => {
  const ND = { id: ND_ID, user_id: UID, date: "2026-09-12", erledigt: false };

  it("400 bei ungültiger ID", async () => {
    mockGetContext.mockResolvedValue(ctx(makeAdmin({ nd: ND }).admin));
    expect((await PATCH_ND(req({ erledigt: true }), ndParams("abc"))).status).toBe(400);
  });

  it("404 wenn der Einsatz einem fremden Mitarbeiter gehört", async () => {
    mockGetContext.mockResolvedValue(ctx(makeAdmin({ nd: ND }).admin));
    mockGetMember.mockResolvedValue(null);
    expect((await PATCH_ND(req({ erledigt: true }), ndParams())).status).toBe(404);
  });

  it("markiert als bezahlt und schreibt Audit-Log", async () => {
    const { admin, calls } = makeAdmin({ nd: ND });
    mockGetContext.mockResolvedValue(ctx(admin));
    const res = await PATCH_ND(req({ erledigt: true }), ndParams());
    expect(res.status).toBe(200);
    expect(calls).toEqual([{ table: "notdienst_entries", op: "update", payload: { erledigt: true } }]);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "notdienst.marked_paid" }));
  });

  it("keine Änderung, wenn der Status schon stimmt", async () => {
    const { admin, calls } = makeAdmin({ nd: { ...ND, erledigt: true } });
    mockGetContext.mockResolvedValue(ctx(admin));
    await PATCH_ND(req({ erledigt: true }), ndParams());
    expect(calls).toHaveLength(0);
    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});
