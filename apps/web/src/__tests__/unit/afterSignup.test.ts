import { describe, it, expect } from "vitest";
import { afterSignupPath } from "@/lib/marketing/afterSignup";

describe("afterSignupPath", () => {
  it("ohne Empfehlung: Auswahl Einzelperson / Unternehmen", () => {
    expect(afterSignupPath({ referred: false, asCompany: false })).toBe("/onboarding/type");
  });

  it("Empfehlungslink / QR eines Kollegen: Auswahl überspringen", () => {
    expect(afterSignupPath({ referred: true, asCompany: false })).toBe("/onboarding/setup?type=individual");
  });

  it("von /firma: direkt zur Firmen-Einrichtung — auch mit Empfehlungscode", () => {
    expect(afterSignupPath({ referred: false, asCompany: true })).toBe("/onboarding/setup?type=company");
    expect(afterSignupPath({ referred: true, asCompany: true })).toBe("/onboarding/setup?type=company");
  });
});
