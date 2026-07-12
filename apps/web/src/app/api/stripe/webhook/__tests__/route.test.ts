import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Env defaults ─────────────────────────────────────────────────────────────
// Route Stripe secret + Supabase env okuyor. Test öncesi set edilmiş olmalı.
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_test";
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "srv-key";
process.env.STRIPE_PRICE_TEAM_MONTHLY = "price_team_m";
process.env.STRIPE_PRICE_INDIVIDUAL_MONTHLY = "price_ind_m";

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockConstructEvent = vi.fn();
const mockRetrieveSub    = vi.fn();
const mockSendEmail      = vi.fn().mockResolvedValue(undefined);
const mockCreateAdmin    = vi.fn();

vi.mock("@/lib/stripe/server", () => ({
  stripe: {
    webhooks: { constructEvent: (...a: unknown[]) => mockConstructEvent(...a) },
    subscriptions: { retrieve: (...a: unknown[]) => mockRetrieveSub(...a) },
  },
}));

vi.mock("@/lib/email/resend", () => ({
  sendSubscriptionConfirmationEmail: (...a: unknown[]) => mockSendEmail(...a),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...a: unknown[]) => mockCreateAdmin(...a),
}));

// ── Test helpers ─────────────────────────────────────────────────────────────
type TableCalls = {
  webhookEventsSelect?: { processed: boolean } | null;
  webhookInsertError?: { message: string } | null;
};

/**
 * In-memory Supabase admin mock. from(table) çağrısı tabloya göre
 * konfigürasyona uygun chain döner. Test sonunda calls array'i incelenir.
 */
function makeAdmin(opts: TableCalls = {}) {
  const calls = {
    subscriptionsUpsert: null as unknown,
    subscriptionsUpsertOpts: null as unknown,
    subscriptionsUpdate: null as unknown,
    profilesUpdate: null as unknown,
    profilesUpdateWhere: null as unknown,
    webhookInsert: null as unknown,
    webhookUpdate: null as unknown,
    profileSelectQuery: null as unknown,
  };

  return {
    calls,
    from: (table: string) => {
      if (table === "stripe_webhook_events") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: opts.webhookEventsSelect ?? null }),
            }),
          }),
          insert: (payload: unknown) => {
            calls.webhookInsert = payload;
            return Promise.resolve({ error: opts.webhookInsertError ?? null });
          },
          update: (payload: unknown) => {
            calls.webhookUpdate = payload;
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      }

      if (table === "subscriptions") {
        return {
          upsert: (payload: unknown, upsertOpts?: unknown) => {
            calls.subscriptionsUpsert = payload;
            calls.subscriptionsUpsertOpts = upsertOpts;
            return Promise.resolve({ error: null });
          },
          update: (payload: unknown) => {
            calls.subscriptionsUpdate = payload;
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      }

      if (table === "profiles") {
        return {
          select: () => ({
            eq: (_col: string, _val: unknown) => ({
              // company_admin lookup ("role" ile 2. eq)
              eq: () => ({
                limit: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: { email: "admin@co.de", vorname: "Anna", full_name: "Anna Admin" },
                    }),
                }),
              }),
              maybeSingle: () =>
                Promise.resolve({
                  data: { email: "user@x.de", vorname: "Max", full_name: "Max M." },
                }),
            }),
          }),
          update: (payload: unknown) => {
            calls.profilesUpdate = payload;
            return {
              eq: (col: string, val: unknown) => {
                calls.profilesUpdateWhere = { col, val };
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }

      throw new Error("Unexpected table in webhook: " + table);
    },
  };
}

function makeReq(body: string, sig: string | null) {
  const headers: Record<string, string> = {};
  if (sig !== null) headers["stripe-signature"] = sig;
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    body,
    headers,
  });
}

