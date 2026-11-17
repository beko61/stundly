"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { rememberUtm } from "@/lib/marketing/utm";

/** Merkt sich ?utm_… der Einstiegsseite bis zur Registrierung (nur Arbeitsspeicher). */
export function UtmCapture() {
  const pathname = usePathname();
  useEffect(() => {
    rememberUtm(window.location.search);
  }, [pathname]);
  return null;
}
