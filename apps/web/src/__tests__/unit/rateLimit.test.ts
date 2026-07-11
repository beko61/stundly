import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock @supabase/supabase-js before importing the helper.
const selectMock = vi.fn();
const insertMock = vi.fn();
const fromMock = vi.fn((_table: string) => ({
  select: selectMock,
  insert: insertMock,
}));
const createClientMock = vi.fn(() => ({ from: fromMock }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args as []),
}));

// Env
const ORIG_ENV = { ...process.env };
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc-key";
  selectMock.mockReset();
  insertMock.mockReset();
  fromMock.mockClear();
  createClientMock.mockClear();
});
afterEach(() => {
  process.env = { ...ORIG_ENV };
});

async function importHelper() {
  vi.resetModules();
  const m = await import("@/lib/rateLimit/check");
  return m;
}

function selectChain(result: { count: number | null; error?: unknown }) {
  const geteMock = vi.fn(() => Promise.resolve(result));
  const eqMock = vi.fn(() => ({ gte: geteMock }));
  selectMock.mockReturnValue({ eq: eqMock });
  return { eqMock, geteMock };
}

describe("checkRateLimit", () => {
  it("Boş bucket → allowed, count=1", async () => {
    selectChain({ count: 0 });
    insertMock.mockResolvedValue({ error: null });
    const { checkRateLimit } = await importHelper();
    const r = await checkRateLimit({ bucket: "scan:u1", limit: 5, windowSec: 60 });
    expect(r.allowed).toBe(true);
    expect(r.count).toBe(1);
    expect(r.limit).toBe(5);
    expect(r.retryAfterSec).toBe(0);
    expect(insertMock).toHaveBeenCalledWith({ bucket: "scan:u1" });
  });

  it("Sınırın altında → allowed, count artırılmış", async () => {
    selectChain({ count: 3 });
    insertMock.mockResolvedValue({ error: null });
    const { checkRateLimit } = await importHelper();
    const r = await checkRateLimit({ bucket: "scan:u1", limit: 5, windowSec: 60 });
    expect(r.allowed).toBe(true);
    expect(r.count).toBe(4);
  });

  it("Sınırda (count == limit) → 429 blocked", async () => {
    selectChain({ count: 5 });
    const { checkRateLimit } = await importHelper();
    const r = await checkRateLimit({ bucket: "scan:u1", limit: 5, windowSec: 60 });
    expect(r.allowed).toBe(false);
    expect(r.count).toBe(5);
    expect(r.retryAfterSec).toBe(60);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("Sınır üstünde → blocked", async () => {
    selectChain({ count: 10 });
    const { checkRateLimit } = await importHelper();
    const r = await checkRateLimit({ bucket: "scan:u1", limit: 5, windowSec: 3600 });
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSec).toBe(3600);
  });

  it("Count query error → fail-open (izin ver, logla)", async () => {
    selectChain({ count: null, error: { message: "DB down" } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { checkRateLimit } = await importHelper();
    const r = await checkRateLimit({ bucket: "scan:u1", limit: 5, windowSec: 60 });
    expect(r.allowed).toBe(true);
    expect(r.count).toBe(0);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("Insert error → fail-open, count değişmeden", async () => {
    selectChain({ count: 2 });
    insertMock.mockResolvedValue({ error: { message: "unique violation" } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { checkRateLimit } = await importHelper();
    const r = await checkRateLimit({ bucket: "scan:u1", limit: 5, windowSec: 60 });
    expect(r.allowed).toBe(true);
    expect(r.count).toBe(2);
    spy.mockRestore();
  });

  it("Bucket string DB'ye geçiyor doğru", async () => {
    const { eqMock } = selectChain({ count: 0 });
    insertMock.mockResolvedValue({ error: null });
    const { checkRateLimit } = await importHelper();
    await checkRateLimit({ bucket: "contact:1.2.3.4", limit: 5, windowSec: 3600 });
    expect(eqMock).toHaveBeenCalledWith("bucket", "contact:1.2.3.4");
  });

  it("Missing Supabase env → throw", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const { checkRateLimit } = await importHelper();
    await expect(checkRateLimit({ bucket: "x", limit: 1, windowSec: 60 }))
      .rejects.toThrow("Supabase-Konfiguration fehlt");
  });
});
