"use client";

import { useMemo, useEffect, useState } from "react";
import { useTrackerStore } from "@/store/trackerStore";
import { createClient } from "@/lib/supabase/client";
import { notdienstBelongsToMonth, notdienstLoadRange } from "@/lib/utils/weekMonth";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { calcMonthStats, type NdEntry as NdEntryHelper } from "@/lib/utils/monthStats";

const TARGET_HOURS_DEFAULT = 174;
const URLAUB_DEFAULT       = 30; // Fallback: salary_settings.urlaub_anspruch okunamazsa

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
  const [urlaubAnspruch, setUrlaubAnspruch] = useState(URLAUB_DEFAULT);

  // Settings'ten Sollstunden + Urlaubsanspruch oku (live sync via localStorage)
  useEffect(() => {
    async function loadSettings() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from("salary_settings")
        .select("monthly_target_hours, urlaub_anspruch")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.monthly_target_hours) setTargetHours(Number(data.monthly_target_hours));
      if (data?.urlaub_anspruch)      setUrlaubAnspruch(Number(data.urlaub_anspruch));
    }
    void loadSettings();
    const applyLocal = (raw: string | null) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as { monthly_target_hours?: number; urlaub_anspruch?: number };
        if (parsed.monthly_target_hours) setTargetHours(Number(parsed.monthly_target_hours));
        if (parsed.urlaub_anspruch)      setUrlaubAnspruch(Number(parsed.urlaub_anspruch));
      } catch {}
    };
    const handler = (e: StorageEvent) => {
      if (e.key === "workly_salary_settings_v2") applyLocal(e.newValue);
    };
    window.addEventListener("storage", handler);
    try { applyLocal(localStorage.getItem("workly_salary_settings_v2")); } catch {}
    return () => window.removeEventListener("storage", handler);
  }, [year, month]);

  // Notdienst bu ay — hafta-Pazartesi'si bu aya düşen tüm Notdienst'ler
  // (bu ayın 1'inden sonraki ayın 7'sine kadar yükle, sonra haftaya göre filtrele)
  useEffect(() => {
    async function loadNd() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { start, end } = notdienstLoadRange(year, month);
      const { data } = await supabase
        .from("notdienst_entries")
        .select("date, start_time, end_time, erledigt")
        .eq("user_id", session.user.id)
        .gte("date", start)
        .lte("date", end);
      if (!data) return;
      // Hafta'nın Pazartesi'si bu aya düşenleri tut, diğerlerini ele
      const filtered = (data as NdEntry[]).filter(nd =>
        notdienstBelongsToMonth(nd.date, year, month)
      );
      setNdEntries(filtered);
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
    const r = calcMonthStats({
      entries,
      ndEntries: ndEntries as NdEntryHelper[],
      feiertage: feiertage ?? {},
      year, month,
      targetHoursPerMonth: targetHours,
    });
    return {
      workedMin:    r.workedMin,
      notdienstMin: r.ndMin,
      ndPaid:       r.ndPaid,
      ndOffen:      r.ndCount - r.ndPaid,
      ndCount:      r.ndCount,
      krankDays:    r.krankDays,
      urlaubDays:   r.urlaubDays,
      urlaubMin:    r.urlaubMin,
      krankMin:     r.krankMin,
      diffMin:      r.diffMin,
      targetMin:    r.targetMin,
      dailyCapViolations: r.dailyCapViolations,
    };
  }, [entries, ndEntries, targetHours, feiertage, year, month]);

  const urlaubKonto = Math.max(0, urlaubAnspruch - yearUrlaub);

  // ── Kart bileşeni ──
  function Card({ title, icon, color, big, mid, sub, info }: {
    title: string; icon?: string; color: string; big: string; mid?: string; sub?: string;
    info?: { title?: string; body: React.ReactNode };
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
          {info && (
            info.title
              ? <InfoTooltip title={info.title} color={color}>{info.body}</InfoTooltip>
              : <InfoTooltip color={color}>{info.body}</InfoTooltip>
          )}
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
          info={{
            title: "Notdienst — so wird gezählt",
            body: (
              <>
                <strong>Wann?</strong> Außerhalb der regulären Arbeitszeit
                (Abend / Nacht / Wochenende), eingetragen mit „+ Notdienst hinzufügen“
                am jeweiligen Tag.
                {"\n\n"}
                <strong>Monatszuordnung:</strong> Eine Notdienst-Woche zählt
                immer zu dem Monat, in dem ihr Montag liegt. Beispiel: KW vom
                28. Apr (Mo) bis 4. Mai (So) → komplett April.
                {"\n\n"}
                <strong>Bezahlt-Status:</strong> ✅ erledigt / ⏳ offen — Tippe
                im Tag auf das Symbol, um umzuschalten. Notdienst wird oft erst
                im Folgemonat ausgezahlt.
                {"\n\n"}
                <strong>Lohn:</strong> Notdienst-Stunden fließen in die
                Differenz und werden mit deinem Notdienst-Bonus (€/Tag)
                aus den Lohn-Einstellungen vergütet.
              </>
            ),
          }}
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
          mid={`von ${urlaubAnspruch} verfügbar`}
          sub={`${yearUrlaub} verbraucht ${year}`}
        />
      </div>
    </div>
  );
}
