// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  caller: { id: "me" } as { id: string } | null,
  authUser: { id: "u1", email: "kunde@x.de", email_confirmed_at: null as string | null },
  inserts: [] as { table: string; row: Record<string, unknown> }[],
  updates: [] as Record<string, unknown>[],
  reset: vi.fn(),
  resend: vi.fn(),
}));

vi.mock("@/lib/superadmin/auth", () => ({
  checkSuperAdmin: async () => h.caller,
  adminClient: () => ({
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => { h.inserts.push({ table, row }); return { error: null }; },
      update: (row: Record<string, unknown>) => { h.updates.push(row); return { eq: async () => ({ error: null }) }; },
    }),
    auth: {
      admin: { getUserById: async () => ({ data: { user: h.authUser } }) },
      resetPasswordForEmail: (...a: unknown[]) => h.reset(...a),
      resend: (...a: unknown[]) => h.resend(...a),
    },
  }),
}));

import { POST, PATCH } from "../[id]/route";

const ctx = (id = "u1") => ({ params: Promise.resolve({ id }) });
const post = (body: unknown, id?: string) => POST(new Request("https://x", { method: "POST", body: JSON.stringify(body) }) as never, ctx(id));
const patch = (body: unknown, id?: string) => PATCH(new Request("https://x", { method: "PATCH", body: JSON.stringify(body) }) as never, ctx(id));

beforeEach(() => {
  h.caller = { id: "me" };
  h.authUser = { id: "u1", email: "kunde@x.de", email_confirmed_at: null };
  h.inserts = []; h.updates = [];
  h.reset.mockReset().mockResolvedValue({ error: null });
  h.resend.mockReset().mockResolvedValue({ error: null });
});

describe("/api/superadmin/users/[id]", () => {
  it("POST reset_password → Supabase-Mail + Audit", async () => {
    const res = await post({ action: "reset_password" });
    expect(res.status).toBe(200);
    expect(h.reset).toHaveBeenCalledWith("kunde@x.de", { redirectTo: expect.stringMatching(/\/reset-password$/) });
    expect(h.inserts[0]).toMatchObject({ table: "audit_log", row: { action: "superadmin.reset_password", resource_id: "u1" } });
  });

  it("POST resend_confirmation nur bei unbestätigter E-Mail", async () => {
    expect((await post({ action: "resend_confirmation" })).status).toBe(200);
    expect(h.resend).toHaveBeenCalledWith({ type: "signup", email: "kunde@x.de" });
    h.authUser.email_confirmed_at = "2026-09-01";
    expect((await post({ action: "resend_confirmation" })).status).toBe(400);
  });

  it("POST unbekannte Aktion / kein Super-Admin", async () => {
    expect((await post({ action: "hack" })).status).toBe(400);
    h.caller = null;
    expect((await post({ action: "reset_password" })).status).toBe(403);
  });

  it("PATCH: sich selbst nicht deaktivieren; Änderungen werden protokolliert", async () => {
    expect((await patch({ is_active: false }, "me")).status).toBe(400);
    expect(h.updates).toEqual([]);
    expect((await patch({ role: "employee" })).status).toBe(200);
    expect(h.inserts[0]).toMatchObject({ table: "audit_log", row: { action: "superadmin.user_role_changed", payload: { role: "employee" } } });
  });
});
