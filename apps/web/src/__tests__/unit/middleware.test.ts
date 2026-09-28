// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: mockGetUser,
      getSession: async () => ({ data: { session: null } }),
    },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: "employee" } }) }) }) }),
  }),
}));

import { middleware } from "@/middleware";

function req(path: string, method = "GET") {
  return new NextRequest(`https://stundly.de${path}`, { method });
}
const isLoginRedirect = (res: Response) =>
  res.status === 307 && res.headers.get("location") === "https://stundly.de/login";

beforeEach(() => {
  mockGetUser.mockReset();
  mockGetUser.mockResolvedValue({ data: { user: null } });
});

describe("middleware — ohne Login", () => {
  it("Stripe-Webhook wird NICHT auf /login umgeleitet (Stripe schickt keine Cookies)", async () => {
    const res = await middleware(req("/api/stripe/webhook", "POST"));
    expect(isLoginRedirect(res)).toBe(false);
  });

  it("Cron und Kontakt bleiben erreichbar", async () => {
    expect(isLoginRedirect(await middleware(req("/api/cron/weekly-digest")))).toBe(false);
    expect(isLoginRedirect(await middleware(req("/api/contact", "POST")))).toBe(false);
  });

  it("geschützte Seiten und APIs leiten weiterhin auf /login", async () => {
    for (const p of ["/dashboard", "/tracker", "/settings", "/api/stripe/checkout", "/api/address/streets"]) {
      expect(isLoginRedirect(await middleware(req(p)))).toBe(true);
    }
  });

  it("ähnlich klingende Pfade werden nicht versehentlich freigegeben", async () => {
    expect(isLoginRedirect(await middleware(req("/api/stripe/webhook-admin")))).toBe(true);
    expect(isLoginRedirect(await middleware(req("/api/stripe/portal", "POST")))).toBe(true);
  });
});

describe("middleware — eingeloggt", () => {
  it("/login leitet auf /dashboard", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const res = await middleware(req("/login"));
    expect(res.headers.get("location")).toBe("https://stundly.de/dashboard");
  });
});
