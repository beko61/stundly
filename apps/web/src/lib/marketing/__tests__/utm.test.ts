// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { parseUtm, rememberUtm, currentUtm, utmMeta, utmLabel, _resetUtm } from "../utm";

describe("utm", () => {
  beforeEach(() => _resetUtm());

  it("liest Quelle, Medium, Kampagne (klein)", () => {
    expect(parseUtm("?utm_source=Google&utm_medium=cpc&utm_campaign=notdienst")).toEqual({
      source: "google", medium: "cpc", campaign: "notdienst",
    });
  });

  it("ohne Quelle oder mit freiem Text → nichts", () => {
    expect(parseUtm("?utm_campaign=x")).toBeNull();
    expect(parseUtm("?utm_source=max%40mail.de")).toBeNull();
    expect(parseUtm("?utm_source=" + "a".repeat(41))).toBeNull();
    expect(parseUtm("?utm_source=google&utm_campaign=hallo%20welt")).toEqual({ source: "google" });
  });

  it("erster Treffer bleibt bis zur Registrierung, aktuelle URL hat Vorrang", () => {
    rememberUtm("?utm_source=google&utm_campaign=a");
    rememberUtm("?utm_source=linkedin");
    expect(currentUtm("")).toEqual({ source: "google", campaign: "a" });
    expect(currentUtm("?utm_source=tiktok")).toEqual({ source: "tiktok" });
  });

  it("Metadaten und Anzeige", () => {
    expect(utmMeta(null)).toEqual({});
    expect(utmMeta({ source: "google", campaign: "nd" })).toEqual({ utm_source: "google", utm_campaign: "nd" });
    expect(utmLabel("google", "nd")).toBe("google · nd");
    expect(utmLabel(null, "nd")).toBeNull();
  });
});
