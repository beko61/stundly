"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/monitoring/reportError";

/**
 * Dashboard scope error boundary — layout & alt rotalardaki throw'ları yakalar.
 * BottomNav ve Sidebar ile birlikte render olur (parent layout korunur).
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, error.digest ? { where: "dashboard", digest: error.digest } : { where: "dashboard" });
  }, [error]);

  return (
    <div style={{ padding: "40px 20px", maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
      <div style={{ fontSize: 42, marginBottom: 14 }}>⚠️</div>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>
        Etwas ist schief gelaufen
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
        Diese Seite konnte nicht geladen werden. Versuche es erneut oder gehe zum Dashboard.
      </p>
      {error.digest && (
        <p style={{ color: "var(--muted)", fontSize: 11, marginBottom: 20, fontFamily: "monospace", opacity: 0.7 }}>
          Fehler-ID: {error.digest}
        </p>
      )}
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button
          onClick={reset}
          className="btn btn-primary"
          style={{ minHeight: 44, padding: "10px 20px" }}
        >
          Erneut versuchen
        </button>
        <a
          href="/dashboard"
          className="btn"
          style={{
            minHeight: 44,
            padding: "10px 20px",
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          Zum Dashboard
        </a>
      </div>
    </div>
  );
}
