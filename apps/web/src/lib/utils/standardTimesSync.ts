import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  getStandardTimes, setStandardTimes, STANDARD_TIMES_LS_KEY, type StandardTimes,
} from "./standardTimes";

/**
 * Standardzeiten geräteübergreifend (Migration 040: profiles.standard_times).
 * Der Browser behält die Kopie in localStorage (getStandardTimes bleibt synchron/offline-fähig);
 * gespeichert wird zusätzlich im Profil, beim Start wird abgeglichen.
 */

const TIME = /^\d{2}:\d{2}$/;

/** DB-Wert prüfen — nur vollständige, gültige Standardzeiten übernehmen. */
export function parseStandardTimes(v: unknown): StandardTimes | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const times = ["monThuStart", "monThuEnd", "friStart", "friEnd"] as const;
  const pauses = ["monThuPause", "friPause"] as const;
  if (!times.every((k) => typeof o[k] === "string" && TIME.test(o[k] as string))) return null;
  if (!pauses.every((k) => typeof o[k] === "number" && (o[k] as number) >= 0)) return null;
  return {
    monThuStart: o.monThuStart as string, monThuEnd: o.monThuEnd as string, monThuPause: o.monThuPause as number,
    friStart: o.friStart as string, friEnd: o.friEnd as string, friPause: o.friPause as number,
  };
}

async function sessionUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/** Speichern: Gerät sofort, Profil im Hintergrund (offline → bleibt auf dem Gerät, nächster Start lädt hoch). */
export async function saveStandardTimes(
  t: StandardTimes,
  supabase: SupabaseClient = createClient(),
): Promise<{ error: string | null }> {
  setStandardTimes(t);
  try {
    const userId = await sessionUserId(supabase);
    if (!userId) return { error: null };
    const { error } = await supabase.from("profiles").update({ standard_times: t }).eq("user_id", userId);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "offline" };
  }
}

/**
 * Beim App-Start: Profil-Wert gewinnt (→ Gerät). Ist im Profil noch nichts, aber auf dem Gerät
 * eigene Zeiten → hochladen (bisherige Einstellungen gehen nicht verloren).
 */
export async function syncStandardTimes(
  supabase: SupabaseClient = createClient(),
): Promise<"pulled" | "pushed" | "none"> {
  try {
    const userId = await sessionUserId(supabase);
    if (!userId) return "none";
    const { data, error } = await supabase
      .from("profiles").select("standard_times").eq("user_id", userId).maybeSingle();
    if (error) return "none";

    const fromDb = parseStandardTimes((data as { standard_times?: unknown } | null)?.standard_times);
    if (fromDb) {
      if (JSON.stringify(fromDb) !== JSON.stringify(getStandardTimes())) setStandardTimes(fromDb);
      return "pulled";
    }
    let onDevice = false;
    try { onDevice = localStorage.getItem(STANDARD_TIMES_LS_KEY) !== null; } catch { /* privat */ }
    if (!onDevice) return "none";
    const { error: upErr } = await supabase
      .from("profiles").update({ standard_times: getStandardTimes() }).eq("user_id", userId);
    return upErr ? "none" : "pushed";
  } catch {
    return "none";
  }
}
