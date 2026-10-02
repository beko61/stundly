import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as POST_SEND } from "../lohn/send/route";
import { PATCH as PATCH_SETTINGS } from "../settings/route";
import { GET as CRON_STB } from "../../cron/steuerberater/route";

const mockGetContext = vi.fn();
const mockLoad = vi.fn();
const mockSend = vi.fn();
const mockLogAudit = vi.fn().mockResolvedValue(undefined);
let cronAdmin: unknown = null;

vi.mock("@/lib/company/admin", () => ({ getCompanyAdminContext: () => mockGetContext() }));
vi.mock("@/lib/audit/logger", () => ({ logAudit: (...a: unknown[]) => mockLogAudit(...a) }));
vi.mock("@/lib/rateLimit/check", () => ({ checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, count: 1, limit: 10, retryAfterSec: 0 }) }));
vi.mock("@/lib/company/lohnData", () => ({ loadLohnMonth: (...a: unknown[]) => mockLoad(...a) }));
vi.mock("@/lib/email/companyMails", () => ({ sendLohnToSteuerberater: (...a: unknown[]) => mockSend(...a) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => cronAdmin }));

const ROW = { user_id: "a", name: "Ali" };
const company = (email: string | null) => ({ name: "Wa", notdienst_pauschale: null, steuerberater_email: email, steuerberater_auto: true, team_digest_enabled: false, settingsSupported: true });

function settingsAdmin() {
  const calls: unknown[] = [];
  return { calls, admin: { from: () => ({ update: (p: unknown) => { calls.push(p); return { eq: () => Promise.resolve({ error: null }) }; } }) } };
}
const ctx = (admin: unknown = {}) => ({ user: { id: "boss", email: "chef@wa.de" }, profile: { full_name: "Chef Wa" }, companyId: "co-1", admin });
const req = (body: unknown, method = "POST") => new NextRequest("http://l/x", { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue({ error: null });
});

describe("POST /api/company/lohn/send", () => {
  it("sendet an den Steuerberater, Antwort-Adresse = Chef", async () => {
    mockGetContext.mockResolvedValue(ctx());
    mockLoad.mockResolvedValue({ company: company("lohn@stb.de"), rows: [ROW], monthLabel: "September 2026" });
    const res = await POST_SEND(req({ year: 2026, month: 9 }));
    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ to: "lohn@stb.de", replyTo: "chef@wa.de", firma: "Wa", sender: "Chef Wa", year: 2026, month: 9 }));
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "lohn.sent_to_steuerberater" }));
  });
  it("400 ohne Steuerberater-Adresse", async () => {
    mockGetContext.mockResolvedValue(ctx());
    mockLoad.mockResolvedValue({ company: company(null), rows: [ROW], monthLabel: "x" });
    expect((await POST_SEND(req({ year: 2026, month: 9 }))).status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });
  it("502, wenn der Mailversand scheitert", async () => {
    mockGetContext.mockResolvedValue(ctx());
    mockLoad.mockResolvedValue({ company: company("lohn@stb.de"), rows: [ROW], monthLabel: "x" });
    mockSend.mockResolvedValue({ error: { message: "boom" } });
    expect((await POST_SEND(req({ year: 2026, month: 9 }))).status).toBe(502);
    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/company/settings (Phase D)", () => {
  it("speichert nur gesendete Felder, E-Mail klein", async () => {
    const { admin, calls } = settingsAdmin();
    mockGetContext.mockResolvedValue(ctx(admin));
    await PATCH_SETTINGS(req({ steuerberater_email: " Lohn@STB.de ", team_digest_enabled: true }, "PATCH"));
    expect(calls[0]).toEqual({ steuerberater_email: "lohn@stb.de", team_digest_enabled: true });
  });
  it("leere Adresse schaltet die Automatik aus", async () => {
    const { admin, calls } = settingsAdmin();
    mockGetContext.mockResolvedValue(ctx(admin));
    await PATCH_SETTINGS(req({ steuerberater_email: "" }, "PATCH"));
    expect(calls[0]).toEqual({ steuerberater_email: null, steuerberater_auto: false });
  });
  it("Briefkopf: leere Felder → null, Logo nicht ins Audit-Log", async () => {
    const { admin, calls } = settingsAdmin();
    mockGetContext.mockResolvedValue(ctx(admin));
    const logo = "data:image/jpeg;base64,QUJD";
    const res = await PATCH_SETTINGS(req({ name: " Wa GmbH ", address_line1: "Hauptstr. 1", postal_code: "", city: "Hannover", phone: "", logo_data: logo }, "PATCH"));
    expect(res.status).toBe(200);
    expect(calls[0]).toEqual({ name: "Wa GmbH", address_line1: "Hauptstr. 1", postal_code: null, city: "Hannover", phone: null, logo_data: logo });
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ logo_data: "[neues Logo]" }) }));
  });
  it("400 bei Logo, das kein PNG/JPEG-Bild ist, oder zu kurzem Namen", async () => {
    mockGetContext.mockResolvedValue(ctx(settingsAdmin().admin));
    expect((await PATCH_SETTINGS(req({ logo_data: "data:text/html;base64,PHNjcmlwdD4=" }, "PATCH"))).status).toBe(400);
    expect((await PATCH_SETTINGS(req({ name: "x" }, "PATCH"))).status).toBe(400);
  });
  it("403 für Nicht-Chefs (Mitarbeiter)", async () => {
    mockGetContext.mockResolvedValue(null);
    expect((await PATCH_SETTINGS(req({ name: "Andere Firma" }, "PATCH"))).status).toBe(403);
  });
  it("400 bei ungültiger Adresse oder leerem Body", async () => {
    mockGetContext.mockResolvedValue(ctx(settingsAdmin().admin));
    expect((await PATCH_SETTINGS(req({ steuerberater_email: "kein-mail" }, "PATCH"))).status).toBe(400);
    expect((await PATCH_SETTINGS(req({}, "PATCH"))).status).toBe(400);
  });
});

