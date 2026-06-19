/**
 * Notdienst için "hafta-ay atfı" yardımcıları.
 *
 * Kural: Bir hafta, Pazar'ının (haftanın son günü) bulunduğu ayda sayılır.
 *
 * Örnek: 28 Apr (Mo) – 4 Mai (So) haftası → Pazar 4 Mai → tamamı MAYIS ayına
 * yazılır. Nisan Wochenübersicht bu Notdienst'leri göstermez ve sayılmaz.
 *
 * Diğer veriler (Arbeiten, Urlaub, Krank, Feiertag) gün-bazlı sayılmaya devam eder —
 * sadece Notdienst için bu kural uygulanır.
 *
 * Not: 2026-06-19 tarihinde kural Pazartesi → Pazar bazlı olarak değiştirildi.
 */

/** Verilen tarihin (ISO YYYY-MM-DD) bulunduğu ISO haftasının Pazartesi'sini döner.
 *  Sadece UI gösterim (hafta etiketi) için — atıf hesabında kullanılmaz. */
export function weekMondayOf(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00`);
  const dow = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - (dow - 1));
  return d;
}

/** Verilen tarihin (ISO YYYY-MM-DD) bulunduğu ISO haftasının Pazar'ını döner. */
export function weekSundayOf(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00`);
  // ISO Pzt=1 ... Pzr=7. JS getDay: Pzr=0 — normalize et.
  const dow = d.getDay() === 0 ? 7 : d.getDay();
  const daysToSunday = 7 - dow;
  d.setDate(d.getDate() + daysToSunday);
  return d;
}

/** Notdienst tarihinin "ait olduğu" ay: haftasının Pazar'ının bulunduğu ay. */
export function notdienstMonthOf(dateStr: string): { year: number; month: number } {
  const sun = weekSundayOf(dateStr);
  return { year: sun.getFullYear(), month: sun.getMonth() + 1 };
}

/** Notdienst tarihi verilen aya ait mi? (hafta Pazar'ı o aydaysa true) */
export function notdienstBelongsToMonth(dateStr: string, year: number, month: number): boolean {
  const m = notdienstMonthOf(dateStr);
  return m.year === year && m.month === month;
}

/**
 * Bir Notdienst sorgusunda hangi tarih aralığını çekmemiz gerek?
 * Hafta-ay atfı yön bağımsız olarak güvenli: her iki uca 7 gün pay.
 * Sonradan notdienstBelongsToMonth ile filtrelenir.
 */
export function notdienstLoadRange(year: number, month: number): { start: string; end: string } {
  // UTC tabanlı: tarayıcı timezone'undan bağımsız
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last  = new Date(Date.UTC(year, month, 0));
  first.setUTCDate(first.getUTCDate() - 7);
  last.setUTCDate(last.getUTCDate() + 7);
  return {
    start: first.toISOString().split("T")[0]!,
    end:   last.toISOString().split("T")[0]!,
  };
}

/** ISO 8601 Kalenderwoche (KW) — hafta numarası, Pazartesi haftanın 1. günü. */
export function isoWeek(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00`);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