// ── Suite ────────────────────────────────────────────────────────────────────
describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockClear();
    mockSendEmail.mockResolvedValue(undefined);
  });

  it("400 — signature header yok", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeReq("{}", null));
    expect(res.status).toBe(400);
  });

  it("400 — invalid signature (constructEvent throw eder)", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });
    const admin = makeAdmin();
    mockCreateAdmin.mockReturnValue(admin);

    const { POST } = await import("../route");
    const res = await POST(makeReq("{}", "sig_bad"));

    expect(res.status).toBe(400);
    // Idempotency insert olmadı — signature verify ilk gate
    expect(admin.calls.webhookInsert).toBeNull();
  });

  it("200 — duplicate event: processed=true ise handler çalışmaz", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_dup",
      type: "checkout.session.completed",
      data: { object: {} },
    });
    const admin = makeAdmin({ webhookEventsSelect: { processed: true } });
    mockCreateAdmin.mockReturnValue(admin);

    const { POST } = await import("../route");
    const res = await POST(makeReq("{}", "sig"));

    expect(res.status).toBe(200);
    const json = (await res.json()) as { received: boolean; duplicate: boolean };
    expect(json.duplicate).toBe(true);
    // Handler çağrılmadı — Stripe subscription retrieve yok
    expect(mockRetrieveSub).not.toHaveBeenCalled();
    expect(admin.calls.subscriptionsUpsert).toBeNull();
  });

  it("200 — checkout.session.completed: company subscription upsert + plan update + email", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_checkout_1",
      type: "checkout.session.completed",
      data: {
        object: {
          customer: "cus_1",
          subscription: "sub_1",
          metadata: { company_id: "co-1", user_id: "" },
          customer_details: { email: "billing@co.de", name: "Anna Admin" },
        },
      },
    });
    mockRetrieveSub.mockResolvedValue({
      id: "sub_1",
      status: "active",
      cancel_at_period_end: false,
      current_period_start: 1_700_000_000,
      current_period_end:   1_702_000_000,
      items: { data: [{ price: { id: "price_team_m", unit_amount: 1990, recurring: { interval: "month" } } }] },
      metadata: {},
      customer: "cus_1",
    });
    const admin = makeAdmin();
    mockCreateAdmin.mockReturnValue(admin);

    const { POST } = await import("../route");
    const res = await POST(makeReq("{}", "sig"));

    expect(res.status).toBe(200);

    // subscriptions upsert
    const sub = admin.calls.subscriptionsUpsert as Record<string, unknown>;
    expect(sub.company_id).toBe("co-1");
    expect(sub.user_id).toBeNull();
    expect(sub.plan).toBe("team");
    expect(sub.status).toBe("active");
    expect(sub.stripe_subscription_id).toBe("sub_1");
    expect((admin.calls.subscriptionsUpsertOpts as { onConflict: string }).onConflict).toBe(
      "stripe_subscription_id"
    );

    // profiles.plan update — company_id ile
    expect((admin.calls.profilesUpdate as { plan: string }).plan).toBe("team");
    expect((admin.calls.profilesUpdateWhere as { col: string; val: string }).col).toBe("company_id");
    expect((admin.calls.profilesUpdateWhere as { col: string; val: string }).val).toBe("co-1");

    // email gönderildi
    expect(mockSendEmail).toHaveBeenCalledOnce();
    const emailArg = mockSendEmail.mock.calls[0]?.[0] as { to: string; planName: string };
    expect(emailArg.to).toBe("billing@co.de");
    expect(emailArg.planName).toBe("Team");

    // idempotency mark processed
    expect((admin.calls.webhookUpdate as { processed: boolean }).processed).toBe(true);
  });

  it("200 — checkout: individual user path (companyId yoksa user_id + profile lookup)", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_checkout_ind",
      type: "checkout.session.completed",
      data: {
        object: {
          customer: "cus_2",
          subscription: "sub_2",
          metadata: { company_id: "", user_id: "user-1" },
          customer_details: null,
        },
      },
    });
    mockRetrieveSub.mockResolvedValue({
      id: "sub_2",
      status: "trialing",
      cancel_at_period_end: false,
      current_period_start: 1_700_000_000,
      current_period_end:   1_702_000_000,
      items: { data: [{ price: { id: "price_ind_m", unit_amount: 990, recurring: { interval: "month" } } }] },
      metadata: {},
      customer: "cus_2",
    });
    const admin = makeAdmin();
    mockCreateAdmin.mockReturnValue(admin);

    const { POST } = await import("../route");
    const res = await POST(makeReq("{}", "sig"));

    expect(res.status).toBe(200);
    const sub = admin.calls.subscriptionsUpsert as Record<string, unknown>;
    expect(sub.company_id).toBeNull();
    expect(sub.user_id).toBe("user-1");
    expect(sub.plan).toBe("individual");

    expect((admin.calls.profilesUpdateWhere as { col: string }).col).toBe("user_id");
    // Email profile lookup'tan geldi
    expect(mockSendEmail).toHaveBeenCalledOnce();
    const emailArg = mockSendEmail.mock.calls[0]?.[0] as { to: string };
    expect(emailArg.to).toBe("user@x.de");
  });

  it("200 — checkout: bilinmeyen priceId → default individual", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_unknown_price",
      type: "checkout.session.completed",
      data: {
        object: {
          customer: "cus_3",
          subscription: "sub_3",
          metadata: { company_id: "co-x", user_id: "" },
          customer_details: { email: "x@x.de", name: "X" },
        },
      },
    });
    mockRetrieveSub.mockResolvedValue({
      id: "sub_3", status: "active", cancel_at_period_end: false,
      current_period_start: 1_700_000_000, current_period_end: 1_702_000_000,
      items: { data: [{ price: { id: "price_unknown_xxx", unit_amount: 500 } }] },
      metadata: {}, customer: "cus_3",
    });
    const admin = makeAdmin();
    mockCreateAdmin.mockReturnValue(admin);

    const { POST } = await import("../route");
    const res = await POST(makeReq("{}", "sig"));

    expect(res.status).toBe(200);
    expect((admin.calls.subscriptionsUpsert as { plan: string }).plan).toBe("individual");
  });

  it("200 — customer.subscription.updated: status + period + cancel_at_period_end", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_sub_upd",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_upd",
          status: "past_due",
          cancel_at_period_end: true,
          current_period_start: 1_710_000_000,
          current_period_end:   1_712_000_000,
          items: { data: [] },
          metadata: {},
          customer: "cus_x",
        },
      },
    });
    const admin = makeAdmin();
    mockCreateAdmin.mockReturnValue(admin);

    const { POST } = await import("../route");
    const res = await POST(makeReq("{}", "sig"));

    expect(res.status).toBe(200);
    const upd = admin.calls.subscriptionsUpdate as Record<string, unknown>;
    expect(upd.status).toBe("past_due");
    expect(upd.cancel_at_period_end).toBe(true);
    expect(upd.current_period_start).toBe(new Date(1_710_000_000_000).toISOString());
    expect(upd.current_period_end).toBe(new Date(1_712_000_000_000).toISOString());
  });

  it("200 — customer.subscription.deleted: status=canceled + canceled_at", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_sub_del",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_del",
          status: "canceled",
          cancel_at_period_end: false,
          current_period_start: 1_700_000_000,
          current_period_end:   1_702_000_000,
          items: { data: [] },
          metadata: {},
          customer: "cus_y",
        },
      },
    });
    const admin = makeAdmin();
    mockCreateAdmin.mockReturnValue(admin);

    const { POST } = await import("../route");
    const res = await POST(makeReq("{}", "sig"));

    expect(res.status).toBe(200);
    const upd = admin.calls.subscriptionsUpdate as Record<string, unknown>;
    expect(upd.status).toBe("canceled");
    expect(typeof upd.canceled_at).toBe("string");
  });

  it("200 — invoice.payment_failed: past_due (string subscription)", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_inv_fail_1",
      type: "invoice.payment_failed",
      data: { object: { subscription: "sub_fail" } },
    });
    const admin = makeAdmin();
    mockCreateAdmin.mockReturnValue(admin);

    const { POST } = await import("../route");
    const res = await POST(makeReq("{}", "sig"));

    expect(res.status).toBe(200);
    expect((admin.calls.subscriptionsUpdate as { status: string }).status).toBe("past_due");
  });

  it("200 — invoice.payment_failed: subscription null → skip (no update)", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_inv_fail_null",
      type: "invoice.payment_failed",
      data: { object: { subscription: null } },
    });
    const admin = makeAdmin();
    mockCreateAdmin.mockReturnValue(admin);

    const { POST } = await import("../route");
    const res = await POST(makeReq("{}", "sig"));

    expect(res.status).toBe(200);
    expect(admin.calls.subscriptionsUpdate).toBeNull();
  });

  it("500 — handler throw: processed=false, error kaydedilir", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_throw",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_throw",
          status: "active",
          cancel_at_period_end: false,
          current_period_start: 1_700_000_000,
          current_period_end:   1_702_000_000,
          items: { data: [] },
          metadata: {},
          customer: "cus_z",
        },
      },
    });

    // subscriptions.update chain'inde exception
    const boom = {
      from: (table: string) => {
        if (table === "stripe_webhook_events") {
          const capturedUpdate: Record<string, unknown> = {};
          return {
            select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
            insert: () => Promise.resolve({ error: null }),
            update: (payload: Record<string, unknown>) => {
              Object.assign(capturedUpdate, payload);
              // Test yakalayabilsin diye state referansı taşı
              (boom as unknown as { _errUpdate: Record<string, unknown> })._errUpdate = capturedUpdate;
              return { eq: () => Promise.resolve({ error: null }) };
            },
          };
        }
        if (table === "subscriptions") {
          return {
            update: () => ({
              eq: () => {
                throw new Error("DB down");
              },
            }),
          };
        }
        throw new Error("Unexpected: " + table);
      },
    };
    mockCreateAdmin.mockReturnValue(boom);

    const { POST } = await import("../route");
    const res = await POST(makeReq("{}", "sig"));

    expect(res.status).toBe(500);
    const errUpdate = (boom as unknown as { _errUpdate: Record<string, unknown> })._errUpdate;
    expect(errUpdate).toBeDefined();
    expect(typeof errUpdate.error).toBe("string");
    // processed=true set edilmedi (error path erken return)
    expect(errUpdate.processed).toBeUndefined();
  });

  it("200 — unknown event type: idempotency insert + processed=true, sessiz geç", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_unknown_type",
      type: "customer.updated",
      data: { object: {} },
    });
    const admin = makeAdmin();
    mockCreateAdmin.mockReturnValue(admin);

    const { POST } = await import("../route");
    const res = await POST(makeReq("{}", "sig"));

    expect(res.status).toBe(200);
    expect((admin.calls.webhookUpdate as { processed: boolean }).processed).toBe(true);
    // Hiçbir subscription/profile handler tetiklenmedi
    expect(admin.calls.subscriptionsUpsert).toBeNull();
    expect(admin.calls.subscriptionsUpdate).toBeNull();
    expect(admin.calls.profilesUpdate).toBeNull();
  });

  it("200 — checkout email gönderimi fail olsa bile 200 döner", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_email_fail",
      type: "checkout.session.completed",
      data: {
        object: {
          customer: "cus_e",
          subscription: "sub_e",
          metadata: { company_id: "co-e", user_id: "" },
          customer_details: { email: "e@e.de", name: "E" },
        },
      },
    });
    mockRetrieveSub.mockResolvedValue({
      id: "sub_e", status: "active", cancel_at_period_end: false,
      current_period_start: 1_700_000_000, current_period_end: 1_702_000_000,
      items: { data: [{ price: { id: "price_team_m", unit_amount: 1990 } }] },
      metadata: {}, customer: "cus_e",
    });
    mockSendEmail.mockRejectedValueOnce(new Error("Resend down"));

    const admin = makeAdmin();
    mockCreateAdmin.mockReturnValue(admin);

    const { POST } = await import("../route");
    const res = await POST(makeReq("{}", "sig"));

    // Email throw etti ama upsert + plan update yapıldı, 200 döndü
    expect(res.status).toBe(200);
    expect((admin.calls.subscriptionsUpsert as { plan: string }).plan).toBe("team");
    expect((admin.calls.webhookUpdate as { processed: boolean }).processed).toBe(true);
  });
});
