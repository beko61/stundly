"use client";

import { useMemo } from "react";
import type { TimeEntry } from "@workly/shared";
import { useSalarySettingsRows } from "./useSalarySettings";
import { useTimeEntriesRangeQuery } from "./useTimeEntries";
import { useNotdienstEntriesQuery } from "./useNotdienstEntries";
import { rowForYear } from "@/lib/salary/byYear";
import { overtimeCarry, type OvertimeCarry } from "@/lib/vacation/overtimeCarry";
import {
  calcOvertimeToDate, notdienstYearLoadRange, DEFAULT_TARGET_HOURS_PER_MONTH, type NdEntry,
} from "@/lib/utils/monthStats";
import { getFeiertage } from "@/lib/utils/feiertage";

/**
 * Überstunden-Übertrag für `year` (lib/vacation/overtimeCarry): Saldo des Vorjahres — gleiche Rechnung
 * wie "Gesamt Überstunden" (calcOvertimeToDate) — oder der vom Nutzer gesetzte Wert.
 */
export function useOvertimeCarry(year: number, bundesland: string): OvertimeCarry & { loading: boolean } {
  const prev = year - 1;
  const { data: rows = [], isLoading: lRows } = useSalarySettingsRows();
  const { data: prevEntries = [], isLoading: lTe } = useTimeEntriesRangeQuery(`${prev}-01-01`, `${prev}-12-31`);
  const nd = notdienstYearLoadRange(prev);
  const { data: prevNd = [], isLoading: lNd } = useNotdienstEntriesQuery(nd.start, nd.end);

  return useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    const prevRow = rowForYear(rows, prev);
    // Vorjahr liegt noch in der Zukunft (z. B. 2029 ansehen) → kein Saldo
    const diff = prevEntries.length === 0 || prev > Number(todayISO.slice(0, 4))
      ? 0
      : calcOvertimeToDate({
          entries:   prevEntries as unknown as TimeEntry[],
          ndEntries: prevNd as unknown as NdEntry[],
          feiertage: getFeiertage(prev, bundesland),
          year:      prev,
          targetHoursPerMonth: prevRow?.monthly_target_hours ? Number(prevRow.monthly_target_hours) : DEFAULT_TARGET_HOURS_PER_MONTH,
          todayISO,
        }).diffMin;
    return { ...overtimeCarry(rows, year, diff), loading: lRows || lTe || lNd };
  }, [rows, prev, prevEntries, prevNd, bundesland, year, lRows, lTe, lNd]);
}
