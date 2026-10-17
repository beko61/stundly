/**
 * Fehlerereignisse — gemeinsame, reine Helfer für /api/errors, instrumentation.ts,
 * die Süper-Admin-Seite und die tägliche Mail.
 */

export interface ErrorPayload {
  message: string;
  stack?: string | null;
  location?: string | null;
  path?: string | null;
  digest?: string | null;
  user_agent?: string | null;
  app_version?: string | null;
}

export interface ErrorRow extends ErrorPayload {
  id: number;
  created_at: string;
  source: "client" | "server";
  fingerprint: string;
  user_id: string | null;
}

export interface ErrorGroup {
  fingerprint: string;
  message: string;
  location: string | null;
  source: "client" | "server";
  count: number;
  users: number;
  firstSeen: string;
  lastSeen: string;
  lastPath: string | null;
  lastVersion: string | null;
  lastStack: string | null;
}

const clip = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
};

/** Pfad ohne Query/Hash — dort können Tokens stehen (z. B. Passwort-Reset). */
export function cleanPath(p: unknown): string | null {
  const s = clip(p, 300);
  return s ? s.split(/[?#]/)[0]! : null;
}

/** Eingaben begrenzen und säubern; null = unbrauchbar. */
export function sanitizeErrorPayload(raw: unknown): ErrorPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const message = clip(r.message, 500);
  if (!message) return null;
  return {
    message,
    stack: clip(r.stack, 4000),
    location: clip(r.location, 100),
    path: cleanPath(r.path),
    digest: clip(r.digest, 100),
    user_agent: clip(r.user_agent, 300),
    app_version: clip(r.app_version, 20),
  };
}

/** Rauschen, das kein Fehler unserer App ist (Netzwerk weg, Browser-Eigenheiten, Erweiterungen). */
const IGNORE = [
  /^Script error\.?$/i,
  /ResizeObserver loop/i,
  /^Failed to fetch$/i,
  /^Load failed$/i,
  /NetworkError when attempting to fetch/i,
  /^The operation was aborted/i,
  /AbortError/i,
  /^NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR_FALLBACK)/, // Next.js-Steuerfluss, kein Fehler
];

export function shouldIgnore(message: string): boolean {
  return IGNORE.some((re) => re.test(message));
}

/** Gleiche Fehler zusammenfassen: Zahlen/IDs werden vor dem Hash neutralisiert. */
export function fingerprint(message: string, location?: string | null): string {
  const norm = `${location ?? ""}|${message}`
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\d+/g, "<n>");
  let h = 5381;
  for (let i = 0; i < norm.length; i++) h = ((h << 5) + h + norm.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

/** Ereignisse nach Fingerprint gruppieren, neueste Gruppe zuerst. */
export function groupErrors(rows: ErrorRow[]): ErrorGroup[] {
  const map = new Map<string, ErrorGroup & { userSet: Set<string> }>();
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const r of sorted) {
    let g = map.get(r.fingerprint);
    if (!g) {
      g = {
        fingerprint: r.fingerprint, message: r.message, location: r.location ?? null, source: r.source,
        count: 0, users: 0, firstSeen: r.created_at, lastSeen: r.created_at,
        lastPath: null, lastVersion: null, lastStack: null, userSet: new Set(),
      };
      map.set(r.fingerprint, g);
    }
    g.count++;
    g.lastSeen = r.created_at;
    g.message = r.message;
    g.lastPath = r.path ?? g.lastPath;
    g.lastVersion = r.app_version ?? g.lastVersion;
    g.lastStack = r.stack ?? g.lastStack;
    if (r.user_id) g.userSet.add(r.user_id);
  }
  return [...map.values()]
    .map(({ userSet, ...g }) => ({ ...g, users: userSet.size }))
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

/** Schreibt ein Ereignis per REST (funktioniert in Node und Edge, ohne supabase-js). */
export async function insertErrorEvent(
  source: "client" | "server",
  p: ErrorPayload,
  userId: string | null = null,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  await fetch(`${url}/rest/v1/error_events`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ source, fingerprint: fingerprint(p.message, p.location), user_id: userId, ...p }),
  });
}
