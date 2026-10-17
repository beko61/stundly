import { describe, it, expect, vi, beforeEach } from "vitest";
import { reportError, __resetReportedForTests } from "../reportError";

describe("reportError (Browser)", () => {
  beforeEach(() => {
    __resetReportedForTests();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("schickt die Meldung per sendBeacon an /api/errors, gleiche Meldung nur einmal", async () => {
    const beacon = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true });

    reportError(new Error("kaputt"), { where: "global-error", digest: "123" });
    reportError(new Error("kaputt"), { where: "global-error", digest: "123" });

    expect(beacon).toHaveBeenCalledTimes(1);
    const [url, blob] = beacon.mock.calls[0] as unknown as [string, Blob];
    expect(url).toBe("/api/errors");
    const body = JSON.parse(await blob.text());
    expect(body).toMatchObject({ message: "kaputt", location: "global-error", digest: "123", path: "/" });
    expect(body.app_version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("höchstens 10 Meldungen pro Seitenaufruf", () => {
    const beacon = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true });
    for (let i = 0; i < 15; i++) reportError(new Error(`Fehler ${i}`));
    expect(beacon).toHaveBeenCalledTimes(10);
  });
});
