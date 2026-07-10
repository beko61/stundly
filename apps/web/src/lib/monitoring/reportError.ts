/**
 * Merkezi hata raporlama.
 *
 * R3 fix: Şimdilik console.error + Vercel logs. Sentry gelecekte
 * @sentry/nextjs kurulup burada wire edilir:
 *
 *   if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
 *     const { captureException } = await import("@sentry/nextjs");
 *     captureException(err, { extra: context });
 *   }
 *
 * Şu anki impl production'da bir şeyi gerçekten remote'a atmıyor — sadece
 * fail-safe API yüzeyi hazır. Sentry entegrasyonu ayrı bir sprint.
 */

interface ErrorContext {
  where?: string;
  digest?: string;
  userId?: string;
  extra?: Record<string, unknown>;
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

  // TODO(sentry): Sentry.captureException(err, { extra: payload })
  // TODO(webhook): kritik hataları Discord/Slack webhook'a yolla
}
