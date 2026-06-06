"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js on the client so the app becomes installable on
 * Chrome / Android (Chrome requires a service worker with a fetch handler).
 * iOS Safari does not require this — its "Add to Home Screen" already works
 * via the manifest. But registering here is harmless on iOS too.
 */
export function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // skip in dev (annoying HMR)

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          // Silent: SW failures should never block the app
          console.warn("Stundly SW register failed:", err);
        });
    };

    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
  }, []);

  return null;
}
