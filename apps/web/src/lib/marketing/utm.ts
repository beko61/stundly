/**
 * Kampagnen-Herkunft (Werbeanzeige, LinkedIn-Post …) über die URL: ?utm_source=google&utm_campaign=notdienst
 *
 * Ohne Cookies/localStorage: der erste Treffer wird nur im Arbeitsspeicher gehalten, solange der
 * Tab offen ist (App-Navigation), und bei der Registrierung in die Auth-Metadaten geschrieben.
 * Auswertung: Super-Admin → Kokpit "Reklam / kampanya".
 */

export interface Utm {
  source: string;
  medium?: string;
  campaign?: string;
}

/** Nur kurze, harmlose Kennungen übernehmen (keine freien Texte, keine personenbezogenen Daten) */
function clean(v: string | null): string | undefined {
  return v && /^[a-z0-9._-]{1,40}$/i.test(v) ? v.toLowerCase() : undefined;
}

export function parseUtm(search: string): Utm | null {
  const p = new URLSearchParams(search);
  const source = clean(p.get("utm_source"));
  if (!source) return null;
  const medium = clean(p.get("utm_medium"));
  const campaign = clean(p.get("utm_campaign"));
  return { source, ...(medium ? { medium } : {}), ...(campaign ? { campaign } : {}) };
}

let firstTouch: Utm | null = null;

/** Beim Seitenaufruf: ersten Kampagnen-Treffer merken (spätere überschreiben ihn nicht) */
export function rememberUtm(search: string): void {
  if (!firstTouch) firstTouch = parseUtm(search);
}

/** Bei der Registrierung: aktuelle URL zuerst, sonst der gemerkte erste Treffer */
export function currentUtm(search: string): Utm | null {
  return parseUtm(search) ?? firstTouch;
}

export function utmMeta(u: Utm | null): Record<string, string> {
  if (!u) return {};
  return {
    utm_source: u.source,
    ...(u.medium ? { utm_medium: u.medium } : {}),
    ...(u.campaign ? { utm_campaign: u.campaign } : {}),
  };
}

/** Anzeige im Super-Admin, z. B. "google · notdienst" */
export function utmLabel(source: string | null | undefined, campaign: string | null | undefined): string | null {
  if (!source) return null;
  return campaign ? `${source} · ${campaign}` : source;
}

/** Nur für Tests */
export function _resetUtm(): void {
  firstTouch = null;
}
