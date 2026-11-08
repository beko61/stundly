"use client";

import { formatDur } from "@/lib/utils/formatDur";
import { useMemo, useEffect, useState } from "react";
import { useTrackerStore } from "@/store/trackerStore";
import { notdienstBelongsToMonth, notdienstLoadRange } from "@/lib/utils/weekMonth";
import { calcMonthStats, type NdEntry as NdEntryHelper } from "@/lib/utils/monthStats";
import { useTimeEntriesQuery, useTimeEntriesRangeQuery } from "@/hooks/queries/useTimeEntries";
import { useSalarySettingsQuery } from "@/hooks/queries/useSalarySettings";
import { useNotdienstEntriesQuery } from "@/hooks/queries/useNotdienstEntries";
import { findWeeklyCapViolations } from "@workly/shared";
import { urlaubskontoFor } from "@/lib/vacation/urlaubskonto";
import { useCompanyMembership } from "@/hooks/queries/useCompanyMembership";

const TARGET_HOURS_DEFAULT = 174;

interface NdEntry { date: string; start_time: string; end_time: string; erledigt?: boolean; }

/** Dauer im einheitlichen Format ("8h 15m") — siehe lib/utils/formatDur. */
function minsToTime(min: number): string {
  return formatDur(min);
}

interface MonthlySummaryProps {
  /** Otomatik tespit edilen Feiertag'lar (Tracker'dan geçer). DB'de entry'si olmayan
   *  Mo-Fr Feiertag'lar (örn. Neujahr) Sollstunden'e dahil edilir ki Differenz doğru olsun. */
  feiertage?: Record<string, string>;
}

