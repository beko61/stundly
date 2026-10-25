/**
 * Merkezi hata raporlama.
 *
 * console.error (Vercel logs) + im Browser an /api/errors → Tabelle error_events
 * (Süper admin: /superadmin/errors, tägliche Mail). Server-Fehler kommen über
 * instrumentation.ts (onRequestError) in dieselbe Tabelle.
 */
import { STUNDLY_VERSION } from "@/lib/version";

interface ErrorContext {
  where?: string;
  digest?: string;
  userId?: string;
  extra?: Record<string, unknown>;
}

// Pro Seitenaufruf höchstens 10 Meldungen, gleiche Meldung nur einmal
const MAX_PER_PAGE = 10;
const sent = new Set<string>();

function send(body: Record<string, unknown>) {
  const key = `${String(body.location)}|${String(body.message)}`;
  if (sent.has(key) || sent.size >= MAX_PER_PAGE) return;
  sent.add(key);
  const json = JSON.stringify(body);
  try {
    if (navigator.sendBeacon?.("/api/errors", new Blob([json], { type: "application/json" }))) return;
  } catch {}
  fetch("/api/errors", { method: "POST", body: json, headers: { "Content-Type": "application/json" }, keepalive: true })
    .catch(() => {});
}

/**
 * Nach einem neuen Deployment sucht eine offene ältere Seite nicht mehr vorhandene JS-Dateien
 * ("Loading chunk … failed" / ChunkLoadError). Dann einmal neu laden (holt die neue Version) —
 * höchstens einmal pro Minute, damit bei echtem Netzproblem keine Schleife entsteht.
 */
const CHUNK_RE = /Loading (CSS )?chunk [\w-]+ failed|ChunkLoadError|Failed to fetch dynamically imported module/i;
const RELOAD_KEY = "stundly_chunk_reload_at";

export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return CHUNK_RE.test(msg);
}

/** true = Seite wird neu geladen (Fehler nicht melden) */
export function reloadOnceForChunkError(err: unknown): boolean {
  if (typeof window === "undefined" || !isChunkLoadError(err)) return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export function reportError(err: unknown, context: ErrorContext = {}): void {
  if (reloadOnceForChunkError(err)) return;

  const message = err instanceof Error ? err.message : String(err);
  const stack   = err instanceof Error ? err.stack   : undefined;

  const payload = {
    message,
    stack,
    where: context.where,
    digest: context.digest,
    userId: context.userId,
    extra: context.extra,
    timestamp: new Date().toISOString(),
  };

  // Yerel + Vercel logs
  console.error("[reportError]", JSON.stringify(payload, null, 2));

  if (typeof window === "undefined") return;
  send({
    message,
    stack,
    location: context.where,
    digest: context.digest,
    path: window.location.pathname,
    user_agent: navigator.userAgent,
    app_version: STUNDLY_VERSION,
  });
}

/** Nur für Tests */
export function __resetReportedForTests() {
  sent.clear();
}
