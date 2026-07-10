/**
 * §3 EntgFG (Entgeltfortzahlungsgesetz) — Lohnfortzahlung bei Krankheit
 *
 * §3 Abs. 1 EntgFG: Ist ein Arbeitnehmer durch Krankheit an seiner Arbeits-
 * leistung verhindert, so hat er Anspruch auf Entgeltfortzahlung im Krankheits-
 * fall durch den Arbeitgeber für die Zeit der Arbeitsunfähigkeit bis zur
 * Dauer von **sechs Wochen** (= 42 Kalendertage).
 *
 * Nach Ablauf der 6 Wochen tritt das Krankengeld der Krankenkasse ein
 * (§ 44 SGB V — 70 % des Bruttos, max. 90 % des Nettos).
 *
 * VEREINFACHUNGEN (Product-Ansatz, kein Payroll-Ersatz):
 *  - "Fortsetzungserkrankung" §3 II EntgFG (gleiche Krankheit binnen 6 Monaten
 *    zusammengezählt) wird NICHT modelliert — wir tracken nur die
 *    kalendarische Kettenlänge von Krank-Einträgen.
 *  - "Wiederauffangfrist" 6 Monate für neuen Anspruch bei anderer Krankheit
 *    wird nicht modelliert.
 *  - Reset: jeder Nicht-Krank-Kalendertag (auch Wochenende ohne Krank-Eintrag)
 *    schließt eine Episode. Neue Krank-Serie = neue Episode.
 *  - Warn-only. Zahlungen werden nicht automatisch abgezogen.
 */

import type { TimeEntry } from "../types";
import { DAY_TYPES } from "../constants/dayTypes";

export const ENTGFG_KRANKHEIT_LIMIT_DAYS = 42; // 6 Wochen

export interface KrankheitEpisode {
  /** Erster Krank-Tag (YYYY-MM-DD) */
  start: string;
  /** Letzter Krank-Tag (YYYY-MM-DD) */
  end: string;
  /** Anzahl Kalendertage (start & end inklusive) */
  days: number;
  /** Kalendertage, die den 42-Tage-Anspruch überschreiten (43., 44., ... start-relativ) */
  excessDates: string[];
}

function pad2(n: number): string { return String(n).padStart(2, "0"); }

/** Verilen ISO tarihinden 1 gün sonrasını döndürür (kalender). */
function nextDayISO(iso: string): string {
  const [yStr, mStr, dStr] = iso.split("-");
  const y = Number(yStr); const m = Number(mStr); const d = Number(dStr);
  const dt = new Date(y, m - 1, d + 1);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

/**
 * Krankheit-Episoden hesapla — art arda gelen (kesintisiz) Krank-Einträge birlikte.
 *
 * Kural: iki Krank tarihi arasında en az 1 gün ara varsa (bir Kalendertag boşluğu),
 * ayrı episode. Yani 2026-01-10 Krank + 2026-01-11 Krank = kesintisiz. Ama
 * 2026-01-10 + 2026-01-12 = ayrı iki episode.
 */
export function calcKrankheitEpisodes(
  entries: Array<Pick<TimeEntry, "date" | "day_type">>,
): KrankheitEpisode[] {
  const krankDates = Array.from(
    new Set(entries.filter(e => e.day_type === DAY_TYPES.KRANK).map(e => e.date)),
  ).sort();

  const out: KrankheitEpisode[] = [];
  if (krankDates.length === 0) return out;

  let start = krankDates[0]!;
  let last  = krankDates[0]!;
  let days  = 1;

  const flush = () => {
    // Excess dates: 43. günden itibaren (start + 42 gün sonrası)
    const excess: string[] = [];
    if (days > ENTGFG_KRANKHEIT_LIMIT_DAYS) {
      let cur = start;
      // 42 gün ilerle
      for (let i = 0; i < ENTGFG_KRANKHEIT_LIMIT_DAYS; i++) cur = nextDayISO(cur);
      // cur = 43. gün
      while (cur <= last) {
        excess.push(cur);
        cur = nextDayISO(cur);
      }
    }
    out.push({ start, end: last, days, excessDates: excess });
  };

  for (let i = 1; i < krankDates.length; i++) {
    const cur = krankDates[i]!;
    if (cur === nextDayISO(last)) {
      last = cur;
      days++;
    } else {
      flush();
      start = cur;
      last  = cur;
      days  = 1;
    }
  }
  flush();
  return out;
}

/** 42 gün limit'ini aşan tüm Krank-Tarihleri (herhangi bir episode). */
export function findKrankheitExcessDays(
  entries: Array<Pick<TimeEntry, "date" | "day_type">>,
): string[] {
  return calcKrankheitEpisodes(entries).flatMap(e => e.excessDates);
}

/** Verilen entries içinde en uzun kesintisiz Krank streak günü (0 = hiç yok). */
export function longestKrankheitStreak(
  entries: Array<Pick<TimeEntry, "date" | "day_type">>,
): number {
  const episodes = calcKrankheitEpisodes(entries);
  if (episodes.length === 0) return 0;
  return Math.max(...episodes.map(e => e.days));
}
