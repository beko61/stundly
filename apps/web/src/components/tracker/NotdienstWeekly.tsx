"use client";

import { formatDur } from "@/lib/utils/formatDur";
import { useMemo, useState } from "react";
import { useTrackerStore } from "@/store/trackerStore";
import { useNotdienstEntriesQuery } from "@/hooks/queries/useNotdienstEntries";
import { calculateWorkDuration } from "@workly/shared";
import { notdienstBelongsToMonth, notdienstLoadRange } from "@/lib/utils/weekMonth";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

interface NdRow {
  date: string;
  start_time: string;
  end_time: string;
  erledigt?: boolean;
}

interface WeekStat {
  kw:      number;     // ISO Kalenderwoche
  ndCount: number;
  ndMins:  number;
  ndPaid:  number;     // erledigt = bezahlt
}

const STORAGE_KEY = "stundly_nd_weekly_collapsed";

// ISO 8601 Kalenderwoche
function isoWeek(dateStr: string): number {
  const d = new Date(dateStr);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Dauer im einheitlichen Format ("8h 15m") — siehe lib/utils/formatDur. */
function minsToTime(min: number): string {
  return formatDur(min);
}

/**
 * Notdienste je Kalenderwoche (Anzahl, Stunden, bezahlt) — die einzige Notdienst-Karte im Tracker.
 * Überstunden stehen bewusst nur in der Monatsübersicht (lib/utils/monthStats) — eine eigene
 * Wochenrechnung wich davon ab (z.B. Urlaubstag als −8h) und doppelte die Zahl nur.
 */
export function buildNdWeeks(ndRows: NdRow[]): WeekStat[] {
  const byKw = new Map<number, WeekStat>();
  for (const nd of ndRows) {
    if (!nd.start_time || !nd.end_time) continue;
    const kw = isoWeek(nd.date);
    const cur = byKw.get(kw) ?? { kw, ndCount: 0, ndMins: 0, ndPaid: 0 };
    cur.ndCount++;
    cur.ndMins += calculateWorkDuration(nd.start_time, nd.end_time, 0).net_minutes;
    if (nd.erledigt) cur.ndPaid++;
    byKw.set(kw, cur);
  }
  return Array.from(byKw.values()).sort((a, b) => a.kw - b.kw);
}

export function NotdienstWeekly() {
  const { year, month } = useTrackerStore();
  // Gleiche Query wie Tracker/MonthlySummary (dedupliziert). Früher eigener Fetch nach dem
  // Mount → die Karte erschien verspätet und schob die Tagesliste nach unten.
  const { start, end } = notdienstLoadRange(year, month);
  const { data: ndRaw = [] } = useNotdienstEntriesQuery(start, end);
  const ndRows = useMemo(
    () => (ndRaw as unknown as NdRow[]).filter(nd => notdienstBelongsToMonth(nd.date, year, month)),
    [ndRaw, year, month],
  );
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });

  // Group by Kalenderwoche — Woche zählt zum Monat ihres Sonntags (notdienstBelongsToMonth).
  const weeks = useMemo(() => buildNdWeeks(ndRows), [ndRows]);

  if (weeks.length === 0) return null;

  const totals = weeks.reduce(
    (acc, w) => ({ ndMins: acc.ndMins + w.ndMins, ndCount: acc.ndCount + w.ndCount, ndPaid: acc.ndPaid + w.ndPaid }),
    { ndMins: 0, ndCount: 0, ndPaid: 0 }
  );
  // ✅ alle bezahlt · ⏳ noch offen — gleiche Symbole wie in der Tagesliste
  const paidLabel = (paid: number, count: number) => `${paid === count ? "✅" : "⏳"} ${paid}/${count}`;
  const maxNdMins = Math.max(...weeks.map(w => w.ndMins), 1);

  function toggle() {
    setCollapsed(c => {
      const next = !c;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  }

  const cols = "44px 1fr 96px 64px";
  return (
    <div style={{
      margin: "12px 12px 0",
      maxWidth: 960,
      marginLeft: "auto",
      marginRight: "auto",
      background: "var(--surface)",
      border: "1px solid color-mix(in srgb, var(--orange) 30%, transparent)",
      borderRadius: 14,
      overflow: "hidden",
    }}>
      {/* div statt <button>: enthält den ℹ️-Button (Button in Button ist ungültiges HTML) */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return; // Enter auf dem ℹ️-Button nicht weiterreichen
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
        }}
        style={{
          width: "100%",
          padding: "12px 14px",
          background: "transparent",
          border: "none",
          color: "var(--text)",
          fontFamily: "'Syne',sans-serif",
          fontWeight: 800,
          fontSize: 13,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          🚨 Notdienst
          <InfoTooltip title="Notdienst — so wird gezählt" color="var(--orange)">
            <strong>Wann?</strong> Außerhalb der regulären Arbeitszeit
            (Abend / Nacht / Wochenende), eingetragen mit „+ Notdienst hinzufügen“
            am jeweiligen Tag.
            {"\n\n"}
            <strong>KW / Monatszuordnung:</strong> Eine Notdienst-Woche zählt
            immer zu dem Monat, in dem ihr Sonntag liegt. Beispiel: KW vom
            28. Apr (Mo) bis 4. Mai (So) → komplett Mai.
            {"\n\n"}
            <strong>Bezahlt:</strong> ✅ alle bezahlt / ⏳ noch offen — Tippe
            im Tag auf das Symbol, um umzuschalten. Notdienst wird oft erst
            im Folgemonat ausgezahlt.
            {"\n\n"}
            <strong>Lohn:</strong> Notdienst-Stunden fließen oben in die
            „Differenz“ und werden mit deinem Notdienst-Bonus (€/Tag)
            aus den Lohn-Einstellungen vergütet.
          </InfoTooltip>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
          <span style={{ color: "var(--orange)", fontWeight: 700 }}>{totals.ndCount}×</span>
          <span style={{ color: "var(--orange)" }}>{minsToTime(totals.ndMins)}</span>
          <span style={{ color: "var(--muted)" }}>{paidLabel(totals.ndPaid, totals.ndCount)}</span>
          <span style={{ fontSize: 14, transition: "transform 0.2s", transform: collapsed ? "rotate(0deg)" : "rotate(180deg)" }}>▼</span>
        </span>
      </div>

      {!collapsed && (
        <div style={{ padding: "0 14px 14px", borderTop: "1px solid var(--border)" }}>
          {/* Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: cols,
            gap: 8,
            padding: "10px 0 8px",
            fontSize: 10,
            color: "var(--muted)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            borderBottom: "1px solid var(--border)",
          }}>
            <span>KW</span>
            <span></span>
            <span style={{ textAlign: "right" }}>Nd-Std</span>
            <span style={{ textAlign: "right" }}>Bezahlt</span>
          </div>

          {/* Rows */}
          {weeks.map(w => {
            const pct = Math.round((w.ndMins / maxNdMins) * 100);
            return (
              <div key={w.kw} style={{
                display: "grid",
                gridTemplateColumns: cols,
                gap: 8,
                padding: "9px 0",
                alignItems: "center",
                borderBottom: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
                fontSize: 12,
              }}>
                <span style={{ fontFamily: "'DM Mono',monospace", color: "var(--muted)", fontWeight: 700 }}>
                  KW {w.kw}
                </span>
                <div style={{ height: 6, background: "var(--surface2)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: "var(--orange)", borderRadius: 3 }} />
                </div>
                <span style={{ textAlign: "right", fontFamily: "'DM Mono',monospace", color: "var(--orange)", fontWeight: 700 }}>
                  {w.ndCount}× · {minsToTime(w.ndMins)}
                </span>
                <span style={{ textAlign: "right", fontFamily: "'DM Mono',monospace", color: "var(--muted)" }}>
                  {paidLabel(w.ndPaid, w.ndCount)}
                </span>
              </div>
            );
          })}

          {/* Foot */}
          <div style={{
            display: "grid",
            gridTemplateColumns: cols,
            gap: 8,
            padding: "10px 0 4px",
            alignItems: "center",
            fontSize: 12,
            fontWeight: 800,
            borderTop: "2px solid var(--border)",
            marginTop: 4,
          }}>
            <span style={{ color: "var(--text)" }}>Ges.</span>
            <span></span>
            <span style={{ textAlign: "right", fontFamily: "'DM Mono',monospace", color: "var(--orange)" }}>
              {totals.ndCount}× · {minsToTime(totals.ndMins)}
            </span>
            <span style={{ textAlign: "right", fontFamily: "'DM Mono',monospace", color: "var(--muted)" }}>
              {paidLabel(totals.ndPaid, totals.ndCount)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
