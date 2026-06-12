/**
 * Notdienst için "hafta-ay atfı" yardımcıları.
 *
 * Kural: Bir hafta, Pazartesi'sinin bulunduğu ayda sayılır.
 *
 * Örnek: 28 Apr (Mo) – 4 Mai (So) haftası → Pazartesi 28 Apr → tamamı NİSAN ayına
 * yazılır. Mayıs Wochenübersicht bu Notdienst'leri göstermez ve sayılmaz.
 *
 * Diğer veriler (Arbeiten, Urlaub, Krank, Feiertag) gün-bazlı sayılmaya devam eder —
 * sadece Notdienst için bu kural uygulanır.
 */

/** Verilen tarihin (ISO YYYY-MM-DD) bulunduğu ISO haftasının Pazartesi'sini döner. */
export function weekMondayOf(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00`);
  // getDay: Pazar=0, Pzt=1, ..., Cmt=6 → Pzt=0 olacak şekilde normalize et
  const dow = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - (dow - 1));
  return d;
}

/** Notdienst tarihinin "ait olduğu" ay: haftasının Pazartesi'sinin bulunduğu ay. */
export function notdienstMonthOf(dateStr: string): { year: number; month: number } {
  const mon = weekMondayOf(dateStr);
  return { year: mon.getFullYear(), month: mon.getMonth() + 1 };
}

/** Notdienst tarihi verilen aya ait mi? (hafta-Pazartesi'si o aydaysa true) */
export function notdienstBelongsToMonth(dateStr: string, year: number, month: number): boolean {
  const m = notdienstMonthOf(dateStr);
  return m.year === year && m.month === month;
}

/**
 * Bir Notdienst sorgusunda hangi tarih aralığını çekmemiz gerek?
 * Cevap: ayın 1'i → ayın son günü + 7 gün (sonraki ayın ilk haftasına taşan günleri kapsar).
 * Sonradan notdienstBelongsToMonth ile filtrelenir.
 */
export function notdienstLoadRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const last  = new Date(year, month, 0); // ayın son günü
  const ext   = new Date(last);
  ext.setDate(ext.getDate() + 7);          // +7 gün (haftanın taşması)
  const end   = ext.toISOString().split("T")[0]!;
  return { start, end };
}
