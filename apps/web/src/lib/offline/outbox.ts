/**
 * Offline-Outbox — Änderungen, die ohne Netz gemacht wurden, in localStorage
 * zwischenspeichern und später (OfflineSync) an Supabase senden.
 *
 * Pro Datensatz nur EIN Eintrag (key): spätere Änderungen ersetzen frühere.
 *   - Arbeitszeit: key "te:<datum>" — ein Eintrag pro Tag (unique user_id,date),
 *     deshalb Upsert/Delete über das Datum, keine IDs nötig.
 *   - Notdienst:  key "nd:<id>" — neue Einträge bekommen offline eine echte UUID,
 *     die beim Sync mitgeschickt wird (keine Temp-ID-Umschreibung).
 */

import type { TimeEntry } from "@workly/shared";

export type TimeEntryRow = Omit<TimeEntry, "id" | "user_id" | "created_at" | "updated_at" | "synced_at">;
export type NotdienstRow = Record<string, unknown> & { date: string };

export type OutboxOp =
  | { kind: "te_upsert"; key: string; userId: string; date: string; row: TimeEntryRow; at: number }
  | { kind: "te_delete"; key: string; userId: string; date: string; at: number }
  | { kind: "nd_upsert"; key: string; userId: string; id: string; isNew: boolean; row: NotdienstRow; at: number }
  | { kind: "nd_delete"; key: string; userId: string; id: string; at: number };

export interface FailedOp { op: OutboxOp; error: string }

const OUTBOX_KEY = "stundly_outbox_v1";
const FAILED_KEY = "stundly_outbox_failed_v1";
export const OUTBOX_EVENT = "stundly-outbox-change";

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, list: T[]) {
  try {
    if (list.length) localStorage.setItem(key, JSON.stringify(list));
    else localStorage.removeItem(key);
  } catch { /* Speicher voll/gesperrt — Outbox bleibt im alten Stand */ }
  try { window.dispatchEvent(new Event(OUTBOX_EVENT)); } catch { /* SSR */ }
}

export function getOutbox(userId?: string | null): OutboxOp[] {
  const all = read<OutboxOp>(OUTBOX_KEY);
  return userId ? all.filter((o) => o.userId === userId) : all;
}

export function getFailed(): FailedOp[] {
  return read<FailedOp>(FAILED_KEY);
}

export function hasPending(key: string): boolean {
  return getOutbox().some((o) => o.key === key);
}

/** Op einreihen — ersetzt eine vorhandene Op mit gleichem key (letzter Stand gewinnt). */
export function enqueue(op: OutboxOp) {
  const list = getOutbox();
  const idx = list.findIndex((o) => o.key === op.key);
  const prev = idx >= 0 ? list[idx] : undefined;
  let next: OutboxOp | null = op;

  if (op.kind === "nd_upsert" && prev?.kind === "nd_upsert") {
    // Änderungen zusammenführen; noch nie auf dem Server → bleibt ein Insert
    next = { ...op, isNew: prev.isNew || op.isNew, row: { ...prev.row, ...op.row } };
  } else if (op.kind === "nd_delete" && prev?.kind === "nd_upsert" && prev.isNew) {
    // Offline angelegt und offline gelöscht → Server erfährt nie davon
    next = null;
  }

  const rest = list.filter((o) => o.key !== op.key);
  if (next) {
    // Reihenfolge bewahren: an alter Position ersetzen, sonst hinten anhängen
    if (idx >= 0) rest.splice(idx, 0, next);
    else rest.push(next);
  }
  write(OUTBOX_KEY, rest);
}

/** Nach erfolgreichem Sync entfernen — nur wenn die Op inzwischen nicht ersetzt wurde. */
export function removeOp(op: OutboxOp) {
  write(OUTBOX_KEY, getOutbox().filter((o) => !(o.key === op.key && o.at === op.at)));
}

export function markFailed(op: OutboxOp, error: string) {
  removeOp(op);
  write(FAILED_KEY, [...getFailed(), { op, error }]);
}

export function clearFailed() {
  write(FAILED_KEY, []);
}

export function clearOutbox() {
  write(OUTBOX_KEY, []);
  write(FAILED_KEY, []);
}
