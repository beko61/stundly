import type { Instrumentation } from "next";

/**
 * Server-Fehler (Seiten, Route-Handler, Server Actions) → error_events.
 * Das sind u. a. die 500er mit "Fehler-ID" (digest), die sonst nur in den Vercel-Logs stehen.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  try {
    const { insertErrorEvent, sanitizeErrorPayload, shouldIgnore } = await import("@/lib/monitoring/errorEvents");
    const { STUNDLY_VERSION } = await import("@/lib/version");
    const e = err as Error & { digest?: string };
    const payload = sanitizeErrorPayload({
      message: e?.message ?? String(err),
      stack: e?.stack,
      digest: e?.digest,
      location: `server:${context.routerKind}:${context.routeType}:${context.routePath}`,
      path: request.path,
      user_agent: request.headers["user-agent"],
      app_version: STUNDLY_VERSION,
    });
    if (!payload || shouldIgnore(payload.message)) return;
    await insertErrorEvent("server", payload);
  } catch (e) {
    console.error("[instrumentation] onRequestError", e);
  }
};
