import type { QueryClient } from "@tanstack/react-query";
import type { TimeEntry } from "@workly/shared";
import { enqueue, type TimeEntryRow } from "./outbox";

/** Offline gespeicherter, noch nicht synchronisierter Eintrag (nur im Cache). */
export type MaybePending<T> = T & { _pending?: boolean };

export const SYNC_REQUEST_EVENT = "stundly-sync-request";

/** OfflineSync bitten, die Outbox jetzt zu senden (falls online). */
export function requestSync() {
  try { window.dispatchEvent(new Event(SYNC_REQUEST_EVENT)); } catch { /* SSR */ }
}

const ROW_FIELDS = ["date", "day_type", "start_time", "end_time", "break_minutes", "is_night_shift", "note", "tags"] as const;

export function toRow(e: Partial<TimeEntry>): TimeEntryRow {
  const out: Record<string, unknown> = {};
  for (const k of ROW_FIELDS) if (k in e) out[k] = e[k];
  return out as TimeEntryRow;
}

/** Eintrag per ID in irgendeiner gecachten Monats-Query finden. */
export function findCachedTimeEntry(qc: QueryClient, userId: string, id: string): TimeEntry | null {
  for (const [, data] of qc.getQueriesData<TimeEntry[]>({ queryKey: ["time_entries", userId] })) {
    const hit = Array.isArray(data) ? data.find((e) => e.id === id) : undefined;
    if (hit) return hit;
  }
  return null;
}

/** Monats-Query des Datums optimistisch ändern (row = null → Tag löschen). */
function patchMonthCache(qc: QueryClient, userId: string, date: string, row: TimeEntry | null) {
  const [y, m] = date.split("-").map(Number);
  qc.setQueryData<TimeEntry[]>(["time_entries", userId, y, m], (old) => {
    const rest = (old ?? []).filter((e) => e.date !== date);
    return row ? [...rest, row].sort((a, b) => a.date.localeCompare(b.date)) : rest;
  });
}

/** Arbeitszeit offline speichern: Outbox + sofort im Cache sichtbar. */
export function offlineUpsertTimeEntry(qc: QueryClient, userId: string, row: TimeEntryRow): MaybePending<TimeEntry> {
  enqueue({ kind: "te_upsert", key: `te:${row.date}`, userId, date: row.date, row, at: Date.now() });
  const [y, m] = row.date.split("-").map(Number);
  const existing = qc.getQueryData<TimeEntry[]>(["time_entries", userId, y, m])?.find((e) => e.date === row.date);
  const now = new Date().toISOString();
  const cached: MaybePending<TimeEntry> = {
    id:         existing?.id ?? `offline-${row.date}`,
    user_id:    userId,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    synced_at:  null,
    ...row,
    _pending:   true,
  };
  patchMonthCache(qc, userId, row.date, cached);
  requestSync();
  return cached;
}

export function offlineDeleteTimeEntry(qc: QueryClient, userId: string, date: string) {
  enqueue({ kind: "te_delete", key: `te:${date}`, userId, date, at: Date.now() });
  patchMonthCache(qc, userId, date, null);
  requestSync();
}
