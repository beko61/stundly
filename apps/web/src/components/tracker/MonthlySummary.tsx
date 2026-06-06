"use client";

import { useMemo, useEffect, useState } from "react";
import { useTrackerStore } from "@/store/trackerStore";
import { DAY_TYPES } from "@workly/shared";
import { calculateWorkDuration } from "@workly/shared";
import { createClient } from "@/lib/supabase/client";

const TARGET_HOURS_MONTH = 174;
const URLAUB_DEFAULT     = 30; // yıllık urlaub kontingenti (TODO: kullanıcı ayarına bağla)

// Standart günlük saatler (Hannover Vorlage): Mo-Do 8:15h, Fr 6:15h, weekend 0
// → Urlaub/Krank/Feiertag günleri bu kadar hedefe sayılır (önceki bug: hep 8h sayılıyordu)
function getDayStdMins(dateStr: string): number {
  const dow = new Date(dateStr).getDay();   // 0 Sun, 6 Sat
  if (dow === 0 || dow === 6) return 0;
  if (dow === 5) return 6 * 60 + 15;        // Fr → 6:15
  return 8 * 60 + 15;                       // Mo-Do → 8:15
}

interface NdEntry { date: string; start_time: string; end_time: string; erledigt?: boolean; }

function minsToTime(min: number): string {
  const sign = min < 0 ? "-" : "";
  const abs = Math.abs(min);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

export function MonthlySummary() {
  const { entries, year, month, ndVersion } = useTrackerStore();
  const [ndEntries, setNdEntries] = useState<NdEntry[]>([]);
  const [yearUrlaub, setYearUrlaub] = useState(0); // tüm yılın Urlaub gün sayısı

  // Notdienst bu ay
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

  // Tüm yılın Urlaub günlerini say (Urlaubskonto için)
  useEffect(() => {
    async function loadYearUrlaub() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from("time_entries")
        .select("date")
        .eq("user_id", session.user.id)
        .eq("day_type", "urlaub")
        .gte("date", `${year}-01-01`)
        .lte("date", `${year}-12-31`);
      setYearUrlaub(data?.length ?? 0);
    }
    void loadYearUrlaub();
  }, [year, entries]);

  const stats = useMemo(() => {
    let workedMin    = 0;
    let krankDays    = 0;
    let urlaubDays   = 0;
    let urlaubMin    = 0;
    let krankMin     = 0;

    for (const e of entries) {
      switch (e.day_type) {
        case DAY_TYPES.KRANK:  krankDays++;  break;
        case DAY_TYPES.URLAUB: urlaubDays++; break;
      }

      // Bezahlte Abwesenheit (Urlaub/Krank/Feiertag): IMMER Sollstunden,
      // unabhängig davon ob versehentlich Zeiten gespeichert sind.
      // (Fr Urlaub = 6:15h, Mo-Do Urlaub = 8:15h)
      if (
        e.day_type === DAY_TYPES.KRANK ||
        e.day_type === DAY_TYPES.URLAUB ||
        e.day_type === DAY_TYPES.FEIERTAG
      ) {
        const stdMin = getDayStdMins(e.date);
        workedMin += stdMin;
        if (e.day_type === DAY_TYPES.KRANK)  krankMin  += stdMin;
        if (e.day_type === DAY_TYPES.URLAUB) urlaubMin += stdMin;
        continue;
      }

      if (e.day_type === DAY_TYPES.NOTDIENST) continue;
      if (e.day_type === DAY_TYPES.FREI)      continue;
      if (!e.start_time || !e.end_time)       continue;

      // Sadece ARBEITEN gerçek saatler kullanır
      const { net_minutes } = calculateWorkDuration(e.start_time, e.end_time, e.break_minutes);
      workedMin += net_minutes;
    }

    const notdienstMin = ndEntries.reduce((sum, nd) => {
      if (!nd.start_time || !nd.end_time) return sum;
      return sum + calculateWorkDuration(nd.start_time, nd.end_time, 0).net_minutes;
    }, 0);

    const ndPaid  = ndEntries.filter(nd => nd.erledigt).length;
    const ndOffen = ndEntries.length - ndPaid;
    const ndCount = ndEntries.length;

    const targetMin = TARGET_HOURS_MONTH * 60;
    // Differenz = gerçek çalışılan + notdienst - hedef (notdienst dahil)
    const diffMin = workedMin + notdienstMin - targetMin;

    return {
      workedMin, notdienstMin, ndPaid, ndOffen, ndCount,
      krankDays, urlaubDays, urlaubMin, krankMin,
      diffMin, targetMin,
    };
  }, [entries, ndEntries]);

  const urlaubKonto = Math.max(0, URLAUB_DEFAULT - yearUrlaub);

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
          fontSize: 9, fontWeight: 700, color, textTransform: "uppercase",
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
          mid={`von ${minsToTime(stats.targetMin)} Std`}
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
            <div style={{ fontSize: 9, fontWeight: 700, color: "var(--blue)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              🏖 Urlaub
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 700, color: "var(--blue)", lineHeight: 1.1, marginTop: 2 }}>
              {stats.urlaubDays} T
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--muted)", marginTop: 1 }}>
              {minsToTime(stats.urlaubMin)} Std
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "var(--red)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              🤒 Krank
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 700, color: "var(--red)", lineHeight: 1.1, marginTop: 2 }}>
              {stats.krankDays} T
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--muted)", marginTop: 1 }}>
              {minsToTime(stats.krankMin)} Std
            </div>
          </div>
        </div>

        {/* 4. Notdienst */}
        <Card
          title="Notdienst"
          icon="🚨"
          color="var(--orange)"
          big={`${stats.ndCount}×`}
          mid={`${minsToTime(stats.notdienstMin)} Std`}
          sub={
            stats.ndCount === 0
              ? "—"
              : `✅${stats.ndPaid}  ❌${stats.ndOffen}`
          }
        />

        {/* 5. Urlaubskonto */}
        <Card
          title="Urlaubskonto"
          icon="🌴"
          color="var(--accent2)"
          big={`${urlaubKonto} Tage`}
          mid={`von ${URLAUB_DEFAULT} genommen`}
          sub={`${yearUrlaub} verbraucht ${year}`}
        />
      </div>
    </div>
  );
}
