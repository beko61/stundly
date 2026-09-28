import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";

/**
 * React-Query-Cache in localStorage sichern, damit Zeiten/Notdienste nach einem
 * App-Neustart ohne Netz sichtbar sind. Nur eigene Nutzdaten, nur erfolgreiche Queries.
 * Nach dem Laden gelten die Daten als veraltet → online wird sofort neu geladen.
 */

const CACHE_KEY = "stundly_rq_cache_v1";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // ältere Stände nicht mehr anzeigen
const PERSISTED = new Set(["time_entries", "time_entries_range", "notdienst_entries", "salary_settings", "vacation_requests"]);

export function restoreQueryCache(qc: QueryClient) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const { savedAt, state } = JSON.parse(raw) as { savedAt: number; state: unknown };
    if (!state || Date.now() - savedAt > MAX_AGE_MS) {
      localStorage.removeItem(CACHE_KEY);
      return;
    }
    hydrate(qc, state);
  } catch {
    try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
  }
}

function save(qc: QueryClient) {
  try {
    const state = dehydrate(qc, {
      shouldDehydrateQuery: (q) =>
        q.state.status === "success" && PERSISTED.has(String(q.queryKey[0])) && q.queryKey[1] !== "anon",
    });
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), state }));
  } catch { /* Quota voll → ohne Persistenz weiter */ }
}

/** Bei jeder Cache-Änderung (gedrosselt) sichern. Gibt Unsubscribe zurück. */
export function persistQueryCache(qc: QueryClient): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsub = qc.getQueryCache().subscribe((ev) => {
    if (ev.type !== "updated" && ev.type !== "removed") return;
    if (timer) return;
    timer = setTimeout(() => { timer = null; save(qc); }, 1000);
  });
  const flushNow = () => { if (timer) { clearTimeout(timer); timer = null; } save(qc); };
  window.addEventListener("pagehide", flushNow);
  return () => {
    unsub();
    window.removeEventListener("pagehide", flushNow);
    if (timer) clearTimeout(timer);
  };
}

export function clearPersistedCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}
