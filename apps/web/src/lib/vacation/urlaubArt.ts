/**
 * Urlaubsart → Tageseintrag (time_entries). Früher wurde jede Art als "urlaub" gespeichert —
 * Unbezahlter Urlaub zog dann Urlaubstage ab und schrieb 8 h gut. Die Art steht jetzt in `tags`:
 *
 *   Erholungsurlaub            urlaub                     Soll gutgeschrieben · zählt zum Urlaubskonto
 *   Sonder-/Bildungsurlaub     urlaub + Tag               Soll gutgeschrieben · NICHT vom Urlaubskonto
 *   Unbezahlt / Elternzeit     frei + Tag                 keine Gutschrift · Soll entfällt (kein Minus)
 *   Überstundenabbau           frei + Tag                 keine Gutschrift · Soll bleibt → Überstunden sinken
 */
import { DAY_TYPES, type DayType, type UrlaubArt } from "@workly/shared";

export const URLAUB_TAGS = {
  sonderurlaub:      "sonderurlaub",
  bildungsurlaub:    "bildungsurlaub",
  unbezahlt:         "unbezahlt",
  elternzeit:        "elternzeit",
  ueberstundenabbau: "ueberstundenabbau",
} as const;

const NICHT_VOM_KONTO = [URLAUB_TAGS.sonderurlaub, URLAUB_TAGS.bildungsurlaub] as string[];
const OHNE_SOLL = [URLAUB_TAGS.unbezahlt, URLAUB_TAGS.elternzeit] as string[];

export function urlaubEntryFor(art: UrlaubArt): { day_type: DayType; tags: string[] } {
  switch (art) {
    case "Sonderurlaub":       return { day_type: DAY_TYPES.URLAUB, tags: [URLAUB_TAGS.sonderurlaub] };
    case "Bildungsurlaub":     return { day_type: DAY_TYPES.URLAUB, tags: [URLAUB_TAGS.bildungsurlaub] };
    case "Unbezahlter Urlaub": return { day_type: DAY_TYPES.FREI,   tags: [URLAUB_TAGS.unbezahlt] };
    case "Elternzeit":         return { day_type: DAY_TYPES.FREI,   tags: [URLAUB_TAGS.elternzeit] };
    case "Überstundenabbau":   return { day_type: DAY_TYPES.FREI,   tags: [URLAUB_TAGS.ueberstundenabbau] };
    default:                   return { day_type: DAY_TYPES.URLAUB, tags: [] };
  }
}

type Tagged = { day_type: string; tags?: string[] | null };

/** Zieht einen Tag vom Urlaubsanspruch ab (nur Erholungsurlaub) */
export function zaehltZumUrlaubskonto(e: Tagged): boolean {
  return e.day_type === DAY_TYPES.URLAUB && !(e.tags ?? []).some((t) => NICHT_VOM_KONTO.includes(t));
}

/**
 * Gehört dieser Tageseintrag zum Antrag dieser Art? (Antrag löschen → nur diese Einträge entfernen.)
 * Alte Anträge (vor v0.87.2) schrieben jede Art als "urlaub" ohne Tag — die zählen auch.
 */
export function gehoertZuAntrag(e: Tagged, art: UrlaubArt): boolean {
  const soll = urlaubEntryFor(art);
  const tags = e.tags ?? [];
  if (e.day_type === DAY_TYPES.URLAUB && tags.length === 0) return true;
  return e.day_type === soll.day_type && soll.tags.every((t) => tags.includes(t));
}

/** Tag ohne Arbeitspflicht und ohne Lohn: Soll entfällt (Unbezahlter Urlaub, Elternzeit) */
export function entfaelltSoll(e: Tagged): boolean {
  return e.day_type === DAY_TYPES.FREI && (e.tags ?? []).some((t) => OHNE_SOLL.includes(t));
}
