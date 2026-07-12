"use client";

import { useEffect, useMemo, useState } from "react";
import { useTrackerStore } from "@/store/trackerStore";
import { createClient } from "@/lib/supabase/client";
import { calculateWorkDuration } from "@workly/shared";
import { notdienstBelongsToMonth, notdienstLoadRange, weekMondayOf } from "@/lib/utils/weekMonth";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { useTimeEntriesQuery } from "@/hooks/queries/useTimeEntries";

interface NdRow {
  date: string;
  start_time: string;
  end_time: string;
  erledigt?: boolean;
}

interface WeekStat {
  kw:        number;     // ISO Kalenderwoche
  ndCount:   number;
  ndMins:    number;
  workedMins: number;    // normal arbeit (entries)
  sollMins:  number;     // hedef saatler
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

// Standart günlük saatler (07.06.2026'dan beri sabit): Mo-Fr 8h, Sa/So 0
function getDayStdMins(dow: number): number {
  if (dow === 0 || dow === 6) return 0;
  return 8 * 60;
}

function minsToTime(min: number): string {
  const sign = min < 0 ? "-" : "";
  const abs = Math.abs(min);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

export function NotdienstWeekly() {
  const { year, month, ndVersion } = useTrackerStore();
  const { data: entries = [] } = useTimeEntriesQuery(year, month);
  const [ndRows, setNdRows] = useState<NdRow[]>([]);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      // Genişletilmiş aralık (ayın 1'i → ayın son günü + 7) — sonra haftaya göre filtre
      const { start, end } = notdienstLoadRange(year, month);
      const { data } = await supabase
        .from("notdienst_entries")
        .select("date, start_time, end_time, erledigt")
        .eq("user_id", session.user.id)
        .gte("date", start)
        .lte("date", end);
      if (!data) return;
      const filtered = (data as NdRow[]).filter(nd =>
        notdienstBelongsToMonth(nd.date, year, month)
      );
      setNdRows(filtered);
    }
    void load();
  }, [year, month, ndVersion]);

  // Group by Kalenderwoche — hafta-Pazartesi'si bu aya düşen tüm haftaları kapsa.
  // Notdienst tarihi başka ayda olsa bile, haftanın Pazartesi'si bu ayda ise hafta dahil.
  const weeks = useMemo(() => {
    const byKw = new Map<number, WeekStat>();

    // 1) Notdienst'ler haftaları belirler — her unique KW için ilk Pazartesi'yi hesapla
    //    ve haftanın TÜM 5 işgünü için Sollstunden ekle (taşan günler dahil)
    const kwToMonday = new Map<number, Date>();
    for (const nd of ndRows) {
      const kw = isoWeek(nd.date);
      if (!kwToMonday.has(kw)) kwToMonday.set(kw, weekMondayOf(nd.date));
      const cur = byKw.get(kw) ?? { kw, ndCount: 0, ndMins: 0, workedMins: 0, sollMins: 0 };
      if (nd.start_time && nd.end_time) {
        cur.ndCount++;
        cur.ndMins += calculateWorkDuration(nd.start_time, nd.end_time, 0).net_minutes;
      }
      byKw.set(kw, cur);
    }

    // 2) Her KW için 5 işgünü Sollstunden (Mo-Fr × 8h = 40h tam hafta)
    for (const [kw, monday] of kwToMonday) {
      const cur = byKw.get(kw)!;
      for (let i = 0; i < 5; i++) {
        const day = new Date(monday);
        day.setDate(day.getDate() + i);
        cur.sollMins += getDayStdMins(day.getDay());
      }
    }

    // 3) Arbeiten time_entries'lerden gerçek çalışılan dakikalar
    //    Sadece bu ayın entries'leri var elimizde — taşan günlerin Arbeiten'i gerekirse ayrıca yüklenebilir.
    //    Şimdilik elimizdeki entries'lerden bu KW'lara katkıyı ekle.
    for (const e of entries) {
      if (e.day_type !== "arbeiten" || !e.start_time || !e.end_time) continue;
      const kw = isoWeek(e.date);
      const cur = byKw.get(kw);
      if (!cur) continue;
      const { net_minutes } = calculateWorkDuration(e.start_time, e.end_time, e.break_minutes);
      cur.workedMins += net_minutes;
    }

    return Array.from(byKw.values()).sort((a, b) => a.kw - b.kw);
  }, [entries, ndRows]);

  if (weeks.length === 0) return null;

  const totals = weeks.reduce(
    (acc, w) => ({
      ndMins:  acc.ndMins  + w.ndMins,
      ndCount: acc.ndCount + w.ndCount,
      ue:      acc.ue      + (w.workedMins - w.sollMins + w.ndMins),
    }),
    { ndMins: 0, ndCount: 0, ue: 0 }
  );
  const maxNdMins = Math.max(...weeks.map(w => w.ndMins), 1);
  const uePos = totals.ue >= 0;

  function toggle() {
    setCollapsed(c => {
      const next = !c;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  }

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
      <button
        type="button"
        onClick={toggle}
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
          🚨 Notdienst — Wochenübersicht
          <InfoTooltip title="So liest sich diese Tabelle" color="var(--orange)">
            <strong>KW</strong>: Kalenderwoche. Eine Woche wird dem Monat
            zugeordnet, in dem ihr Montag liegt — auch wenn Notdienste am
            Wochenende in den Folgemonat fallen.
            {"\n\n"}
            <strong>Nd-Std</strong>: Anzahl Einsätze · Summe der
            Notdienst-Stunden in dieser Woche.
            {"\n\n"}
            <strong>Überstd</strong>: Wochenüberstunden = (Geleistete Arbeit −
            Sollstunden 40h) + Notdienst-Stunden. Positiv = Plus für dich,
            negativ = Minus.
          </InfoTooltip>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
          <span style={{ color: "var(--orange)", fontWeight: 700 }}>{totals.ndCount}×</span>
          <span style={{ color: "var(--orange)" }}>{minsToTime(totals.ndMins)}</span>
          <span style={{ color: uePos ? "var(--green)" : "var(--red)" }}>
            {uePos ? "+" : ""}{minsToTime(totals.ue)}
          </span>
          <span style={{ fontSize: 14, transition: "transform 0.2s", transform: collapsed ? "rotate(0deg)" : "rotate(180deg)" }}>▼</span>
        </span>
      </button>

      {!collapsed && (
        <div style={{ padding: "0 14px 14px", borderTop: "1px solid var(--border)" }}>
          {/* Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "44px 1fr 90px 70px",
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
            <span style={{ textAlign: "right" }}>Überstd</span>
          </div>

          {/* Rows */}
          {weeks.map(w => {
            const diff = w.workedMins - w.sollMins;
            const ue = diff + w.ndMins;
            const uePosRow = ue >= 0;
            const pct = Math.round((w.ndMins / maxNdMins) * 100);
            return (
              <div key={w.kw} style={{
                display: "grid",
                gridTemplateColumns: "44px 1fr 90px 70px",
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
                <span style={{ textAlign: "right", fontFamily: "'DM Mono',monospace", color: uePosRow ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
                  {uePosRow ? "+" : ""}{minsToTime(ue)}
                </span>
              </div>
            );
          })}

          {/* Foot */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "44px 1fr 90px 70px",
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
              {minsToTime(totals.ndMins)}
            </span>
            <span style={{ textAlign: "right", fontFamily: "'DM Mono',monospace", color: uePos ? "var(--green)" : "var(--red)" }}>
              {uePos ? "+" : ""}{minsToTime(totals.ue)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
