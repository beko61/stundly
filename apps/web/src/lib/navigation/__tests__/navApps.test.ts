import { describe, it, expect, vi, beforeEach } from "vitest";
import { getNavApp, navAppLabel, navUrl, openNavigation, setNavApp } from "../navApps";

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

  it("Teilen-Menü: navigator.share mit Adresse und Apple-Karten-Link; ohne Teilen → Google Maps", () => {
    setNavApp("share");
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    openNavigation(ADR);
    expect(share).toHaveBeenCalledWith({ text: ADR, url: `https://maps.apple.com/?q=${Q}` });

    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    openNavigation(ADR);
    expect(open).toHaveBeenCalledWith(`https://www.google.com/maps/search/?api=1&query=${Q}`, "_blank");
    open.mockRestore();
  });
});
