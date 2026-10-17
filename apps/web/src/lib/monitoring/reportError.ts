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

export function reportError(err: unknown, context: ErrorContext = {}): void {
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
