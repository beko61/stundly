import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../scan/route";

const mockGetContext = vi.fn();
const mockCreate = vi.fn();
vi.mock("@/lib/company/admin", () => ({ getCompanyAdminContext: () => mockGetContext() }));
vi.mock("@/lib/rateLimit/check", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, count: 1, limit: 30, retryAfterSec: 0 }),
}));
vi.mock("@anthropic-ai/sdk", () => ({ default: vi.fn().mockImplementation(() => ({ messages: { create: mockCreate } })) }));

function ctx() {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is"]) c[m] = () => c;
  c.order = () => Promise.resolve({ data: [{ user_id: "u1", full_name: "Max Müller" }] });
  mockGetContext.mockResolvedValue({ user: { id: "admin" }, companyId: "co-1", admin: { from: () => c } });
}
const req = (body: unknown) => new NextRequest("http://l/api/company/scan", {
  method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
});
const IMG = { image: "data:image/jpeg;base64,/9j/abc", mediaType: "image/jpeg" };

describe("POST /api/company/scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("403 ohne Firmen-Admin", async () => {
    mockGetContext.mockResolvedValue(null);
    expect((await POST(req(IMG))).status).toBe(403);
  });

  it("Wochenliste: gewählte Woche steht als feste Wochentag→Datum-Zuordnung im Auftrag; Antwort → Zeilen", async () => {
    ctx();
    mockCreate.mockResolvedValue({ content: [{ type: "text", text:
      '{"personen":[{"name":"Müller","tage":[["2026-11-02","07:00","15:30",30,"A"]]}],"hinweis":"KW 45"}' }] });
    const res = await POST(req({ ...IMG, weekStart: "2026-11-04" }));
    const prompt = (mockCreate.mock.calls[0]![0] as { messages: { content: { type: string; text?: string }[] }[] })
      .messages[0]!.content.find(c => c.type === "text")!.text!;
    expect(prompt).toContain("Woche ab Montag 2026-11-02");
    expect(prompt).toContain("Fr=2026-11-06");
    const j = await res.json();
    expect(j.rows).toEqual([{ name: "Müller", userId: "u1", date: "2026-11-02", day_type: "arbeiten", start_time: "07:00", end_time: "15:30", break_minutes: 30 }]);
    expect(j.team).toEqual([{ user_id: "u1", name: "Max Müller" }]);
  });

  it("ohne Woche kein Wochen-Hinweis; abgeschnittene KI-Antwort → 422", async () => {
    ctx();
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: '{"personen":[{"name":"Müller","tage":[["2026-11' }] });
    const res = await POST(req(IMG));
    expect(res.status).toBe(422);
    expect(JSON.stringify(mockCreate.mock.calls[0]![0])).not.toContain("Woche ab Montag");
  });
});
