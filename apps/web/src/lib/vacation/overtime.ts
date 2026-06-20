import { DAY_TYPES, type DayType, calculateWorkDuration } from "@workly/shared";

export interface OvertimeEntry {
  date:           string;
  start_time:     string | null;
  end_time:       string | null;
  break_minutes:  number | null;
  day_type:       DayType | null;
}

/** Notdienst tablosu girdisi (notdienst_entries) — saatleri workedMin'e eklenir. */
export interface OvertimeNdEntry {
  date:       string;
  start_time: string | null;
  end_time:   string | null;
}

export interface OvertimeResult {
  workedMin:    number;
  ndMin:        number;
  urlaubDays:   number;
  targetMin:    number;
  overtimeMin:  number;
}

const PAID_ABSENCE: ReadonlySet<string> = new Set<string>([
  DAY_TYPES.URLAUB,
  DAY_TYPES.KRANK,
  DAY_TYPES.FEIERTAG,
]);

function isoToUTC(iso: string): Date {
  const parts = iso.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  return new Date(Date.UTC(y, m - 1, d));
}

export function isWeekday(iso: string): boolean {
  const d = isoToUTC(iso).getUTCDay();
  return d !== 0 && d !== 6;
}

export function workdaysBetween(startISO: string, endISO: string): number {
  if (startISO > endISO) return 0;
  const start = isoToUTC(startISO);
  const end   = isoToUTC(endISO);
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const d = cur.getUTCDay();
    if (d !== 0 && d !== 6) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

export interface ComputeOvertimeOptions {
  /** Notdienst entries — saatleri workedMin'e eklenir (geçmiş tarihler). */
  ndEntries?: OvertimeNdEntry[];
  /** Günlük Sollstunden (default 8). monthly_target_hours / 21.7 kullanılabilir. */
  hoursPerDay?: number;
}

/**
 * Hedef = (yıl başından bugüne Mo-Fr) MINUS (ücretli izin Mo-Fr) × hoursPerDay.
 * Worked  = arbeiten entries (geçmiş) + notdienst entries (geçmiş)
 * Urlaub chart için YILIN tamamı boyunca urlaub Mo-Fr sayılır.
 */
export function computeOvertime(
  entries: OvertimeEntry[],
  yearStartISO: string,
  todayISO: string,
  optsOrHoursPerDay: ComputeOvertimeOptions | number = {},
): OvertimeResult {
  // Backward-compat: 4. parametre number olarak verildiyse hoursPerDay'dir.
  const opts: ComputeOvertimeOptions = typeof optsOrHoursPerDay === "number"
    ? { hoursPerDay: optsOrHoursPerDay }
    : optsOrHoursPerDay;
  const hoursPerDay = opts.hoursPerDay ?? 8;
  const ndEntries   = opts.ndEntries  ?? [];

  let workedMin        = 0;
  let ndMin            = 0;
  let paidAbsencePast  = 0;
  let urlaubDaysYearly = 0;

  for (const e of entries) {
    if (e.day_type === DAY_TYPES.URLAUB && isWeekday(e.date)) {
      urlaubDaysYearly++;
    }
    if (e.date > todayISO) continue;

    if (e.day_type === DAY_TYPES.ARBEITEN && e.start_time && e.end_time) {
      workedMin += calculateWorkDuration(e.start_time, e.end_time, e.break_minutes ?? 0).net_minutes;
    }
    if (e.day_type && PAID_ABSENCE.has(e.day_type) && isWeekday(e.date)) {
      paidAbsencePast++;
    }
  }

  // Notdienst saatleri — sadece geçmiş tarihler, hafta sonu dahil (gerçek çalışma).
  for (const n of ndEntries) {
    if (n.date > todayISO) continue;
    if (!n.start_time || !n.end_time) continue;
    ndMin += calculateWorkDuration(n.start_time, n.end_time, 0).net_minutes;
  }

  const workdaysTotal = workdaysBetween(yearStartISO, todayISO);
  const expectedDays  = Math.max(0, workdaysTotal - paidAbsencePast);
  const targetMin     = expectedDays * hoursPerDay * 60;
  const totalWorked   = workedMin + ndMin;
  const overtimeMin   = Math.max(0, totalWorked - targetMin);

  return { workedMin, ndMin, urlaubDays: urlaubDaysYearly, targetMin, overtimeMin };
}