describe("GET /api/cron/steuerberater", () => {
  beforeEach(() => { vi.stubEnv("CRON_SECRET", "s3cret"); });
  const cronReq = (token: string) => new Request("http://l/api/cron/steuerberater", { headers: { authorization: `Bearer ${token}` } });

  function makeCronAdmin(companies: Record<string, unknown>[]) {
    const updates: unknown[] = [];
    const admin = {
      from: (table: string) => ({
        select: () => {
          const chain = {
            eq: () => chain, not: () => Promise.resolve({ data: companies, error: null }),
            maybeSingle: () => Promise.resolve({ data: { email: "owner@wa.de", full_name: "Owner" } }),
          };
          return chain;
        },
        update: (p: unknown) => { updates.push({ table, p }); return { eq: () => Promise.resolve({ error: null }) }; },
        insert: () => Promise.resolve({ error: null }),
      }),
    };
    return { admin, updates };
  }

  it("401 mit falschem Token", async () => {
    expect((await CRON_STB(cronReq("nope"))).status).toBe(401);
  });

  it("sendet den Vormonat und merkt sich den Monat — schon gesendet wird übersprungen", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T06:00:00Z"));
    const { admin, updates } = makeCronAdmin([
      { id: "c1", owner_id: "o1", steuerberater_email: "lohn@stb.de", steuerberater_last_sent: null },
      { id: "c2", owner_id: "o2", steuerberater_email: "x@stb.de", steuerberater_last_sent: "2026-09" },
    ]);
    cronAdmin = admin;
    mockLoad.mockResolvedValue({ company: company("lohn@stb.de"), rows: [ROW], monthLabel: "September 2026" });
    const p = CRON_STB(cronReq("s3cret"));
    await vi.runAllTimersAsync();
    const body = await (await p).json();
    vi.useRealTimers();
    expect(body.month).toBe("2026-09");
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ to: "lohn@stb.de", replyTo: "owner@wa.de", year: 2026, month: 9 }));
    expect(updates).toEqual([{ table: "companies", p: { steuerberater_last_sent: "2026-09" } }]);
  });
});
