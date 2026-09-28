import { getBrowserQueryClient } from "@/providers/QueryProvider";
import { enqueue, getOutbox, type NotdienstRow } from "./outbox";
import { newUuid } from "./network";
import { requestSync } from "./timeEntries";

type CachedNd = Record<string, unknown> & { id: string; date: string; _pending?: boolean };

/** Alle gecachten Notdienst-Bereiche (key: [.., userId, start, end]) optimistisch ändern. */
function patchNdCache(userId: string, id: string, row: CachedNd | null) {
  const qc = getBrowserQueryClient();
  if (!qc) return;
  for (const [key, data] of qc.getQueriesData<CachedNd[]>({ queryKey: ["notdienst_entries", userId] })) {
    if (!Array.isArray(data)) continue;
    const [, , start, end] = key as [string, string, string, string];
    const prev = data.find((e) => e.id === id);
    const rest = data.filter((e) => e.id !== id);
    const merged = row && { ...prev, ...row }; // Teiländerung (z. B. nur "erledigt") behält die übrigen Felder
    const fits = merged && (!start || merged.date >= start) && (!end || merged.date <= end);
    const next = fits ? [...rest, merged].sort((a, b) => a.date.localeCompare(b.date)) : rest;
    qc.setQueryData(key, next);
  }
}

/**
 * Notdienst ohne Netz speichern. Neue Einsätze bekommen hier ihre endgültige UUID —
 * der Sync schickt sie mit, dadurch bleibt die ID (und alles, was sie referenziert) stabil.
 */
export function offlineSaveNotdienst(userId: string, id: string | null, payload: NotdienstRow): CachedNd {
  const finalId = id ?? newUuid();
  const isNew = !id || getOutbox().some((o) => o.kind === "nd_upsert" && o.id === id && o.isNew);
  enqueue({ kind: "nd_upsert", key: `nd:${finalId}`, userId, id: finalId, isNew, row: payload, at: Date.now() });
  const row: CachedNd = { ...payload, id: finalId, user_id: userId, _pending: true };
  patchNdCache(userId, finalId, row);
  requestSync();
  return row;
}

export function offlineDeleteNotdienst(userId: string, id: string) {
  enqueue({ kind: "nd_delete", key: `nd:${id}`, userId, id, at: Date.now() });
  patchNdCache(userId, id, null);
  requestSync();
}
