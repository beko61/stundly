/**
 * Navigations-App für Adressen (Notdienst) — pro Gerät gespeichert (localStorage), weil die
 * installierten Apps je Gerät verschieden sind. Einstellung: Profil → "Navigation".
 *
 * Blitzer.de bietet (Stand 10/2026) keinen öffentlichen Link, der eine Adresse übernimmt;
 * auf Android kann "Jedes Mal fragen" alle installierten Navi-Apps anbieten.
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

/** Synchron im Klick aufrufen (mobile Browser blockieren Öffnen nach await). */
export function openNavigation(address: string): void {
  if (!address.trim()) return;
  const url = navUrl(getNavApp(), address);
  if (url.startsWith("https://")) window.open(url, "_blank");
  else window.location.href = url; // geo: — Android zeigt die App-Auswahl
}
