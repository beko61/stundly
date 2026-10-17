"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/monitoring/reportError";

/**
 * Meldet Fehler, die keine Error-Boundary erreichen (Klick-Handler, Promises).
 * Fremde Skripte (Browser-Erweiterungen) werden ignoriert.
 */
export function ErrorListener() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (e.filename && !e.filename.startsWith(window.location.origin)) return;
      reportError(e.error ?? e.message, { where: "window.error" });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      reportError(e.reason, { where: "unhandledrejection" });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
