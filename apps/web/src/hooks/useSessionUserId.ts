"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cachedUserId, isOffline, rememberUserId } from "@/lib/offline/network";

/**
 * Aktuelle User-ID (client-seitig).
 *   undefined → wird noch ermittelt · null → nicht eingeloggt · string → User-ID
 *
 * Offline: getSession() liefert bei abgelaufenem Token (Refresh braucht Netz) keine
 * Session — dann die zuletzt bekannte ID nehmen, damit gespeicherte Daten sichtbar
 * bleiben und Änderungen in die Offline-Outbox gehen.
 */
export function useSessionUserId(): string | null | undefined {
  const [uid, setUid] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let id: string | null = null;
      let failed = false;
      try {
        const supabase = createClient();
        const { data: { session }, error } = await supabase.auth.getSession();
        id = session?.user?.id ?? null;
        failed = !!error;
      } catch {
        failed = true;
      }
      if (id) rememberUserId(id);
      else if (failed || isOffline()) id = cachedUserId();
      if (!cancelled) setUid(id);
    })();
    return () => { cancelled = true; };
  }, []);

  return uid;
}
