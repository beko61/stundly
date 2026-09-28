// @vitest-environment node
import { describe, it, expect } from "vitest";
import { referralCode, isReferralCode, inviteUrl, inviteText } from "../referral";

const UID = "3F2A9C10-bb44-4c1d-9e0f-123456789abc";

describe("referral", () => {
  it("Code = erste 8 Hex-Zeichen der User-ID, klein", () => {
    expect(referralCode(UID)).toBe("3f2a9c10");
    expect(isReferralCode("3f2a9c10")).toBe(true);
  });

  it("nur gültige Codes werden übernommen", () => {
    expect(isReferralCode(null)).toBe(false);
    expect(isReferralCode("")).toBe(false);
    expect(isReferralCode("3f2a9c1")).toBe(false);
    expect(isReferralCode("<script>")).toBe(false);
    expect(isReferralCode("3F2A9C10")).toBe(false);
  });

  it("Einladungslink + Text", () => {
    expect(inviteUrl(UID)).toMatch(/\/register\?ref=3f2a9c10$/);
    expect(inviteText(UID)).toContain(inviteUrl(UID));
  });
});
