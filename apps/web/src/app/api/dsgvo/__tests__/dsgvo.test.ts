// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks: Auth (Server-Client), Rate-Limit, Admin-Client (in-memory Tabellen) ─────────
const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));
vi.mock("@/lib/rateLimit/check", () => ({
  checkRateLimit: async () => ({ allowed: true, count: 1, limit: 5, retryAfterSec: 0 }),
}));

type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
const queried: string[] = [];

function query(table: string) {
  queried.push(table);
  const filters: Array<[string, unknown]> = [];
  const rows = () => (db[table] ?? []).filter(r => filters.every(([k, v]) => r[k] === v));
  const q = {
    select: () => q,
    order:  () => q,
    eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
    single:      async () => ({ data: rows()[0] ?? null, error: null }),
    maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
    then: (res: (v: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: rows(), error: null }).then(res),
    insert: async (row: Row) => { (db[table] ??= []).push({ status: "pending", ...row }); return { error: null }; },
    update: (patch: Row) => ({
      eq: (k1: string, v1: unknown) => ({
        eq: async (k2: string, v2: unknown) => {
          for (const r of db[table] ?? []) if (r[k1] === v1 && r[k2] === v2) Object.assign(r, patch);
          return { error: null };
        },
      }),
    }),
  };
  return q;
}
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: query }) }));

import * as del from "../delete/route";
import * as exp from "../export/route";

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  queried.length = 0;
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.de" } } });
  db.profiles = [{ user_id: "u1", company_id: null }];
});

describe("DSGVO Löschung", () => {
  it("401 ohne Login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect((await del.GET()).status).toBe(401);
    expect((await del.POST()).status).toBe(401);
  });

  it("Status: kein Antrag, Selbstlöschung erlaubt", async () => {
    expect(await (await del.GET()).json()).toEqual({ pending: null, selfService: true });
  });

  it("Antrag stellen → in 30 Tagen, Status zeigt ihn, zweiter Antrag idempotent", async () => {
    const before = Date.now();
    const r = await (await del.POST()).json() as { scheduled_for: string };
    const days = (new Date(r.scheduled_for).getTime() - before) / 86400000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
    expect((await (await del.GET()).json()).pending).toEqual({ scheduled_for: r.scheduled_for });

    await del.POST();
    expect(db.deletion_requests!.filter(x => x.status === "pending")).toHaveLength(1);
    expect(db.audit_logs!.some(a => a.action === "deletion_requested")).toBe(true);
  });

  it("Widerruf → kein offener Antrag mehr", async () => {
    await del.POST();
    expect((await del.DELETE()).status).toBe(200);
    expect((await (await del.GET()).json()).pending).toBeNull();
    expect(db.deletion_requests![0]!.status).toBe("canceled");
  });

  it("Firmenkonto: keine Selbstlöschung (403), Status sagt selfService=false", async () => {
    db.profiles = [{ user_id: "u1", company_id: "c1" }];
    expect((await (await del.GET()).json()).selfService).toBe(false);
    const res = await del.POST();
    expect(res.status).toBe(403);
    expect(db.deletion_requests ?? []).toHaveLength(0);
  });
});

describe("DSGVO Export", () => {
  it("enthält Notdienst- und Lohnaufzeichnungen, Dateiname stundly-daten-*.json", async () => {
    db.notdienst_entries  = [{ user_id: "u1", date: "2026-09-01", kunde: "Frau Kraft", adresse: "Wiehbergstraße 3" }];
    db.salary_records     = [{ user_id: "u1", year: 2026, month: 8 }];
    db.notdienst_anhaenge = [{ user_id: "u1", art: "foto", data: "data:image/jpeg;base64,xx" }];
    db.time_entries       = [{ user_id: "u1", date: "2026-09-02" }, { user_id: "other", date: "2026-09-02" }];

    const res = await exp.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toMatch(/filename="stundly-daten-\d{4}-\d{2}-\d{2}\.json"/);
    const body = await res.json() as Record<string, unknown[]>;
    expect(body.notdienst_entries).toHaveLength(1);
    expect(body.notdienst_anhaenge).toHaveLength(1);
    expect(body.salary_records).toHaveLength(1);
    expect(body.time_entries).toHaveLength(1); // nur eigene Daten
    expect(queried).not.toContain("daily_logs");
  });
});
