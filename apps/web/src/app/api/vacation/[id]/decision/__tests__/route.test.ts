import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockGetContext = vi.fn();
const mockSendEmail  = vi.fn();
const mockSelectSingle = vi.fn();
const mockUpdate     = vi.fn();

vi.mock("@/lib/company/admin", () => ({
  getCompanyAdminContext: () => mockGetContext(),
}));

vi.mock("@/lib/email/resend", () => ({
  sendVacationDecisionEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

const mockLogAudit = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/audit/logger", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

// admin.from(...).select(...).eq(...).single() ya da .from().update().eq() chain'i için
// basit bir factory: from() çağrısı tablo ismine göre konfigürasyona göre döner.
function makeAdminClient(opts: {
  vacation: unknown;
  profile:  unknown;
  updateError?: { message: string } | null;
}) {
  return {
    from: (table: string) => {
      if (table === "vacation_requests") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: opts.vacation }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            mockUpdate(payload);
            return {
              eq: () => Promise.resolve({ error: opts.updateError ?? null }),
            };
          },
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: opts.profile }),
            }),
          }),
        };
      }
      throw new Error("Unexpected table: " + table);
    },
  };
}

const VACATION = {
  id:         "vac-1",
  user_id:    "emp-1",
  start_date: "2026-07-10",
  end_date:   "2026-07-20",
  days_count: 8,
  status:     "pending",
  urlaub_art: "Erholungsurlaub",
};

const PROFILE = {
  user_id:    "emp-1",
  company_id: "co-1",
  full_name:  "Max Mustermann",
  email:      "max@example.com",
};

function ctxAdmin(opts: { vacation?: unknown; profile?: unknown; updateError?: { message: string } | null } = {}) {
  return {
    user: { id: "admin-1" },
    profile: { full_name: "Anna Admin", role: "company_admin", company_id: "co-1" },
    companyId: "co-1",
    admin: makeAdminClient({
      vacation: opts.vacation !== undefined ? opts.vacation : VACATION,
      profile:  opts.profile  !== undefined ? opts.profile  : PROFILE,
      updateError: opts.updateError ?? null,
    }),
  };
}

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/vacation/vac-1/decision", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}
const PARAMS = { params: Promise.resolve({ id: "vac-1" }) };

// ── Tests ──────────────────────────────────────────────────────────────────
describe("POST /api/vacation/[id]/decision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue({ ok: true });
  });

  it("403 — company_admin değilse erişim yok", async () => {
    mockGetContext.mockResolvedValue(null);
    const res = await POST(makeRequest({ decision: "approved" }), PARAMS);
    expect(res.status).toBe(403);
  });

  it("400 — decision boş veya geçersizse hata", async () => {
    mockGetContext.mockResolvedValue(ctxAdmin());
    const res = await POST(makeRequest({ decision: "maybe" }), PARAMS);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string; details?: { decision?: string[] } };
    // Zod: error = "Ungültige Eingabe", details.decision içinde alan hatası
    expect(json.error).toMatch(/Ungültige|approved/);
    expect(json.details?.decision?.[0]).toMatch(/approved|rejected/);
  });

  it("404 — antrag bulunamazsa", async () => {
    mockGetContext.mockResolvedValue(ctxAdmin({ vacation: null }));
    const res = await POST(makeRequest({ decision: "approved" }), PARAMS);
    expect(res.status).toBe(404);
  });

  it("409 — antrag zaten karara bağlanmışsa", async () => {
    mockGetContext.mockResolvedValue(ctxAdmin({
      vacation: { ...VACATION, status: "approved" },
    }));
    const res = await POST(makeRequest({ decision: "approved" }), PARAMS);
    expect(res.status).toBe(409);
  });

  it("403 — antrag sahibi farklı şirkette ise reddedilmeli", async () => {
    mockGetContext.mockResolvedValue(ctxAdmin({
      profile: { ...PROFILE, company_id: "co-2" },
    }));
    const res = await POST(makeRequest({ decision: "approved" }), PARAMS);
    expect(res.status).toBe(403);
  });

  it("200 — approve başarılı, email gönderilir, approved_at + approved_by set", async () => {
    mockGetContext.mockResolvedValue(ctxAdmin());
    const res = await POST(makeRequest({ decision: "approved" }), PARAMS);
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; decision: string };
    expect(json.ok).toBe(true);
    expect(json.decision).toBe("approved");
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: "approved",
      approved_by: "admin-1",
    }));
    expect(mockUpdate.mock.calls[0]?.[0]).toHaveProperty("approved_at");
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "max@example.com",
      decision: "approved",
    }));
  });

  it("200 — reject başarılı, rejection_reason + rejected_at set", async () => {
    mockGetContext.mockResolvedValue(ctxAdmin());
    const res = await POST(makeRequest({ decision: "rejected", reason: "Engpass im Team" }), PARAMS);
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: "rejected",
      rejection_reason: "Engpass im Team",
    }));
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
      decision: "rejected",
      rejectionReason: "Engpass im Team",
    }));
  });

  it("200 — email gönderimi fail olsa bile karar geçerli", async () => {
    mockGetContext.mockResolvedValue(ctxAdmin());
    mockSendEmail.mockRejectedValue(new Error("Resend down"));
    const res = await POST(makeRequest({ decision: "approved" }), PARAMS);
    expect(res.status).toBe(200);
  });

  it("500 — DB update hatası varsa 500 döner ve email gitmez", async () => {
    mockGetContext.mockResolvedValue(ctxAdmin({
      updateError: { message: "db down" },
    }));
    const res = await POST(makeRequest({ decision: "approved" }), PARAMS);
    expect(res.status).toBe(500);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
