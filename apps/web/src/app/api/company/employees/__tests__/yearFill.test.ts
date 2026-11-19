import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../[userId]/year-fill/route";

const mockGetContext = vi.fn();
const mockMember = vi.fn();
const mockAccess = vi.fn();
const mockLogAudit = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/company/admin", () => ({
  getCompanyAdminContext: () => mockGetContext(),
  getTeamMember: (...a: unknown[]) => mockMember(...a),
}));
vi.mock("@/lib/company/membership", async (orig) => ({
  ...(await orig<typeof import("@/lib/company/membership")>()),
  getMemberAccess: (...a: unknown[]) => mockAccess(...a),
}));
vi.mock("@/lib/audit/logger", () => ({ logAudit: (...a: unknown[]) => mockLogAudit(...a) }));

const EMP = "11111111-2222-3333-4444-555555555555";

/** Minimaler Supabase-Ersatz: jede Kette liefert die Daten der Tabelle; upsert wird mitgeschrieben. */
function fakeAdmin(tables: Record<string, unknown>) {
  const upserts: unknown[][] = [];
  const from = (t: string) => {
    const result = { data: tables[t] ?? null, error: null };
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gte", "lte", "in"]) q[m] = () => q;
    q.maybeSingle = () => Promise.resolve(result);
    q.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
    q.upsert = (rows: unknown[]) => { upserts.push(rows); return Promise.resolve({ error: null }); };
    return q;
  };
  return { admin: { from }, upserts };
}

const req = (body: unknown) => new NextRequest("http://l/api/company/employees/x/year-fill", {
  method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
});
const params = { params: Promise.resolve({ userId: EMP }) };
const D = { start: "06:30", end: "15:00", pause: 30 };
const WEEK = { 1: D, 2: D, 3: D, 4: D, 5: { start: "06:30", end: "12:00", pause: 0 }, 6: { start: "08:00", end: "12:00", pause: 0 } };

describe("POST /api/company/employees/[userId]/year-fill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 19, 12, 0, 0));
    mockMember.mockResolvedValue({ user_id: EMP, role: "employee", full_name: "Max" });
    mockAccess.mockResolvedValue({ ranges: [{ from: "2026-01-01", to: null }], former: false, leftAt: null });
  });
  afterEach(() => { vi.useRealTimers(); });

  it("403 ohne Firmen-Admin", async () => {
    mockGetContext.mockResolvedValue(null);
    expect((await POST(req({ year: 2027, week: WEEK }), params)).status).toBe(403);
  });

  it("400 für andere Jahre", async () => {
    mockGetContext.mockResolvedValue({ user: { id: "boss" }, companyId: "co", admin: fakeAdmin({}).admin });
    expect((await POST(req({ year: 2025, week: WEEK }), params)).status).toBe(400);
    expect((await POST(req({ year: 2028, week: WEEK }), params)).status).toBe(400);
  });

  it("404 für Admin oder fremde Person", async () => {
    mockGetContext.mockResolvedValue({ user: { id: "boss" }, companyId: "co", admin: fakeAdmin({}).admin });
    mockMember.mockResolvedValue({ user_id: EMP, role: "company_admin", full_name: "Chef" });
    expect((await POST(req({ year: 2027, week: WEEK }), params)).status).toBe(404);
    mockMember.mockResolvedValue(null);
    expect((await POST(req({ year: 2027, week: WEEK }), params)).status).toBe(404);
  });

  it("400 bei ungültigen Zeiten oder ohne Arbeitstag", async () => {
    mockGetContext.mockResolvedValue({ user: { id: "boss" }, companyId: "co", admin: fakeAdmin({}).admin });
    expect((await POST(req({ year: 2027, week: { ...WEEK, 1: { start: "15:00", end: "07:00", pause: 0 } } }), params)).status).toBe(400);
    expect((await POST(req({ year: 2027, week: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null } }), params)).status).toBe(400);
  });

  it("füllt mit den Zeiten je Wochentag (inkl. Samstag), lässt Einträge und Urlaub aus", async () => {
    const f = fakeAdmin({
      profiles: { bundesland: "NI", contract_start: null },
      time_entries: [{ date: "2027-01-04" }],
      vacation_requests: [{ start_date: "2027-01-05", end_date: "2027-01-06" }],
    });
    mockGetContext.mockResolvedValue({ user: { id: "boss" }, companyId: "co", admin: f.admin });
    const res = await POST(req({ year: 2027, week: WEEK }), params);
    expect(res.status).toBe(200);
    const rows = f.upserts[0] as { date: string; start_time: string; end_time: string; user_id: string }[];
    expect(rows[0]).toMatchObject({ date: "2027-01-02", start_time: "08:00", end_time: "12:00", user_id: EMP }); // Samstag
    expect(rows.some((r) => r.date === "2027-01-04" || r.date === "2027-01-05")).toBe(false);
    expect(rows.find((r) => r.date === "2027-01-07")).toMatchObject({ start_time: "06:30", end_time: "15:00" });
    expect(rows.find((r) => r.date === "2027-01-08")).toMatchObject({ end_time: "12:00" });
    expect(rows.some((r) => r.date === "2027-01-03")).toBe(false); // Sonntag
    expect((await res.json()).inserted).toBe(rows.length);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "entries.year_filled" }));
  });

  it("automatisch gefüllte Tage bekommen neue Zeiten, selbst eingetragene bleiben", async () => {
    const f = fakeAdmin({
      profiles: { bundesland: "NI", contract_start: null },
      time_entries: [{ date: "2027-01-04", tags: [] }, { date: "2027-01-05", tags: ["autofill"] }],
      vacation_requests: [],
    });
    mockGetContext.mockResolvedValue({ user: { id: "boss" }, companyId: "co", admin: f.admin });
    const res = await POST(req({ year: 2027, week: WEEK }), params);
    const json = await res.json();
    const fresh = f.upserts[0] as { date: string }[];
    const refill = f.upserts[1] as { date: string; start_time: string }[];
    expect(fresh.some((r) => r.date === "2027-01-04" || r.date === "2027-01-05")).toBe(false);
    expect(refill).toEqual([expect.objectContaining({ date: "2027-01-05", start_time: "06:30" })]);
    expect(json).toMatchObject({ updated: 1, inserted: fresh.length });
  });

  it("dieses Jahr erst ab heute, nichts in der Vergangenheit", async () => {
    const f = fakeAdmin({ profiles: { bundesland: "NI", contract_start: null }, time_entries: [], vacation_requests: [] });
    mockGetContext.mockResolvedValue({ user: { id: "boss" }, companyId: "co", admin: f.admin });
    await POST(req({ year: 2026, week: WEEK }), params);
    const rows = f.upserts[0] as { date: string }[];
    expect(rows[0]!.date).toBe("2026-11-19");
    expect(rows.every((r) => r.date >= "2026-11-19")).toBe(true);
  });
});
