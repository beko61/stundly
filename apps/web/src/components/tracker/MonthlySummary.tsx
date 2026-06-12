"use client";

import { useMemo, useEffect, useState } from "react";
import { useTrackerStore } from "@/store/trackerStore";
import { DAY_TYPES } from "@workly/shared";
import { calculateWorkDuration } from "@workly/shared";
import { createClient } from "@/lib/supabase/client";

const TARGET_HOURS_DEFAULT = 174;
const URLAUB_DEFAULT       = 30; // yıllık urlaub kontingenti

// VEREINFACHT (07.06.2026): Mo-Fr = 8h, Sa/So = 0.
// Urlaub/Krank/Feiertag werden auf jedem Werktag wie 08:00–17:00 / 1h Pause = 8h gezählt.
function getDayStdMins(dateStr: string): number {
  const dow = new Date(dateStr).getDay();
  if (dow === 0 || dow === 6) return 0;
  return 8 * 60;
}

interface NdEntry { date: string; start_time: string; end_time: string; erledigt?: boolean; }

function minsToTime(min: number): string {
  const sign = min < 0 ? "-" : "";
  const abs = Math.abs(min);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

interface MonthlySummaryProps {
  /** Otomatik tespit edilen Feiertag'lar (Tracker'dan geçer). DB'de entry'si olmayan
   *  Mo-Fr Feiertag'lar (örn. Neujahr) Sollstunden'e dahil edilir ki Differenz doğru olsun. */
  feiertage?: Record<string, string>;
}

export function MonthlySummary({ feiertage }: MonthlySummaryProps = {}) {
  const { entries, year, month, ndVersion } = useTrackerStore();
  const [ndEntries, setNdEntries] = useState<NdEntry[]>([]);
  const [yearUrlaub, setYearUrlaub] = useState(0); // tüm yılın Urlaub gün sayısı
  const [targetHours, setTargetHours] = useState(TARGET_HOURS_DEFAULT);

  // Settings'ten Sollstunden oku (Settings değişince güncellenmesi için ndVersion'a benzer trigger gerekir,
  // ama useEffect [year,month] zaten her ay değişiminde tetikler. Live update için 'storage' event kullan.)
  useEffect(() => {
    async function loadSettings() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from("salary_settings")
        .select("monthly_target_hours")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.monthly_target_hours) setTargetHours(Number(data.monthly_target_hours));
    }
    void loadSettings();
    // Listen for localStorage changes (Salary page writes to it on save)
    const handler = (e: StorageEvent) => {
      if (e.key === "workly_salary_settings_v2" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as { monthly_target_hours?: number };
          if (parsed.monthly_target_hours) setTargetHours(Number(parsed.monthly_target_hours));
        } catch {}
      }
    };
    window.addEventListener("storage", handler);
    // Also check on mount from localStorage (same-tab updates)
    try {
      const raw = localStorage.getItem("workly_salary_settings_v2");
      if (raw) {
        const parsed = JSON.parse(raw) as { monthly_target_hours?: number };
        if (parsed.monthly_target_hours) setTargetHours(Number(parsed.monthly_target_hours));
      }
    } catch {}
    return () => window.removeEventListener("storage", handler);
  }, [year, month]);

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

    // Auto-Feiertag: DB'de entry'si olmayan Feiertag günleri (örn. Neujahr) için de
    // Sollstunden ekle. Eskiden bunlar workedMin'e dahil edilmiyor, Differenz 8h eksik kalıyordu.
    if (feiertage) {
      const entryDates = new Set(entries.map(e => e.date));
      const monthPrefix = `${year}-${String(month).padStart(2, "0")}-`;
      for (const ftDate of Object.keys(feiertage)) {
        if (!ftDate.startsWith(monthPrefix)) continue;       // sadece aktif ay
        if (entryDates.has(ftDate)) continue;                // zaten DB'de var → çift saymadan
        const stdMin = getDayStdMins(ftDate);                // Mo-Fr 8h, Sa/So 0
        workedMin += stdMin;
      }
    }

    const notdienstMin = ndEntries.reduce((sum, nd) => {
      if (!nd.start_time || !nd.end_time) return sum;
      return sum + calculateWorkDuration(nd.start_time, nd.end_time, 0).net_minutes;
    }, 0);

    const ndPaid  = ndEntries.filter(nd => nd.erledigt).length;
    const ndOffen = ndEntries.length - ndPaid;
    const ndCount = ndEntries.length;

    const targetMin = targetHours * 60;
    // Differenz = gerçek çalışılan + notdienst - hedef (notdienst dahil)
    const diffMin = workedMin + notdienstMin - targetMin;

    return {
      workedMin, notdienstMin, ndPaid, ndOffen, ndCount,
      krankDays, urlaubDays, urlaubMin, krankMin,
      diffMin, targetMin,
    };
  }, [entries, ndEntries, targetHours, feiertage, year, month]);

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
