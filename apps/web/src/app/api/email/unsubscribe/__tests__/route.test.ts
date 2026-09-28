// @vitest-environment node
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ update: vi.fn(), eq: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({ update: (v: unknown) => { h.update(v); return { eq: (...a: unknown[]) => h.eq(...a) }; } }),
  }),
}));

import { GET, POST } from "../route";
import { unsubscribeToken } from "@/lib/email/reminders";

beforeAll(() => {
  process.env.CRON_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "srk";
});
beforeEach(() => { h.update.mockReset(); h.eq.mockReset().mockResolvedValue({ error: null }); });

const url = (u: string, t: string) => `https://stundly.de/api/email/unsubscribe?u=${u}&t=${t}`;

describe("/api/email/unsubscribe", () => {
  it("GET zeigt nur Bestätigung — ändert nichts (Mail-Scanner)", async () => {
    const res = await GET(new Request(url("u1", unsubscribeToken("u1"))));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Ja, abbestellen");
    expect(h.update).not.toHaveBeenCalled();
  });

  it("POST mit gültigem Token → reminder_emails_enabled=false", async () => {
    const res = await POST(new Request(url("u1", unsubscribeToken("u1")), { method: "POST", body: "List-Unsubscribe=One-Click" }));
    expect(res.status).toBe(200);
    expect(h.update).toHaveBeenCalledWith({ reminder_emails_enabled: false });
    expect(h.eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("falscher Token → 400, nichts geändert", async () => {
    const res = await POST(new Request(url("u1", unsubscribeToken("u2")), { method: "POST" }));
    expect(res.status).toBe(400);
    expect(h.update).not.toHaveBeenCalled();
    expect((await GET(new Request(url("u1", "x")))).status).toBe(400);
  });
});
