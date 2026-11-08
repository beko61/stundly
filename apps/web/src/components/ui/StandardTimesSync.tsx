"use client";

import { useEffect } from "react";
import { syncStandardTimes } from "@/lib/utils/standardTimesSync";

/** Beim App-Start einmal: Standardzeiten aus dem Profil aufs Gerät holen (bzw. Geräte-Werte hochladen). */
export function StandardTimesSync() {
  useEffect(() => { void syncStandardTimes(); }, []);
  return null;
}
