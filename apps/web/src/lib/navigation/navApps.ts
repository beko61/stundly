/**
 * Navigations-App für Adressen (Notdienst) — pro Gerät gespeichert (localStorage), weil die
 * installierten Apps je Gerät verschieden sind. Einstellung: Profil → "Navigation".
 *
 * Blitzer.de übernimmt keine Adressen aus anderen Apps: kein öffentlicher Link (Stand 10/2026), und im
 * iOS-Teilen-Menü erscheint die App nicht (am iPhone getestet 18.10.2026). Empfehlung: mit Apple/Google
 * navigieren, Blitzer.de warnt im Hintergrund. Android: "Jedes Mal fragen" (geo:) zeigt installierte Navi-Apps.
 */

export type NavAppId = "google" | "apple" | "waze" | "yandex" | "ask";

export const NAV_APPS: { id: NavAppId; label: string; hint?: string }[] = [
  { id: "google", label: "Google Maps" },
  { id: "apple",  label: "Apple Karten", hint: "iPhone / iPad" },
  { id: "waze",   label: "Waze" },
  { id: "yandex", label: "Yandex Karten" },
  { id: "ask",    label: "Jedes Mal fragen", hint: "nur Android — zeigt alle installierten Navi-Apps" },
];

const STORAGE_KEY = "stundly_nav_app";
const DEFAULT: NavAppId = "google";

export function navUrl(app: NavAppId, address: string): string {
  const q = encodeURIComponent(address.trim());
  switch (app) {
    case "apple":  return `https://maps.apple.com/?q=${q}`;
    case "waze":   return `https://waze.com/ul?q=${q}&navigate=yes`;
    case "yandex": return `https://yandex.com/maps/?text=${q}`;
    case "ask":    return `geo:0,0?q=${q}`;
    default:       return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }
}

export function getNavApp(): NavAppId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && NAV_APPS.some((a) => a.id === v)) return v as NavAppId;
  } catch {}
  return DEFAULT;
}

export function setNavApp(app: NavAppId): void {
  try { localStorage.setItem(STORAGE_KEY, app); } catch {}
}

export function navAppLabel(app: NavAppId = getNavApp()): string {
  return NAV_APPS.find((a) => a.id === app)?.label ?? "Google Maps";
}

/**
 * iPhone/iPad: App direkt über ihr URL-Schema starten. window.open öffnet in der Home-Bildschirm-App
 * erst ein leeres Browserfenster, das nach der Rückkehr als weiße Seite stehen bleibt.
 * Die gewählte App muss installiert sein (Apple Karten ist es immer).
 */
export function iosAppUrl(app: NavAppId, address: string): string {
  const q = encodeURIComponent(address.trim());
  switch (app) {
    case "google": return `comgooglemaps://?q=${q}`;
    case "waze":   return `waze://?q=${q}&navigate=yes`;
    case "yandex": return `yandexmaps://maps.yandex.ru/?text=${q}`;
    default:       return `maps://?q=${q}`; // Apple Karten; "Jedes Mal fragen" gibt es auf iOS nicht
  }
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS meldet sich als Mac
}

/** Synchron im Klick aufrufen (mobile Browser blockieren Öffnen nach await). */
export function openNavigation(address: string): void {
  if (!address.trim()) return;
  const app = getNavApp();
  if (isIOS()) {
    window.location.href = iosAppUrl(app, address); // Schema: Seite bleibt, App öffnet sich
    return;
  }
  const url = navUrl(app, address);
  if (url.startsWith("https://")) window.open(url, "_blank");
  else window.location.href = url; // geo: — Android zeigt die App-Auswahl
}
