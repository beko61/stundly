// @vitest-environment node
import { describe, it, expect } from "vitest";
import { computeCockpit, inSegment, type SaUser } from "../metrics";

const NOW = new Date(2026, 8, 28, 12, 0, 0);
const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

const u = (over: Partial<SaUser>): SaUser => ({
  id: "00000000-0000-0000-0000-000000000000", email: "x@x.de", name: null, role: "individual", isActive: true,
  companyId: null, companyName: null, createdAt: ago(40), lastSignInAt: null, emailConfirmed: true,
  lastDataAt: null, entryDays: 0, ndCount: 0, source: null, referredBy: null,
  reminderLastType: null, reminderLastSentAt: null, pendingDeletion: false, ...over,
});

const users: SaUser[] = [
  u({ id: "aaaaaaaa-1111-0000-0000-000000000000", name: "Aktiv", createdAt: ago(0.1), lastDataAt: ago(0.05), entryDays: 3, source: "google" }),
  u({ id: "bbbbbbbb-2222-0000-0000-000000000000", createdAt: ago(5), source: "kollege", referredBy: "aaaaaaaa" }),       // nie genutzt
  u({ id: "cccccccc-3333-0000-0000-000000000000", createdAt: ago(60), lastDataAt: ago(20), entryDays: 40, ndCount: 2,
      reminderLastType: "comeback", reminderLastSentAt: ago(3), referredBy: "aaaaaaaa" }),                                  // inaktiv
  u({ id: "dddddddd-4444-0000-0000-000000000000", createdAt: ago(1), emailConfirmed: false }),                               // neu, unbestätigt
  u({ id: "eeeeeeee-5555-0000-0000-000000000000", role: "super_admin", createdAt: ago(0.2), lastDataAt: ago(0.1), entryDays: 99 }),
];

describe("computeCockpit", () => {
  const c = computeCockpit(users, NOW);

  it("Super-Admins zählen nicht", () => {
    expect(c.total).toBe(4);
  });

  it("Registrierungen heute / 7 / 30 Tage", () => {
    expect([c.signupsToday, c.signups7, c.signups30]).toEqual([1, 3, 3]);
  });

  it("Aktivierung = mindestens ein eigener Eintrag", () => {
    expect(c.activated).toBe(2);
    expect(c.activationRate).toBe(50);
  });

  it("nie genutzt (≥ 2 Tage), inaktiv > 14 Tage, unbestätigt", () => {
    expect(c.neverUsed).toBe(1);        // nur bbbb (dddd ist erst 1 Tag alt)
    expect(c.inactive14).toBe(1);
    expect(c.unconfirmed).toBe(1);
    expect(c.active7).toBe(1);
  });

  it("Tagesreihe: 30 Tage, heute 1 Anmeldung + 1 aktiv", () => {
    expect(c.daily).toHaveLength(30);
    expect(c.daily[29]).toMatchObject({ signups: 1, active: 1 });
  });

  it("Quellen inkl. 'Belirtilmemiş', Top-Empfehler mit Namen", () => {
    expect(c.sources).toContainEqual({ key: "none", label: "Belirtilmemiş", count: 2 });
    expect(c.sources).toContainEqual({ key: "google", label: "Google", count: 1 });
    expect(c.topReferrers).toEqual([{ code: "aaaaaaaa", name: "Aktiv", count: 2 }]);
  });

  it("Erinnerungen der letzten 7 Tage nach Typ", () => {
    expect(c.reminders7).toEqual({ comeback: 1 });
  });
});

describe("inSegment", () => {
  const n = NOW.getTime();
  it("Segmente", () => {
    expect(users.filter((x) => inSegment(x, "never", n)).map((x) => x.id.slice(0, 4))).toEqual(["bbbb", "dddd"]);
    expect(users.filter((x) => inSegment(x, "inactive", n)).map((x) => x.id.slice(0, 4))).toEqual(["cccc"]);
  });
});
