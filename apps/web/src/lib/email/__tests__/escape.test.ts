import { describe, it, expect, vi } from "vitest";

vi.mock("resend", () => ({ Resend: class { emails = { send: vi.fn() }; } }));

import { esc, subj } from "../resend";

describe("Mail-HTML: Firmen-/Nutzereingaben werden maskiert", () => {
  it("HTML-Zeichen werden zu Entities (kein Link/Script aus dem Firmennamen)", () => {
    expect(esc('Muster <a href="https://evil.example">Login</a>')).toBe(
      "Muster &lt;a href=&quot;https://evil.example&quot;&gt;Login&lt;/a&gt;",
    );
    expect(esc("O'Brien & Söhne")).toBe("O&#39;Brien &amp; Söhne");
    expect(esc(null)).toBe("");
    expect(esc(12)).toBe("12");
  });
  it("Betreff ohne Zeilenumbrüche (Header-Injection), höchstens 200 Zeichen", () => {
    expect(subj("Einladung zu Firma\r\nBcc: x@y.de")).toBe("Einladung zu Firma Bcc: x@y.de");
    expect(subj("x".repeat(300))).toHaveLength(200);
  });
});
