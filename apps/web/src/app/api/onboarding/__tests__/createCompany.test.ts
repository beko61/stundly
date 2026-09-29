import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../create-company/route";

const mockGetUser = vi.fn();
const mockExisting = vi.fn();
const profileUpdates: Record<string, unknown>[] = [];

vi.mock("@/lib/rateLimit/check", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, count: 1, limit: 5, retryAfterSec: 0 }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({ select: () => ({ eq: () => ({ single: mockExisting }) }) }),
  }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => ({
      insert: () => table === "companies"
        ? { select: () => ({ single: () => Promise.resolve({ data: { id: "co-new" }, error: null }) }) }
        : Promise.resolve({ error: null }),
      update: (p: Record<string, unknown>) => { profileUpdates.push(p); return { eq: () => Promise.resolve({ error: null }) }; },
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  }),
}));

const req = () => new NextRequest("http://l/api/onboarding/create-company", {
  method: "POST", body: JSON.stringify({ name: "Zuzz GmbH", bundesland: "BY" }), headers: { "Content-Type": "application/json" },
});

beforeEach(() => {
  vi.clearAllMocks();
  profileUpdates.length = 0;
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
});

describe("POST /api/onboarding/create-company", () => {
  it("normaler Nutzer wird company_admin, Bundesland aus dem Formular", async () => {
    mockExisting.mockResolvedValue({ data: { role: "individual", company_id: null, bundesland: null } });
    expect((await POST(req())).status).toBe(200);
    expect(profileUpdates[0]).toEqual({ role: "company_admin", company_id: "co-new", bundesland: "BY" });
  });

  it("super_admin bleibt super_admin, eigenes Bundesland bleibt", async () => {
    mockExisting.mockResolvedValue({ data: { role: "super_admin", company_id: null, bundesland: "NI" } });
    expect((await POST(req())).status).toBe(200);
    expect(profileUpdates[0]).toEqual({ role: "super_admin", company_id: "co-new" });
  });

  it("409, wenn schon eine Firma da ist", async () => {
    mockExisting.mockResolvedValue({ data: { role: "company_admin", company_id: "co-1", bundesland: "NI" } });
    expect((await POST(req())).status).toBe(409);
    expect(profileUpdates).toHaveLength(0);
  });
});
