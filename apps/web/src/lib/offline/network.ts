/** Browser meldet "kein Netz" (Flugmodus, kein Empfang). */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Netzwerkfehler statt Serverantwort? supabase-js liefert Fetch-Fehler als
 * `{ error: { message: "TypeError: Failed to fetch" } }` statt zu werfen.
 * Safari: "Load failed", Firefox: "NetworkError when attempting to fetch resource".
 */
export function isNetworkError(err: unknown): boolean {
  if (isOffline()) return true;
  const msg =
    typeof err === "string" ? err
    : err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message)
    : "";
  return /failed to fetch|load failed|networkerror|network request failed|fetch failed/i.test(msg);
}

/** Zufällige UUID v4 — auch in älteren Browsern ohne crypto.randomUUID. */
export function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const UID_KEY = "stundly_last_uid";

/** Letzte bekannte User-ID merken — offline kann getSession() ohne Token-Refresh leer sein. */
export function rememberUserId(uid: string | null) {
  try {
    if (uid) localStorage.setItem(UID_KEY, uid);
    else localStorage.removeItem(UID_KEY);
  } catch { /* ignore */ }
}

export function cachedUserId(): string | null {
  try { return localStorage.getItem(UID_KEY); } catch { return null; }
}
