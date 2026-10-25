import { describe, it, expect, vi, beforeEach } from "vitest";
import { reportError, __resetReportedForTests, isChunkLoadError, reloadOnceForChunkError } from "../reportError";

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

describe("Chunk-Fehler nach neuem Deployment", () => {
  beforeEach(() => {
    __resetReportedForTests();
    sessionStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("erkennt typische Meldungen", () => {
    expect(isChunkLoadError(new Error("Loading chunk 9305 failed.\n(error: https://stundly.de/_next/static/chunks/x.js)"))).toBe(true);
    expect(isChunkLoadError(Object.assign(new Error("x"), { name: "ChunkLoadError" }))).toBe(true);
    expect(isChunkLoadError(new Error("Loading CSS chunk 12 failed"))).toBe(true);
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
  });

  it("lädt einmal neu und meldet dann nicht; zweiter Fehler innerhalb einer Minute wird gemeldet", () => {
    const reload = vi.fn();
    const loc = window.location;
    Object.defineProperty(window, "location", { value: { ...loc, reload, pathname: "/reports" }, configurable: true });
    const beacon = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true });
    try {
      reportError(new Error("Loading chunk 9305 failed."), { where: "global-error" });
      expect(reload).toHaveBeenCalledTimes(1);
      expect(beacon).not.toHaveBeenCalled();

      expect(reloadOnceForChunkError(new Error("Loading chunk 9305 failed."))).toBe(false);
      reportError(new Error("Loading chunk 9305 failed."), { where: "global-error" });
      expect(reload).toHaveBeenCalledTimes(1);
      expect(beacon).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, "location", { value: loc, configurable: true });
    }
  });
});
