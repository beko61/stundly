import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Migration 039: Super-Admin ist ein eigenes Merkmal (profiles.is_super_admin), role = Rolle in der Firma.
 *  - Super-Admin-Panel nur mit is_super_admin
 *  - Firmenrechte nur mit role = company_admin (Super-Admin als Mitarbeiter bekommt keine)
 *  - Entfernt/deaktiviert eine Firma den Super-Admin, bleibt sein Konto offen
 */
const h = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } } }),
      signOut: h.signOut,
    },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: h.profile }) }) }) }),
  }),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => { throw new Error(`REDIRECT ${to}`); },
}));
vi.mock("@/components/ui/Sidebar", () => ({ Sidebar: () => null }));
vi.mock("@/components/ui/BottomNav", () => ({ BottomNav: () => null }));
vi.mock("@/components/ui/OfflineSync", () => ({ OfflineSync: () => null }));

import { checkSuperAdmin } from "@/lib/superadmin/auth";
import { getCompanyAdminContext } from "@/lib/company/admin";
import DashboardLayout from "@/app/(dashboard)/layout";

beforeEach(() => {
  h.profile = null;
  h.signOut.mockClear();
});

describe("checkSuperAdmin", () => {
  it("lässt nur is_super_admin = true durch", async () => {
    h.profile = { is_super_admin: true };
    expect(await checkSuperAdmin()).toEqual({ id: "user-1" });
  });

  it("alte Rolle super_admin ohne Merkmal reicht nicht", async () => {
    h.profile = { role: "super_admin", is_super_admin: false };
    expect(await checkSuperAdmin()).toBeNull();
  });
});

describe("getCompanyAdminContext", () => {
  it("Super-Admin als Mitarbeiter einer Firma hat keine Firmenrechte", async () => {
    h.profile = { role: "employee", is_super_admin: true, company_id: "co-1" };
    expect(await getCompanyAdminContext()).toBeNull();
  });

  it("company_admin mit Firma bekommt den Kontext", async () => {
    h.profile = { role: "company_admin", company_id: "co-1" };
    expect((await getCompanyAdminContext())?.companyId).toBe("co-1");
  });
});

describe("Dashboard-Layout: Sperre nach Löschen durch die Firma", () => {
  const render = () => DashboardLayout({ children: null });

  it("normaler Mitarbeiter: gelöscht → abgemeldet", async () => {
    h.profile = { deleted_at: "2026-11-08T10:00:00Z", is_active: false };
    await expect(render()).rejects.toThrow("REDIRECT /login?blocked=deleted");
    expect(h.signOut).toHaveBeenCalled();
  });

  it("Super-Admin: gelöscht/deaktiviert durch die Firma → Konto bleibt offen", async () => {
    h.profile = { deleted_at: "2026-11-08T10:00:00Z", is_active: false, is_super_admin: true };
    await expect(render()).resolves.toBeTruthy();
    expect(h.signOut).not.toHaveBeenCalled();
  });
});
