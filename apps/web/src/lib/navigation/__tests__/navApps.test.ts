import { describe, it, expect, vi, beforeEach } from "vitest";
import { getNavApp, iosAppUrl, navAppLabel, navUrl, openNavigation, setNavApp } from "../navApps";

const ADR = "Musterstraße 1, 30159 Hannover";
const Q = encodeURIComponent(ADR);

describe("navUrl", () => {
  it("baut für jede App den passenden Link", () => {
    expect(navUrl("google", ADR)).toBe(`https://www.google.com/maps/search/?api=1&query=${Q}`);
    expect(navUrl("apple", ADR)).toBe(`https://maps.apple.com/?q=${Q}`);
    expect(navUrl("waze", ADR)).toBe(`https://waze.com/ul?q=${Q}&navigate=yes`);
    expect(navUrl("yandex", ADR)).toBe(`https://yandex.com/maps/?text=${Q}`);
    expect(navUrl("ask", ADR)).toBe(`geo:0,0?q=${Q}`);
  });
});

describe("Einstellung pro Gerät", () => {
  beforeEach(() => localStorage.clear());

  it("Standard ist Google Maps, unbekannte Werte fallen darauf zurück", () => {
    expect(getNavApp()).toBe("google");
    localStorage.setItem("stundly_nav_app", "blitzer");
    expect(getNavApp()).toBe("google");
  });

  it("gespeicherte Wahl wird gelesen, Label passt", () => {
    setNavApp("waze");
    expect(getNavApp()).toBe("waze");
    expect(navAppLabel()).toBe("Waze");
  });
});

describe("openNavigation", () => {
  beforeEach(() => localStorage.clear());

  it("https-Links öffnen ein neues Fenster, leere Adresse tut nichts", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    setNavApp("apple");
    openNavigation(ADR);
    expect(open).toHaveBeenCalledWith(`https://maps.apple.com/?q=${Q}`, "_blank");
    open.mockClear();
    openNavigation("   ");
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });
});

describe("iPhone: App direkt per Schema (kein leeres Browserfenster)", () => {
  const ua = navigator.userAgent;
  beforeEach(() => localStorage.clear());

  it("Schema je App", () => {
    expect(iosAppUrl("apple", ADR)).toBe(`maps://?q=${Q}`);
    expect(iosAppUrl("google", ADR)).toBe(`comgooglemaps://?q=${Q}`);
    expect(iosAppUrl("waze", ADR)).toBe(`waze://?q=${Q}&navigate=yes`);
    expect(iosAppUrl("yandex", ADR)).toBe(`yandexmaps://maps.yandex.ru/?text=${Q}`);
    expect(iosAppUrl("ask", ADR)).toBe(`maps://?q=${Q}`);
  });

  it("auf dem iPhone kein window.open, sondern location.href mit Schema", () => {
    Object.defineProperty(navigator, "userAgent", { value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", configurable: true });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const loc = window.location;
    const fake = { href: "" };
    Object.defineProperty(window, "location", { value: fake, configurable: true });
    try {
      setNavApp("apple");
      openNavigation(ADR);
      expect(fake.href).toBe(`maps://?q=${Q}`);
      expect(open).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "location", { value: loc, configurable: true });
      Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });
      open.mockRestore();
    }
  });
});
