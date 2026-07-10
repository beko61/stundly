"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/monitoring/reportError";

export default function CompanyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, error.digest ? { where: "company", digest: error.digest } : { where: "company" });
  }, [error]);

  return (
    <div style={{ padding: "40px 20px", maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
      <div style={{ fontSize: 42, marginBottom: 14 }}>⚠️</div>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>
        Etwas ist schief gelaufen
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
        Die Unternehmens-Seite konnte nicht geladen werden.
      </p>
      {error.digest && (
        <p style={{ color: "var(--muted)", fontSize: 11, marginBottom: 20, fontFamily: "monospace", opacity: 0.7 }}>
          Fehler-ID: {error.digest}
        </p>
      )}
      <button onClick={reset} className="btn btn-primary" style={{ minHeight: 44, padding: "10px 20px" }}>
        Erneut versuchen
      </button>
    </div>
  );
}