export function MonthlySummary({ feiertage }: MonthlySummaryProps = {}) {
  const { year, month } = useTrackerStore();
  const { data: entries = [] } = useTimeEntriesQuery(year, month);
  const { data: salarySettings } = useSalarySettingsQuery();
  const { data: membership } = useCompanyMembership();
  const ndRange = notdienstLoadRange(year, month);
  const { data: ndRaw = [] } = useNotdienstEntriesQuery(ndRange.start, ndRange.end);
  // Ganzes Jahr fürs Urlaubskonto (gleiche Rechnung wie Urlaub/Dashboard/Gehalt)
  const { data: yearEntries = [] } = useTimeEntriesRangeQuery(`${year}-01-01`, `${year}-12-31`);

  // localStorage'daki live salary_settings güncellemesi — user salary sayfasında
  // slider oynattığında MonthlySummary anında güncellensin (cross-component).
  // salary/page.tsx localStorage set ediyor (workly_salary_settings_v2 key).
  const [localOverride, setLocalOverride] = useState<{ monthly_target_hours?: number; urlaub_anspruch?: number }>({});
  useEffect(() => {
    const applyLocal = (raw: string | null) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as { monthly_target_hours?: number; urlaub_anspruch?: number };
        setLocalOverride(parsed);
      } catch {}
    };
    const handler = (e: StorageEvent) => {
      if (e.key === "workly_salary_settings_v2") applyLocal(e.newValue);
    };
    window.addEventListener("storage", handler);
    try { applyLocal(localStorage.getItem("workly_salary_settings_v2")); } catch {}
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Priority: localStorage override > RQ salary_settings > default
  const targetHours = localOverride.monthly_target_hours
    ?? (salarySettings?.monthly_target_hours ? Number(salarySettings.monthly_target_hours) : TARGET_HOURS_DEFAULT);

  // Hafta'nın Pazartesi'si bu aya düşen Notdienst entry'lerini filtrele
  const ndEntries = useMemo(
    () => ndRaw.filter(nd => notdienstBelongsToMonth(nd.date, year, month)) as NdEntry[],
    [ndRaw, year, month],
  );

  const stats = useMemo(() => {
    const r = calcMonthStats({
      entries,
      ndEntries: ndEntries as NdEntryHelper[],
      feiertage: feiertage ?? {},
      year, month,
      targetHoursPerMonth: targetHours,
    });
    return {
      workedMin:    r.workedMin,
      krankDays:    r.krankDays,
      urlaubDays:   r.urlaubDays,
      urlaubMin:    r.urlaubMin,
      krankMin:     r.krankMin,
      diffMin:      r.diffMin,
      targetMin:    r.targetMin,
      dailyCapViolations: r.dailyCapViolations,
      weeklyViolations:   findWeeklyCapViolations(entries),
    };
  }, [entries, ndEntries, targetHours, feiertage, year, month]);

  const { konto, usedThisYear } = useMemo(
    () => urlaubskontoFor({ settings: salarySettings, yearEntries, year, contract: membership?.contract }),
    [salarySettings, yearEntries, year, membership?.contract],
  );

  // ── Kart bileşeni ──
  function Card({ title, icon, color, big, mid, sub }: {
    title: string; icon?: string; color: string; big: string; mid?: string; sub?: string;
  }) {
    return (
      <div style={{
        background: `color-mix(in srgb, ${color} 10%, var(--surface))`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        borderRadius: 12,
        padding: "10px 12px",
        minWidth: 120,
        flex: "1 1 130px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color, textTransform: "uppercase",
          letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 4,
        }}>
          {icon && <span style={{ fontSize: 12 }}>{icon}</span>} {title}
        </div>
        <div style={{
          fontFamily: "'DM Mono',monospace", fontSize: 17, fontWeight: 700, color,
          lineHeight: 1.1, marginTop: 2,
        }}>
          {big}
        </div>
        {mid && (
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--muted)" }}>
            {mid}
          </div>
        )}
        {sub && (
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--muted)" }}>
            {sub}
          </div>
        )}
      </div>
    );
  }

  const diffColor = stats.diffMin >= 0 ? "var(--green)" : "var(--red)";

  return (
    <div className="summary-wrapper">
      {stats.dailyCapViolations.length > 0 && (
        <div
          role="alert"
          style={{
            marginBottom: 10,
            padding: "8px 12px",
            borderRadius: 10,
            background: "color-mix(in srgb, var(--red) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--red) 35%, transparent)",
            fontSize: 12,
            color: "var(--red)",
            lineHeight: 1.45,
          }}
        >
          🚫 <strong>§3 ArbZG:</strong> An {stats.dailyCapViolations.length}{" "}
          {stats.dailyCapViolations.length === 1 ? "Tag" : "Tagen"} wurde die
          werktägliche Höchst­arbeits­zeit von <strong>10 h</strong> überschritten
          {" — "}
          {stats.dailyCapViolations.slice(0, 3).map(iso => iso.slice(8)).join(", ")}
          {stats.dailyCapViolations.length > 3 && ` +${stats.dailyCapViolations.length - 3}`}
          . Ausgleich innerhalb 6 Monaten (Ø ≤ 8h/Werktag) nötig.
        </div>
      )}
      {stats.weeklyViolations.length > 0 && (
        <div
          role="alert"
          style={{
            marginBottom: 10,
            padding: "8px 12px",
            borderRadius: 10,
            background: "color-mix(in srgb, var(--yellow) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--yellow) 40%, transparent)",
            fontSize: 12,
            color: "var(--yellow)",
            lineHeight: 1.45,
          }}
        >
          ⚠️ <strong>§3 ArbZG (Wöchentlich):</strong> {stats.weeklyViolations.length}{" "}
          {stats.weeklyViolations.length === 1 ? "Woche" : "Wochen"} mit mehr als{" "}
          <strong>48 h</strong> Arbeit
          {" — "}
          {stats.weeklyViolations.slice(0, 3).map(w => `${w.isoWeek} (${minsToTime(w.netMinutes)})`).join(", ")}
          {stats.weeklyViolations.length > 3 && ` +${stats.weeklyViolations.length - 3}`}
          . 6-Monats-Ø ≤ 48h/Woche einhalten (Ausgleichszeitraum).
        </div>
      )}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
        gap: 8,
      }}>
        {/* 1. Differenz (Notdienst dahil) */}
        <Card
          title="Differenz"
          icon="📊"
          color={diffColor}
          big={`${stats.diffMin >= 0 ? "+" : ""}${minsToTime(stats.diffMin)}`}
          mid={stats.diffMin >= 0 ? "Überstunden" : "unter Soll"}
          sub="inkl. Notdienst"
        />

        {/* 2. Gearbeitet */}
        <Card
          title="Gearbeitet"
          icon="⏱"
          color="var(--blue)"
          big={minsToTime(stats.workedMin)}
          mid={`von ${minsToTime(stats.targetMin)}`}
        />

        {/* 3. Urlaub + Krank kombine */}
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "10px 12px",
          minWidth: 120,
          flex: "1 1 130px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}>
          <div style={{ borderRight: "1px solid var(--border)", paddingRight: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--blue)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              🏖 Urlaub
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 700, color: "var(--blue)", lineHeight: 1.1, marginTop: 2 }}>
              {stats.urlaubDays} T
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--muted)", marginTop: 1 }}>
              {minsToTime(stats.urlaubMin)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--red)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              🤒 Krank
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 700, color: "var(--red)", lineHeight: 1.1, marginTop: 2 }}>
              {stats.krankDays} T
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--muted)", marginTop: 1 }}>
              {minsToTime(stats.krankMin)}
            </div>
          </div>
        </div>

        {/* Notdienst: eigene Karte darunter (NotdienstWeekly — Wochen, Stunden, bezahlt) */}

        {/* 4. Urlaubskonto */}
        <Card
          title="Urlaubskonto"
          icon="🌴"
          color="var(--accent2)"
          big={`${konto.remaining} Tage`}
          mid={`von ${konto.totalEntitlement} verfügbar`}
          sub={`${usedThisYear} verbraucht ${year}`}
        />
      </div>
    </div>
  );
}
