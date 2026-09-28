import type { TimeEntry } from "@workly/shared";

/**
 * Live-Zeiterfassung (Start/Pause/Feierabend) — reine Logik, ohne UI/DB.
 *
 * Zustand liegt komplett im Tages-Eintrag (time_entries), damit der Timer App-Neustart
 * und Gerätewechsel übersteht — keine Migration nötig:
 *   - läuft:     start_time gesetzt, end_time NULL, tags enthält "live"
 *   - pausiert:  zusätzlich Tag "pause:HH:MM" (Beginn der laufenden Pause)
 *   - beendete Pausen werden sofort in break_minutes aufaddiert
 * Offene Einträge (end_time NULL) ignorieren alle Statistiken/PDF/Exporte bereits.
 */

export const LIVE_TAG = "live";
const PAUSE_PREFIX = "pause:";

/** Ab so vielen Stunden brutto fragen wir nach, ob der Feierabend vergessen wurde. */
export const FORGOTTEN_AFTER_MIN = 14 * 60;

type Entry = Pick<TimeEntry, "date" | "start_time" | "end_time" | "break_minutes" | "tags">;
export type NewEntryPayload = Omit<TimeEntry, "id" | "user_id" | "created_at" | "updated_at" | "synced_at">;

/**
 * §4 ArbZG — Pausenregelung (brutto, konservativ): >6h → 30 min, >9h → 45 min.
 */
export function requiredPauseMinutes(bruttoMinutes: number): number {
  if (bruttoMinutes > 9 * 60) return 45;
  if (bruttoMinutes > 6 * 60) return 30;
  return 0;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Lokales Datum YYYY-MM-DD (toISOString wäre UTC → in DE nachts "gestern"). */
export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function hhmmOf(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Zeitpunkt des Starts als Date (DB liefert start_time evtl. als "07:12:00"). */
function startDate(e: Entry): Date {
  const [y, mo, d] = e.date.split("-").map(Number);
  const m = toMin(e.start_time ?? "00:00");
  return new Date(y ?? 1970, (mo ?? 1) - 1, d ?? 1, Math.floor(m / 60), m % 60);
}

/** Minuten von HH:MM bis `now` — über Mitternacht korrekt (Pause < 24 h). */
function minutesSince(hhmm: string, now: Date): number {
  const diff = now.getHours() * 60 + now.getMinutes() - toMin(hhmm);
  return diff >= 0 ? diff : diff + 24 * 60;
}

export function isLive(e: Entry | null | undefined): boolean {
  return !!e && !!e.start_time && !e.end_time && (e.tags ?? []).includes(LIVE_TAG);
}

export function pauseSince(e: Entry): string | null {
  const t = (e.tags ?? []).find((x) => x.startsWith(PAUSE_PREFIX));
  return t ? t.slice(PAUSE_PREFIX.length) : null;
}

/** Laufende Pause in Minuten (0 wenn nicht pausiert). */
export function currentPauseMinutes(e: Entry, now: Date): number {
  const p = pauseSince(e);
  return p ? minutesSince(p, now) : 0;
}

/** Brutto-Sekunden seit Start (inkl. Pausen). */
export function bruttoSeconds(e: Entry, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - startDate(e).getTime()) / 1000));
}

/** Netto-Arbeitssekunden: brutto − abgeschlossene Pausen − laufende Pause. */
export function netSeconds(e: Entry, now: Date): number {
  const pauseSec = (e.break_minutes + currentPauseMinutes(e, now)) * 60;
  return Math.max(0, bruttoSeconds(e, now) - pauseSec);
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function startPayload(now: Date): NewEntryPayload {
  return {
    date:           localDateStr(now),
    day_type:       "arbeiten",
    start_time:     hhmmOf(now),
    end_time:       null,
    break_minutes:  0,
    is_night_shift: false,
    note:           null,
    tags:           [LIVE_TAG],
  };
}

/** Bestehenden Tages-Eintrag (z. B. vorausgefüllt) durch einen Live-Start ersetzen. */
export function restartPatch(e: Entry, now: Date): Partial<TimeEntry> {
  return {
    day_type:      "arbeiten",
    start_time:    hhmmOf(now),
    end_time:      null,
    break_minutes: 0,
    tags:          [...withoutTimerTags(e.tags), LIVE_TAG],
  };
}

function withoutTimerTags(tags: string[] | null | undefined): string[] {
  return (tags ?? []).filter((t) => t !== LIVE_TAG && !t.startsWith(PAUSE_PREFIX));
}

export function pausePatch(e: Entry, now: Date): Partial<TimeEntry> {
  return { tags: [...withoutTimerTags(e.tags), LIVE_TAG, PAUSE_PREFIX + hhmmOf(now)] };
}

export function resumePatch(e: Entry, now: Date): Partial<TimeEntry> {
  return {
    break_minutes: e.break_minutes + currentPauseMinutes(e, now),
    tags:          [...withoutTimerTags(e.tags), LIVE_TAG],
  };
}

export interface StopResult {
  patch: Partial<TimeEntry>;
  /** Minuten, die nach §4 ArbZG zur erfassten Pause ergänzt wurden. */
  pauseAdded: number;
}

/**
 * Feierabend. `endAt` überschreibt "jetzt" (z. B. vergessener Stopp — Nutzer gibt die
 * echte Uhrzeit an). Eine laufende Pause wird bis zum Ende mitgezählt. Liegt die
 * erfasste Pause unter dem §4-ArbZG-Minimum, wird sie darauf aufgefüllt.
 */
export function stopPatch(e: Entry, now: Date, endAt?: string): StopResult {
  const end = endAt ?? hhmmOf(now);
  const endDate = endAt ? atTimeBefore(now, endAt, startDate(e)) : now;
  const p = pauseSince(e);
  const pauseSoFar = e.break_minutes + (p ? minutesBetween(p, end) : 0);
  const brutto = Math.max(0, Math.round((endDate.getTime() - startDate(e).getTime()) / 60000));
  const required = requiredPauseMinutes(brutto);
  const breakMin = Math.max(pauseSoFar, required);
  return {
    patch: { end_time: end, break_minutes: breakMin, tags: withoutTimerTags(e.tags) },
    pauseAdded: breakMin - pauseSoFar,
  };
}

function minutesBetween(from: string, to: string): number {
  const diff = toMin(to) - toMin(from);
  return diff >= 0 ? diff : diff + 24 * 60;
}

/** Spätester Zeitpunkt HH:MM, der nach `after` und nicht nach `now` liegt. */
function atTimeBefore(now: Date, hhmm: string, after: Date): Date {
  const m = toMin(hhmm);
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(m / 60), m % 60);
  while (d.getTime() > now.getTime()) d.setDate(d.getDate() - 1);
  // Liegt die Uhrzeit vor dem Start, ist der Folgetag gemeint (Nachtschicht).
  while (d.getTime() < after.getTime()) d.setDate(d.getDate() + 1);
  return d;
}
