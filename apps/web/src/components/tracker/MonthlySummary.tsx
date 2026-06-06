"use client";

import { useMemo, useEffect, useState } from "react";
import { useTrackerStore } from "@/store/trackerStore";
import { formatDuration, DAY_TYPES } from "@workly/shared";
import { calculateWorkDuration } from "@workly/shared";
import { createClient } from "@/lib/supabase/client";

const TARGET_HOURS_MONTH = 174;

interface NdEntry { date: string; start_time: string; end_time: string; erledigt?: boolean; }

// ── Pie / Donut chart ──────────────────────────────────────────────────────

interface Slice { value: number; color: string; label: string; }

function DonutChart({ slices, cx = 60, cy = 60, r = 48, stroke = 14 }: {
  slices: Slice[]; cx?: number; cy?: number; r?: number; stroke?: number;
}) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return (
    <svg width={cx * 2} height={cy * 2}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface2)" strokeWidth={stroke} />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central"
        style={{ fill: "var(--muted)", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>—</text>
    </svg>
  );

  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width={cx * 2} height={cy * 2} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface2)" strokeWidth={stroke} />
      {slices.filter(sl => sl.value > 0).map((sl, i) => {
        const dash = (sl.value / total) * circ;
        const gap  = circ - dash;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={sl.color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function MonthlySummary() {
  const { entries, year, month, ndVersion } = useTrackerStore();
  const [ndEntries, setNdEntries] = useState<NdEntry[]>([]);

  // Load notdienst_entries for the month (for accurate hour counting)
  useEffect(() => {
    async function loadNd() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const startDate   = `${year}-${String(month).padStart(2,"0")}-01`;
      const daysInMonth = new Date(year, month, 0).getDate();
      const endDate     = `${year}-${String(month).padStart(2,"0")}-${String(daysInMonth).padStart(2,"0")}`;
      const { data } = await supabase
        .from("notdienst_entries")
        .select("date, start_time, end_time, erledigt")
        .eq("user_id", session.user.id)
        .gte("date", startDate)
        .lte("date", endDate);
      if (data) setNdEntries(data as NdEntry[]);
    }
    void loadNd();
  }, [year, month, ndVersion]);

  const stats = useMemo(() => {
    let workedMin    = 0;
    let krankDays    = 0;
    let feiertagDays = 0;
    let freiDays     = 0;
    let arbeitenDays = 0;

    // Dates that have notdienst sub-entries (weekends + weekdays)
    const notdienstDates = new Set(ndEntries.map(nd => nd.date));
    const notdienstDays  = notdienstDates.size;

    for (const e of entries) {
      switch (e.day_type) {
        case DAY_TYPES.KRANK:    krankDays++;    break;
        case DAY_TYPES.FEIERTAG: feiertagDays++; break;
        case DAY_TYPES.FREI:     freiDays++;     break;
        case DAY_TYPES.ARBEITEN: arbeitenDays++; break;
      }

      if (!e.start_time || !e.end_time) {
        // Paid absences: count as 8h toward target (German law)
        if (e.day_type === DAY_TYPES.KRANK || e.day_type === DAY_TYPES.FEIERTAG)
          workedMin += 8 * 60;
        continue;
      }
      if (e.day_type === DAY_TYPES.NOTDIENST) continue; // counted separately below
      if (e.day_type === DAY_TYPES.FREI) continue;

      const { net_minutes } = calculateWorkDuration(e.start_time, e.end_time, e.break_minutes);
      workedMin += net_minutes;
    }

    // Notdienst hours from sub-entries (accurate, includes weekends)
    const notdienstMin = ndEntries.reduce((sum, nd) => {
      if (!nd.start_time || !nd.end_time) return sum;
      return sum + calculateWorkDuration(nd.start_time, nd.end_time, 0).net_minutes;
    }, 0);

    const ndPaid   = ndEntries.filter(nd => nd.erledigt).length;
    const ndOffen  = ndEntries.length - ndPaid;

    const targetMin   = TARGET_HOURS_MONTH * 60;
    const diffMin     = workedMin - targetMin;                             // regular work vs target
    const ueberstunden = Math.max(0, workedMin - targetMin);               // only positive surplus

    return {
      workedMin, notdienstMin, notdienstDays,
      krankDays, feiertagDays, freiDays, arbeitenDays,
      diffMin, ueberstunden,
      ndPaid, ndOffen, ndCount: ndEntries.length,
    };
  }, [entries, ndEntries]);

  const workedH = Math.round(stats.workedMin / 60 * 10) / 10;
  const workedPct = Math.min(100, (stats.workedMin / (TARGET_HOURS_MONTH * 60)) * 100);
  const fmt = (min: number) => formatDuration(Math.round(Math.abs(min)));

  const piSlices: Slice[] = [
    { value: stats.arbeitenDays,  color: "var(--green)",  label: "Arbeiten"  },
    { value: stats.notdienstDays, color: "var(--orange)", label: "Notdienst" },
    { value: stats.krankDays,     color: "var(--red)",    label: "Krank"     },
    { value: stats.feiertagDays,  color: "var(--yellow)", label: "Feiertag"  },
    { value: stats.freiDays,      color: "var(--muted)",  label: "Frei"      },
  ];

  return (
    <div className="summary-wrapper">
      {/* ── Main card ── */}
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 18,
        padding: 16,
        display: "flex",
        gap: 16,
        alignItems: "center",
      }}>

        {/* Donut left */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <DonutChart slices={piSlices} />
          {/* Center label */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>
              {workedH}h
            </span>
            <span style={{ fontSize: 8, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>
              /{TARGET_HOURS_MONTH}h
            </span>
          </div>
        </div>

        {/* Right side */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Progress bar */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Gearbeitet
              </span>
              <span style={{
                fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700,
                color: stats.diffMin >= 0 ? "var(--green)" : "var(--red)",
              }}>
                {stats.diffMin >= 0 ? "+" : "-"}{fmt(stats.diffMin)}
              </span>
            </div>
            <div style={{ background: "var(--surface2)", borderRadius: 4, height: 6, overflow: "hidden" }}>
              <div style={{
                width: `${workedPct}%`, height: "100%", borderRadius: 4,
                background: stats.diffMin >= 0 ? "var(--green)" : "var(--red)",
                transition: "width 0.5s",
              }} />
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {/* Notdienst */}
            <div style={{
              background: "color-mix(in srgb, var(--orange) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--orange) 25%, transparent)",
              borderRadius: 10, padding: "8px 10px",
            }}>
              <div style={{ fontSize: 9, color: "var(--orange)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
                Notdienst
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 700, color: "var(--orange)", lineHeight: 1 }}>
                {stats.ndCount}× · {fmt(stats.notdienstMin)}
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--muted)", marginTop: 2, display: "flex", gap: 8 }}>
                {stats.ndPaid > 0 && <span style={{ color: "var(--green)" }}>✅{stats.ndPaid}</span>}
                {stats.ndOffen > 0 && <span style={{ color: "var(--red)" }}>❌{stats.ndOffen}</span>}
                {stats.ndCount === 0 && <span>—</span>}
              </div>
            </div>

            {/* Überstunden */}
            <div style={{
              background: stats.ueberstunden > 0
                ? "color-mix(in srgb, var(--accent2) 8%, transparent)"
                : "color-mix(in srgb, var(--muted) 8%, transparent)",
              border: `1px solid ${stats.ueberstunden > 0
                ? "color-mix(in srgb, var(--accent2) 25%, transparent)"
                : "color-mix(in srgb, var(--muted) 25%, transparent)"}`,
              borderRadius: 10, padding: "8px 10px",
            }}>
              <div style={{ fontSize: 9, color: stats.ueberstunden > 0 ? "var(--accent2)" : "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
                Überstunden
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 700, color: stats.ueberstunden > 0 ? "var(--accent2)" : "var(--muted)", lineHeight: 1 }}>
                +{fmt(stats.ueberstunden)}
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                über Soll
              </div>
            </div>

            {/* Krank */}
            {stats.krankDays > 0 && (
              <div style={{
                background: "color-mix(in srgb, var(--red) 8%, transparent)",
                border: "1px solid color-mix(in srgb, var(--red) 25%, transparent)",
                borderRadius: 10, padding: "8px 10px",
              }}>
                <div style={{ fontSize: 9, color: "var(--red)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
                  Krank
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 700, color: "var(--red)", lineHeight: 1 }}>
                  {stats.krankDays}T
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                  {stats.krankDays * 8}h
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            {piSlices.filter(s => s.value > 0).map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700 }}>
                  {s.label} {s.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
