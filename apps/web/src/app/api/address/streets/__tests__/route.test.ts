import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));
const mockRateLimit = vi.fn();
vi.mock("@/lib/rateLimit/check", () => ({ checkRateLimit: (...a: unknown[]) => mockRateLimit(...a) }));

import { GET } from "../route";

function req(plz: string) {
  return new NextRequest(`http://localhost/api/address/streets?plz=${plz}`);
}

function page(items: Array<{ name: string; locality: string }>, totalPages: number) {
  return new Response(JSON.stringify(items), { status: 200, headers: { "x-total-pages": String(totalPages) } });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  mockRateLimit.mockResolvedValue({ allowed: true, count: 1, limit: 120, retryAfterSec: 0 });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("GET /api/address/streets", () => {
  it("400 bei ungültiger PLZ — kein Upstream-Call", async () => {
    for (const bad of ["3051", "305199", "abcde", ""]) {
      const res = await GET(req(bad));
      expect(res.status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("401 ohne Login", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await GET(req("30519"));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("429 bei Rate-Limit", async () => {
    mockRateLimit.mockResolvedValueOnce({ allowed: false, count: 121, limit: 120, retryAfterSec: 60 });
    const res = await GET(req("30519"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("lädt alle Seiten, entfernt Duplikate, schreibt Str. aus, liefert Orte", async () => {
    fetchMock
      .mockResolvedValueOnce(page([{ name: "Hildesheimer Str.", locality: "Hannover" }, { name: "Abbestr.", locality: "Hannover" }], 2))
      .mockResolvedValueOnce(page([{ name: "Hildesheimer Str.", locality: "Hannover" }], 2));
    const res = await GET(req("30519"));
    expect(res.status).toBe(200);
    const body = await res.json() as { orte: string[]; streets: Array<{ name: string; ort: string }> };
    expect(body.streets).toEqual([
      { name: "Abbestraße", ort: "Hannover" },
      { name: "Hildesheimer Straße", ort: "Hannover" },
    ]);
    expect(body.orte).toEqual(["Hannover"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Nur die PLZ geht an den Drittanbieter
    expect(String(fetchMock.mock.calls[1]![0])).toBe("https://openplzapi.org/de/Streets?postalCode=30519&page=2&pageSize=50");
  });

  it("502 wenn OpenPLZ ausfällt", async () => {
    fetchMock.mockResolvedValueOnce(new Response("down", { status: 503 }));
    const res = await GET(req("30519"));
    expect(res.status).toBe(502);
  });
});
