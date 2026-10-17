import { describe, it, expect } from "vitest";
import { cleanPath, fingerprint, groupErrors, sanitizeErrorPayload, shouldIgnore, type ErrorRow } from "../errorEvents";
import { buildErrorDigest } from "@/lib/email/errorDigest";

describe("sanitizeErrorPayload", () => {
  it("kürzt Felder und entfernt Query/Hash aus dem Pfad (Tokens)", () => {
    const p = sanitizeErrorPayload({ message: "x".repeat(900), path: "/reset-password?token=geheim#a", stack: 5 });
    expect(p!.message).toHaveLength(500);
    expect(p!.path).toBe("/reset-password");
    expect(p!.stack).toBeNull();
  });

  it("ohne Meldung oder kein Objekt → null", () => {
    expect(sanitizeErrorPayload({ message: "  " })).toBeNull();
    expect(sanitizeErrorPayload("boom")).toBeNull();
    expect(sanitizeErrorPayload(null)).toBeNull();
  });

  it("cleanPath", () => {
    expect(cleanPath("/tracker")).toBe("/tracker");
    expect(cleanPath(undefined)).toBeNull();
  });
});

describe("shouldIgnore", () => {
  it("Netzwerk- und Browser-Rauschen sowie Next-Steuerfluss werden ignoriert", () => {
    for (const m of ["Failed to fetch", "Load failed", "ResizeObserver loop limit exceeded", "Script error.", "NEXT_REDIRECT", "NEXT_NOT_FOUND"]) {
      expect(shouldIgnore(m)).toBe(true);
    }
    expect(shouldIgnore("Cannot read properties of undefined (reading 'map')")).toBe(false);
  });
});

describe("fingerprint", () => {
  it("gleiche Meldung mit anderen Zahlen/IDs → gleicher Fingerprint, anderer Ort → anderer", () => {
    const a = fingerprint("Eintrag 123 fehlt (a1b2c3d4-0000-1111-2222-333344445555)", "window.error");
    const b = fingerprint("Eintrag 98 fehlt (ffffffff-0000-1111-2222-333344445555)", "window.error");
    expect(a).toBe(b);
    expect(fingerprint("Eintrag 1 fehlt", "global-error")).not.toBe(fingerprint("Eintrag 1 fehlt", "window.error"));
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });
});

const row = (o: Partial<ErrorRow>): ErrorRow => ({
  id: 1, created_at: "2026-10-17T10:00:00Z", source: "client", fingerprint: "aaaa", message: "boom",
  user_id: null, stack: null, location: null, path: null, digest: null, app_version: null, ...o,
});

describe("groupErrors", () => {
  it("zählt je Fingerprint, Nutzer eindeutig, neueste Gruppe zuerst, letzte Werte gewinnen", () => {
    const g = groupErrors([
      row({ id: 1, fingerprint: "a", created_at: "2026-10-17T08:00:00Z", user_id: "u1", path: "/tracker", app_version: "0.81.3" }),
      row({ id: 2, fingerprint: "a", created_at: "2026-10-17T09:00:00Z", user_id: "u1", path: "/reports", app_version: "0.82.0" }),
      row({ id: 3, fingerprint: "a", created_at: "2026-10-17T09:30:00Z", user_id: "u2" }),
      row({ id: 4, fingerprint: "b", created_at: "2026-10-17T12:00:00Z", source: "server" }),
    ]);
    expect(g.map((x) => x.fingerprint)).toEqual(["b", "a"]);
    expect(g[1]).toMatchObject({
      count: 3, users: 2, firstSeen: "2026-10-17T08:00:00Z", lastSeen: "2026-10-17T09:30:00Z",
      lastPath: "/reports", lastVersion: "0.82.0",
    });
  });
});

describe("buildErrorDigest", () => {
  it("Betreff mit Summe und Gruppen, HTML maskiert, höchstens 10 Gruppen", () => {
    const groups = groupErrors(Array.from({ length: 12 }, (_, i) =>
      row({ id: i, fingerprint: `f${i}`, message: i === 0 ? "<script>x</script>" : `Fehler ${i}` })));
    const { subject, html } = buildErrorDigest(groups, 15);
    expect(subject).toBe("Stundly: son 24 saatte 15 hata (12 farklı)");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("+2 grup daha");
    expect(html).toContain("/superadmin/errors");
  });
});
