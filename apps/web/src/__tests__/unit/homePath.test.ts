import { describe, it, expect } from "vitest";
import { homePathForRole } from "@/lib/auth/homePath";

describe("homePathForRole", () => {
  it("Super-Admin startet im persönlichen Dashboard (Admin Panel über Sidebar)", () => {
    expect(homePathForRole("super_admin")).toBe("/dashboard");
  });
  it("Firmen-Admin startet im Firmen-Panel", () => {
    expect(homePathForRole("company_admin")).toBe("/company/dashboard");
  });
  it("Mitarbeiter / Einzelperson / unbekannt → Dashboard", () => {
    for (const r of ["employee", "individual", null, undefined, ""]) {
      expect(homePathForRole(r)).toBe("/dashboard");
    }
  });
});
