import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  user: { id: "me" } as { id: string } | null,
  nd: null as Record<string, unknown> | null,
  companyId: "co-1" as string | null,
  updates: [] as Record<string, unknown>[],
  audit: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) } }),
}));
vi.mock("@/lib/audit/logger", () => ({ logAudit: (...a: unknown[]) => h.audit(...a) }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      const c: Record<string, unknown> = {};
      c.select = () => c; c.eq = () => c;
      c.maybeSingle = async () => ({ data: table === "profiles" ? { company_id: h.companyId } : h.nd });
      c.update = (row: Record<string, unknown>) => { h.updates.push(row); return { eq: async () => ({ error: null }) }; };
      return c;
    },
  }),
}));

import { POST } from "../route";

const ID = "11111111-1111-4111-8111-111111111111";
const post = (body: unknown, id = ID) => POST(new NextRequest("http://l/api/notdienst/x/erhalten", {
  method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
}), { params: Promise.resolve({ id }) });

beforeEach(() => {
  h.user = { id: "me" };
  h.nd = { id: ID, user_id: "me", date: "2026-10-04", erledigt: false, ueberwiesen_am: "2026-11-01T10:00:00Z" };
  h.companyId = "co-1";
  h.updates = [];
  h.audit.mockReset();
});

describe("POST /api/notdienst/[id]/erhalten", () => {
  it("Mitarbeiter bestätigt überwiesenen Einsatz → bezahlt + Audit", async () => {
    const res = await post({ erhalten: true });
    expect(res.status).toBe(200);
    expect(h.updates).toEqual([{ erledigt: true }]);
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "notdienst.payment_confirmed", companyId: "co-1", actorUserId: "me" }));
  });

  it("noch nicht überwiesen → 409, nichts geändert", async () => {
    h.nd!.ueberwiesen_am = null;
    expect((await post({ erhalten: true })).status).toBe(409);
    expect(h.updates).toHaveLength(0);
  });

  it("fremder Einsatz → 404; ohne Firma → 400; nicht angemeldet → 401", async () => {
    h.nd!.user_id = "someone-else";
    expect((await post({ erhalten: true })).status).toBe(404);
    h.nd!.user_id = "me"; h.companyId = null;
    expect((await post({ erhalten: true })).status).toBe(400);
    h.user = null;
    expect((await post({ erhalten: true })).status).toBe(401);
    expect(h.updates).toHaveLength(0);
  });

  it("Bestätigung zurücknehmen (nicht erhalten) → wieder offen", async () => {
    h.nd!.erledigt = true;
    expect((await post({ erhalten: false })).status).toBe(200);
    expect(h.updates).toEqual([{ erledigt: false }]);
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "notdienst.payment_disputed" }));
  });
});
