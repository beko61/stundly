"use client";

import { useCallback, useEffect, useState } from "react";

/* ════════════════════════════════════════════════════════════
   DEMO STATE — localStorage-backed, kayıt olmadan persist
   ════════════════════════════════════════════════════════════ */

export type DemoDayType = "arbeiten" | "urlaub" | "krank" | "frei";

export interface DemoEntry {
  date:          string;          // YYYY-MM-DD
  day_type:      DemoDayType;
  start_time:    string | null;   // "HH:mm"
  end_time:      string | null;
  break_minutes: number;
}

export interface DemoSettings {
  hourly_rate:          number;
  monthly_target_hours: number;
}

export interface DemoState {
  entries:  DemoEntry[];
  settings: DemoSettings;
}

const STORAGE_KEY = "stundly_demo_v2";

/** Default Juni 2026: 5 dolu örnek gün + 25 boş = kullanıcı tıklayıp doldurur. */
const SEED_ENTRIES: DemoEntry[] = [
  { date: "2026-06-01", day_type: "arbeiten", start_time: "07:45", end_time: "17:00", break_minutes: 60 },
  { date: "2026-06-02", day_type: "arbeiten", start_time: "07:45", end_time: "17:30", break_minutes: 60 },
  { date: "2026-06-03", day_type: "urlaub",   start_time: null,    end_time: null,    break_minutes: 0  },
  { date: "2026-06-04", day_type: "arbeiten", start_time: "07:45", end_time: "17:00", break_minutes: 60 },
  { date: "2026-06-05", day_type: "arbeiten", start_time: "07:45", end_time: "14:30", break_minutes: 30 },
];

const SEED_SETTINGS: DemoSettings = {
  hourly_rate:          15,
  monthly_target_hours: 174,
};

const SEED_STATE: DemoState = {
  entries:  SEED_ENTRIES,
  settings: SEED_SETTINGS,
};

function readStorage(): DemoState {
  if (typeof window === "undefined") return SEED_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED_STATE;
    const parsed = JSON.parse(raw) as Partial<DemoState>;
    return {
      entries:  Array.isArray(parsed.entries)  ? parsed.entries  : SEED_ENTRIES,
      settings: { ...SEED_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return SEED_STATE;
  }
}

function writeStorage(s: DemoState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* quota / privacy mode — yoksay, in-memory devam eder */
  }
}

/* ─── Hook ────────────────────────────────────────────────── */

export interface UseDemoStateResult {
  state:       DemoState;
  upsertEntry: (e: DemoEntry) => void;
  removeEntry: (date: string) => void;
  resetAll:    () => void;
  hasEdits:    boolean;
  ready:       boolean;   // hydration done flag
}

export function useDemoState(): UseDemoStateResult {
  const [state, setState] = useState<DemoState>(SEED_STATE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(readStorage());
    setReady(true);
  }, []);

  const persist = useCallback((next: DemoState) => {
    setState(next);
    writeStorage(next);
  }, []);

  const upsertEntry = useCallback((entry: DemoEntry) => {
    setState((prev) => {
      const others = prev.entries.filter((e) => e.date !== entry.date);
      const next   = { ...prev, entries: [...others, entry].sort((a, b) => a.date.localeCompare(b.date)) };
      writeStorage(next);
      return next;
    });
  }, []);

  const removeEntry = useCallback((date: string) => {
    setState((prev) => {
      const next = { ...prev, entries: prev.entries.filter((e) => e.date !== date) };
      writeStorage(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    persist(SEED_STATE);
  }, [persist]);

  // "Hat eigene Edits" = localStorage'da seed'den farklı bir state var
  const hasEdits = JSON.stringify(state) !== JSON.stringify(SEED_STATE);

  return { state, upsertEntry, removeEntry, resetAll, hasEdits, ready };
}

/* ════════════════════════════════════════════════════════════
   MIGRATION HELPERS — kayıt sonrası entry'leri Supabase'e taşımak için
   ════════════════════════════════════════════════════════════ */

/** Demo'da kullanıcı kendi entry'lerini girmiş mi? (localStorage'da seed dışında veri var mı?) */
export function hasDemoEdits(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    return raw !== JSON.stringify(SEED_STATE);
  } catch {
    return false;
  }
}

/** Import için entry'leri oku — Supabase time_entries formatına yakın. */
export function getDemoEntriesForImport(): DemoEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<DemoState>;
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

/** Import sonrası localStorage'ı temizle — kullanıcı tekrar girmez. */
export function clearDemoStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* yoksay */ }
}

/* ════════════════════════════════════════════════════════════
   COMPUTATIONS — entries'den live KPI çıkar
   ════════════════════════════════════════════════════════════ */

function parseHHMM(s: string): number {
  const [h = 0, m = 0] = s.split(":").map(Number);
  return h * 60 + m;
}

/** Mo-Fr 8h, Sa/So 0 — bezahlte Abwesenheit (urlaub/krank) için */
function getDayStdMins(dateStr: string): number {
  const dow = new Date(dateStr).getDay();
  if (dow === 0 || dow === 6) return 0;
  return 8 * 60;
}

/** Bir entry'nin net dakikasi */
export function entryNetMinutes(e: DemoEntry): number {
  if (e.day_type === "urlaub" || e.day_type === "krank") return getDayStdMins(e.date);
  if (e.day_type === "frei") return 0;
  if (!e.start_time || !e.end_time) return 0;
  const s = parseHHMM(e.start_time);
  const en = parseHHMM(e.end_time);
  let mins = en - s;
  if (mins < 0) mins += 24 * 60; // gece vardiyası
  return Math.max(0, mins - e.break_minutes);
}

export interface DemoStats {
  workedMin:    number;
  sollMin:      number;
  diffMin:      number;
  brutto:       number;
  netto:        number;
  arbeitenCnt:  number;
  urlaubCnt:    number;
  krankCnt:     number;
}

/** Demo için basitleştirilmiş Brutto→Netto: %32 toplam Abzug (rough but realistic for St-Kl I). */
const NETTO_FACTOR = 0.68;

export function computeStats(state: DemoState): DemoStats {
  let workedMin = 0;
  let arbeitenCnt = 0, urlaubCnt = 0, krankCnt = 0;

  for (const e of state.entries) {
    workedMin += entryNetMinutes(e);
    if (e.day_type === "arbeiten") arbeitenCnt++;
    else if (e.day_type === "urlaub") urlaubCnt++;
    else if (e.day_type === "krank")  krankCnt++;
  }

  const sollMin = state.settings.monthly_target_hours * 60;
  const diffMin = workedMin - sollMin;
  const brutto  = (workedMin / 60) * state.settings.hourly_rate;
  const netto   = brutto * NETTO_FACTOR;

  return { workedMin, sollMin, diffMin, brutto, netto, arbeitenCnt, urlaubCnt, krankCnt };
}

/* ────── Format helpers ───── */
export function fmtMins(min: number): string {
  const sign = min < 0 ? "-" : "+";
  const abs = Math.abs(min);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

export function fmtHM(min: number): string {
  const abs = Math.abs(min);
  return `${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

export function fmtEUR(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
