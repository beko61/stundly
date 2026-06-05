import type { WorkCalculation } from "../types";

/**
 * Parse "HH:mm" string into total minutes since midnight.
 */
export function parseTimeToMinutes(time: string): number {
  const [hoursStr, minutesStr] = time.split(":");
  const hours = parseInt(hoursStr ?? "0", 10);
  const minutes = parseInt(minutesStr ?? "0", 10);
  return hours * 60 + minutes;
}

/**
 * Format minutes since midnight back to "HH:mm".
 */
export function formatMinutesToTime(totalMinutes: number): string {
  const h = Math.floor(Math.abs(totalMinutes) / 60);
  const m = Math.abs(totalMinutes) % 60;
  const sign = totalMinutes < 0 ? "-" : "";
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Calculate net work duration given start, end, and break.
 * Handles overnight shifts (e.g. 22:00 → 06:00).
 */
export function calculateWorkDuration(
  startTime: string,
  endTime: string,
  breakMinutes: number
): WorkCalculation {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes   = parseTimeToMinutes(endTime);

  const isOvernight = endMinutes < startMinutes;
  const totalMinutes = isOvernight
    ? 24 * 60 - startMinutes + endMinutes
    : endMinutes - startMinutes;

  const netMinutes = Math.max(0, totalMinutes - breakMinutes);

  return {
    total_minutes: totalMinutes,
    break_minutes: breakMinutes,
    net_minutes:   netMinutes,
    is_overnight:  isOvernight,
  };
}

/**
 * Convert minutes to decimal hours (e.g. 90 → 1.5).
 */
export function minutesToHours(minutes: number): number {
  return minutes / 60;
}

/**
 * Format minutes as "Xh Ym" display string.
 */
export function formatDuration(minutes: number): string {
  if (minutes === 0) return "0h";
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? "-" : "";
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}m`;
}

/**
 * Calculate overtime minutes given actual worked minutes and target minutes.
 * Returns positive for overtime, negative for undertime.
 */
export function calculateOvertime(
  workedMinutes: number,
  targetMinutes: number
): number {
  return workedMinutes - targetMinutes;
}

/**
 * Sum up total worked minutes across multiple entries.
 */
export function sumWorkedMinutes(
  entries: Array<{ start_time: string | null; end_time: string | null; break_minutes: number }>
): number {
  return entries.reduce((sum, entry) => {
    if (!entry.start_time || !entry.end_time) return sum;
    const { net_minutes } = calculateWorkDuration(
      entry.start_time,
      entry.end_time,
      entry.break_minutes
    );
    return sum + net_minutes;
  }, 0);
}

/**
 * Get the number of working days in a month (Mon–Fri, excluding given holidays).
 */
export function getWorkingDaysInMonth(
  year: number,
  month: number, // 1-based
  holidayDates: string[] = []
): number {
  const holidays = new Set(holidayDates);
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dow = date.getDay(); // 0=Sun, 6=Sat
    const iso = date.toISOString().split("T")[0]!;
    if (dow !== 0 && dow !== 6 && !holidays.has(iso)) {
      count++;
    }
  }

  return count;
}
