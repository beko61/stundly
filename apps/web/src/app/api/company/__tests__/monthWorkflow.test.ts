import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as POST_CLOSING } from "../month-closings/route";
import { POST as POST_CORR } from "../corrections/route";
import { POST as POST_SUBMIT } from "../../month/submit/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockGetContext = vi.fn();
const mockGetMember  = vi.fn();
const mockLogAudit   = vi.fn().mockResolvedValue(undefined);
const mockGetUser    = vi.fn();
const mockProfile    = vi.fn();
let serviceClient: unknown = null;

vi.mock("@/lib/company/admin", () => ({
  getCompanyAdminContext: () => mockGetContext(),
  getTeamMember: (...a: unknown[]) => mockGetMember(...a),
}));
vi.mock("@/lib/audit/logger", () => ({ logAudit: (...a: unknown[]) => mockLogAudit(...a) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mockProfile }) }) }),
  }),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => serviceClient }));

type Call = { table: string; op: string; payload?: unknown };

/** Fake-Admin: select → `rows[table]`, zeichnet Schreibzugriffe auf; `fail` lässt einen Schreibzugriff scheitern. */
function makeAdmin(rows: Record<string, unknown>, fail: Partial<Record<string, string>> = {}) {
  const calls: Call[] = [];
  const res = (table: string, op: string) => ({ error: fail[`${table}.${op}`] ? { message: fail[`${table}.${op}`] } : null });
  const admin = {
    from: (table: string) => ({
      select: () => {
        const chain = { eq: () => chain, maybeSingle: () => Promise.resolve({ data: rows[table] ?? null }) };
        return chain;
      },
      insert: (payload: unknown) => {
        calls.push({ table, op: "insert", payload });
        const r = res(table, "insert");
        return Object.assign(Promise.resolve(r), {
          select: () => ({ single: () => Promise.resolve(r.error ? { data: null, ...r } : { data: { id: "log-1" }, error: null }) }),
        });
      },
      update: (payload: unknown) => { calls.push({ table, op: "update", payload }); return { eq: () => Promise.resolve(res(table, "update")) }; },
      upsert: (payload: unknown) => { calls.push({ table, op: "upsert", payload }); return Promise.resolve(res(table, "upsert")); },
      delete: () => { calls.push({ table, op: "delete" }); return { eq: () => Promise.resolve(res(table, "delete")) }; },
    }),
  };
  return { admin, calls };
}

const UID = "11111111-2222-3333-4444-555555555555";
const ctx = (admin: unknown) => ({ user: { id: "boss" }, profile: {}, companyId: "co-1", admin });
const req = (body: unknown) => new NextRequest("http://l/x", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  mockGetMember.mockResolvedValue({ user_id: UID, role: "employee", full_name: "Max" });
});

// ── Freigabe ───────────────────────────────────────────────────────────────
describe("POST /api/company/month-closings", () => {
  it("gibt einen eingereichten Monat frei (Einreichdatum bleibt)", async () => {
    const { admin, calls } = makeAdmin({ month_closings: { id: "mc1", status: "submitted", submitted_at: "2026-10-01T08:00:00Z" } });
    mockGetContext.mockResolvedValue(ctx(admin));
    const res = await POST_CLOSING(req({ userId: UID, year: 2026, month: 9, action: "approve" }));
    expect(res.status).toBe(200);
    expect(calls[0]).toMatchObject({ table: "month_closings", op: "update", payload: { status: "approved", submitted_at: "2026-10-01T08:00:00Z", approved_by: "boss" } });
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "month.approved" }));
  });

  it("Freigabe ohne Einreichung legt die Zeile an", async () => {
    const { admin, calls } = makeAdmin({});
    mockGetContext.mockResolvedValue(ctx(admin));
    await POST_CLOSING(req({ userId: UID, year: 2026, month: 9, action: "approve" }));
    expect(calls[0]).toMatchObject({ op: "insert", payload: { user_id: UID, company_id: "co-1", status: "approved" } });
  });

  it("Wieder öffnen löscht den Abschluss", async () => {
    const { admin, calls } = makeAdmin({ month_closings: { id: "mc1", status: "approved", submitted_at: null } });
    mockGetContext.mockResolvedValue(ctx(admin));
    await POST_CLOSING(req({ userId: UID, year: 2026, month: 9, action: "reopen" }));
    expect(calls).toEqual([{ table: "month_closings", op: "delete" }]);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "month.reopened" }));
  });

  it("404 für fremde Mitarbeiter", async () => {
    mockGetContext.mockResolvedValue(ctx(makeAdmin({}).admin));
    mockGetMember.mockResolvedValue(null);
    expect((await POST_CLOSING(req({ userId: UID, year: 2026, month: 9, action: "approve" }))).status).toBe(404);
  });
});

