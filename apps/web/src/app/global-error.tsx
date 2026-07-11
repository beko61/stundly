"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/monitoring/reportError";

/**
 * Global error boundary — Root layout throw'larını yakalar.
 * Next.js kuralı: kendi <html>/<body> içermeli.
 *
 * R2 fix (Audit): Önceden yoktu → prod'da beyaz ekran.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, error.digest ? { where: "global-error", digest: error.digest } : { where: "global-error" });
  }, [error]);

  return (
    <html lang="de">
      <body style={{
        margin: 0,
        background: "#0f0f13",
        color: "#e5e5e5",
        fontFamily: "system-ui, -apple-system, sans-serif",
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
            Etwas ist schief gelaufen
          </h1>
          <p style={{ color: "#9ca3af", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            Ein unerwarteter Fehler ist aufgetreten. Wir haben die Meldung erhalten
            und schauen uns das an.
          </p>
          {error.digest && (
            <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 24, fontFamily: "monospace" }}>
              Fehler-ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: "10px 24px",
              borderRadius: 10,
              border: "none",
              background: "#8b5cf6",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  );
}