// ── Korrekturen ────────────────────────────────────────────────────────────
describe("POST /api/company/corrections", () => {
  const before = { id: "te1", day_type: "arbeiten", start_time: "07:00:00", end_time: "18:00:00", break_minutes: 0 };
  const body = (over: Record<string, unknown> = {}) => ({
    userId: UID, date: "2026-09-14", reason: "Pause vergessen",
    entry: { day_type: "arbeiten", start_time: "07:00", end_time: "18:00", break_minutes: 30 }, ...over,
  });

  it("400 ohne Grund", async () => {
    mockGetContext.mockResolvedValue(ctx(makeAdmin({}).admin));
    expect((await POST_CORR(req(body({ reason: " " })))).status).toBe(400);
  });

  it("protokolliert Vorher/Nachher + Grund und schreibt dann den Eintrag", async () => {
    const { admin, calls } = makeAdmin({ time_entries: before });
    mockGetContext.mockResolvedValue(ctx(admin));
    const res = await POST_CORR(req(body()));
    expect(res.status).toBe(200);
    expect(calls[0]).toMatchObject({
      table: "entry_corrections", op: "insert",
      payload: {
        user_id: UID, entity: "time_entry", entry_date: "2026-09-14", reason: "Pause vergessen", corrected_by: "boss",
        before: { day_type: "arbeiten", start_time: "07:00:00", end_time: "18:00:00", break_minutes: 0 },
        after:  { day_type: "arbeiten", start_time: "07:00", end_time: "18:00", break_minutes: 30 },
      },
    });
    expect(calls[1]).toMatchObject({ table: "time_entries", op: "upsert", payload: { user_id: UID, date: "2026-09-14", break_minutes: 30 } });
  });

  it("Urlaub wird ohne Zeiten gespeichert", async () => {
    const { admin, calls } = makeAdmin({ time_entries: before });
    mockGetContext.mockResolvedValue(ctx(admin));
    await POST_CORR(req(body({ entry: { day_type: "urlaub", start_time: "07:00", end_time: "16:00", break_minutes: 30 } })));
    expect(calls[1]!.payload).toMatchObject({ day_type: "urlaub", start_time: null, end_time: null, break_minutes: 0 });
  });

  it("entry = null löscht den Eintrag", async () => {
    const { admin, calls } = makeAdmin({ time_entries: before });
    mockGetContext.mockResolvedValue(ctx(admin));
    await POST_CORR(req(body({ entry: null })));
    expect(calls.map((c) => `${c.table}.${c.op}`)).toEqual(["entry_corrections.insert", "time_entries.delete"]);
  });

  it("schlägt das Schreiben fehl, wird das Protokoll zurückgenommen", async () => {
    const { admin, calls } = makeAdmin({ time_entries: before }, { "time_entries.upsert": "boom" });
    mockGetContext.mockResolvedValue(ctx(admin));
    expect((await POST_CORR(req(body()))).status).toBe(500);
    expect(calls.map((c) => `${c.table}.${c.op}`)).toEqual(["entry_corrections.insert", "time_entries.upsert", "entry_corrections.delete"]);
  });

  it("ohne Protokoll keine Änderung", async () => {
    const { admin, calls } = makeAdmin({ time_entries: before }, { "entry_corrections.insert": "boom" });
    mockGetContext.mockResolvedValue(ctx(admin));
    expect((await POST_CORR(req(body()))).status).toBe(500);
    expect(calls.map((c) => `${c.table}.${c.op}`)).toEqual(["entry_corrections.insert"]);
  });
});

// ── Mitarbeiter reicht ein ─────────────────────────────────────────────────
describe("POST /api/month/submit", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: UID } } });
    mockProfile.mockResolvedValue({ data: { company_id: "co-1" } });
  });

  it("401 ohne Login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect((await POST_SUBMIT(req({ year: 2026, month: 9, action: "submit" }))).status).toBe(401);
  });

  it("403 ohne Firma", async () => {
    mockProfile.mockResolvedValue({ data: { company_id: null } });
    serviceClient = makeAdmin({}).admin;
    expect((await POST_SUBMIT(req({ year: 2026, month: 9, action: "submit" }))).status).toBe(403);
  });

  it("reicht ein", async () => {
    const { admin, calls } = makeAdmin({});
    serviceClient = admin;
    expect((await POST_SUBMIT(req({ year: 2026, month: 9, action: "submit" }))).status).toBe(200);
    expect(calls[0]).toMatchObject({ table: "month_closings", op: "insert", payload: { user_id: UID, company_id: "co-1", status: "submitted" } });
  });

  it("freigegebener Monat: weder einreichen noch zurückziehen", async () => {
    const { admin, calls } = makeAdmin({ month_closings: { id: "mc1", status: "approved" } });
    serviceClient = admin;
    expect((await POST_SUBMIT(req({ year: 2026, month: 9, action: "withdraw" }))).status).toBe(409);
    expect(calls).toHaveLength(0);
  });

  it("zieht eine Einreichung zurück", async () => {
    const { admin, calls } = makeAdmin({ month_closings: { id: "mc1", status: "submitted" } });
    serviceClient = admin;
    await POST_SUBMIT(req({ year: 2026, month: 9, action: "withdraw" }));
    expect(calls).toEqual([{ table: "month_closings", op: "delete" }]);
  });
});
