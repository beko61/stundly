"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { calculateWorkDuration } from "@workly/shared";
import { getFeiertage } from "@/lib/utils/feiertage";
import { notdienstBelongsToMonth, notdienstLoadRange } from "@/lib/utils/weekMonth";

const MONTHS       = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const MONTHS_SHORT = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
const TARGET_HOURS_DEFAULT = 174;
const URLAUB_DEFAULT = 30;
const SALARY_LS_KEY = "workly_salary_settings_v2";

// Mo-Fr = 8h, Sa/So = 0. Urlaub/Krank/Feiertag immer 8h auf Werktagen.
function getDayStdMins(dateStr: string): number {
  const dow = new Date(dateStr).getDay();
  if (dow === 0 || dow === 6) return 0;
  return 8 * 60;
}

function minsToTime(min: number): string {
  const sign = min < 0 ? "-" : "";
  const abs = Math.abs(min);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

function eur(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}

interface TimeEntry {
  date: string;
  day_type: string;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  is_night_shift?: boolean;
}

interface NdEntry {
  date: string;
  start_time: string | null;
  end_time: string | null;
  erledigt: boolean | null;
}

interface SalarySettings {
  hourly_rate: number;
  monthly_target_hours: number;
  overtime_rate_multiplier: number;
  night_shift_bonus: number;
  notdienst_bonus: number;
  urlaub_anspruch: number;
}

const DEFAULT_SETTINGS: SalarySettings = {
  hourly_rate: 15,
  monthly_target_hours: 174,
  overtime_rate_multiplier: 1.25,
  night_shift_bonus: 0,
  notdienst_bonus: 0,
  urlaub_anspruch: 30,
};

function readLocalSalarySettings(): Partial<SalarySettings> | null {
  try {
    const raw = localStorage.getItem(SALARY_LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<SalarySettings>;
  } catch {
    return null;
  }
}

function mergeSettings(base: SalarySettings, patch: Partial<SalarySettings> | null | undefined): SalarySettings {
  if (!patch) return base;
  return {
    hourly_rate:              Number(patch.hourly_rate              ?? base.hourly_rate),
    monthly_target_hours:     Number(patch.monthly_target_hours     ?? base.monthly_target_hours),
    overtime_rate_multiplier: Number(patch.overtime_rate_multiplier ?? base.overtime_rate_multiplier),
    night_shift_bonus:        Number(patch.night_shift_bonus        ?? base.night_shift_bonus),
    notdienst_bonus:          Number(patch.notdienst_bonus          ?? base.notdienst_bonus),
    urlaub_anspruch:          Number(patch.urlaub_anspruch          ?? base.urlaub_anspruch),
  };
}

/**
 * Calculate worked minutes + Notdienst minutes from arbitrary entries.
 *
 * `feiertageInRange` (optional): otomatik tespit edilen Feiertag tarihleri.
 * DB'de entry'si olmayan Feiertag günleri (örn. Neujahr) için de Sollstunden
 * (8h Mo-Fr) eklenir — aksi halde Differenz 8h eksik kalır.
 */
function calcMonthMinutes(
  entries: TimeEntry[],
  ndEntries: NdEntry[],
  feiertageInRange?: string[],
) {
  let workedMin = 0;
  let urlaubDays = 0, krankDays = 0, feiertagDays = 0, arbeitstageCount = 0;
  const entryDates = new Set(entries.map(e => e.date));
  for (const e of entries) {
    if (e.day_type === "urlaub")   urlaubDays++;
    if (e.day_type === "krank")    krankDays++;
    if (e.day_type === "feiertag") feiertagDays++;
    if (e.day_type === "arbeiten") arbeitstageCount++;
    if (e.day_type === "urlaub" || e.day_type === "krank" || e.day_type === "feiertag") {
      workedMin += getDayStdMins(e.date);
      continue;
    }
    if (e.day_type === "notdienst" || e.day_type === "frei") continue;
    if (!e.start_time || !e.end_time) continue;
    workedMin += calculateWorkDuration(e.start_time, e.end_time, e.break_minutes).net_minutes;
  }
  // Auto-Feiertag günleri (DB'de yok) için Sollstunden ekle
  if (feiertageInRange) {
    for (const ftDate of feiertageInRange) {
      if (entryDates.has(ftDate)) continue;
      const stdMin = getDayStdMins(ftDate);
      if (stdMin > 0) {
        workedMin += stdMin;
        feiertagDays++;
      }
    }
  }
  const ndMin = ndEntries.reduce((s, n) => {
    if (!n.start_time || !n.end_time) return s;
    return s + calculateWorkDuration(n.start_time, n.end_time, 0).net_minutes;
  }, 0);
  return { workedMin, ndMin, ndCount: ndEntries.length,
    ndPaid: ndEntries.filter(n => n.erledigt).length,
    urlaubDays, krankDays, feiertagDays, arbeitstageCount };
}

function calcBrutto(workedMin: number, ndMin: number, ndCount: number, s: SalarySettings): number {
  const targetHours = s.monthly_target_hours;
  const workedHours = (workedMin + ndMin) / 60;
  const overtimeHours = Math.max(0, workedHours - targetHours);
  const basePay     = targetHours * s.hourly_rate;
  const overtimePay = overtimeHours * s.hourly_rate * (s.overtime_rate_multiplier - 1);
  const ndBonus     = ndCount * s.notdienst_bonus;
  return basePay + overtimePay + ndBonus;
}

export default function DashboardPage() {
  const today      = new Date();
  const todayYear  = today.getFullYear();
  const todayMonth = today.getMonth() + 1;

  // ── Selected month state (ay seçici için) ──
  const [selectedYear,  setSelectedYear]  = useState(todayYear);
  const [selectedMonth, setSelectedMonth] = useState(todayMonth);

  const [name, setName] = useState("");
  const [bundesland, setBundesland] = useState("NI");

  // Selected month data
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [ndEntries, setNdEntries] = useState<NdEntry[]>([]);

  // Year-wide data (for trend chart + yearly card)
  const [yearEntries, setYearEntries] = useState<TimeEntry[]>([]);
  const [yearNd, setYearNd] = useState<NdEntry[]>([]);

  // Last 7 days (always relative to today, regardless of selected month)
  const [last7, setLast7] = useState<TimeEntry[]>([]);

  const [settings, setSettings] = useState<SalarySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // ── Load on selectedMonth change ──
  const loadAll = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setLoading(false); return; }
    const uid = session.user.id;

    const startMonth = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const endMonth   = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    // Notdienst için aktif ay aralığını 7 gün uzat (hafta taşması için)
    const ndRange = notdienstLoadRange(selectedYear, selectedMonth);

    const yearStart  = `${selectedYear}-01-01`;
    const yearEnd    = `${selectedYear}-12-31`;

    const last7Start = new Date(today);
    last7Start.setDate(last7Start.getDate() - 6);
    const last7StartStr = last7Start.toISOString().split("T")[0]!;
    const todayStr      = today.toISOString().split("T")[0]!;

    const [profileRes, settingsRes, monthRes, ndRes, yearRes, yearNdRes, last7Res] = await Promise.all([
      supabase.from("profiles").select("vorname, bundesland").eq("user_id", uid).maybeSingle(),
      supabase.from("salary_settings")
        .select("hourly_rate, monthly_target_hours, overtime_rate_multiplier, night_shift_bonus, notdienst_bonus, urlaub_anspruch")
        .eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("time_entries").select("date, day_type, start_time, end_time, break_minutes, is_night_shift")
        .eq("user_id", uid).gte("date", startMonth).lte("date", endMonth),
      // Notdienst: ayın 1'i → ayın son günü + 7 (sonra hafta filtresine alınır)
      supabase.from("notdienst_entries").select("date, start_time, end_time, erledigt")
        .eq("user_id", uid).gte("date", ndRange.start).lte("date", ndRange.end),
      supabase.from("time_entries").select("date, day_type, start_time, end_time, break_minutes, is_night_shift")
        .eq("user_id", uid).gte("date", yearStart).lte("date", yearEnd),
      // Yıllık Notdienst: tüm yıl + 7 gün (sonraki yılın ilk haftasına taşan günler için)
      supabase.from("notdienst_entries").select("date, start_time, end_time, erledigt")
        .eq("user_id", uid).gte("date", yearStart).lte("date", `${selectedYear + 1}-01-07`),
      supabase.from("time_entries").select("date, day_type, start_time, end_time, break_minutes, is_night_shift")
        .eq("user_id", uid).gte("date", last7StartStr).lte("date", todayStr),
    ]);

    setName(profileRes.data?.vorname ?? session.user.email?.split("@")[0] ?? "");
    if (profileRes.data?.bundesland) setBundesland(profileRes.data.bundesland as string);
    if (settingsRes.data) {
      const fromSupabase: SalarySettings = {
        hourly_rate:              Number(settingsRes.data.hourly_rate)              || DEFAULT_SETTINGS.hourly_rate,
        monthly_target_hours:     Number(settingsRes.data.monthly_target_hours)     || DEFAULT_SETTINGS.monthly_target_hours,
        overtime_rate_multiplier: Number(settingsRes.data.overtime_rate_multiplier) || DEFAULT_SETTINGS.overtime_rate_multiplier,
        night_shift_bonus:        Number(settingsRes.data.night_shift_bonus)        || 0,
        notdienst_bonus:          Number(settingsRes.data.notdienst_bonus)          || 0,
        urlaub_anspruch:          Number(settingsRes.data.urlaub_anspruch)          || DEFAULT_SETTINGS.urlaub_anspruch,
      };
      setSettings(mergeSettings(fromSupabase, readLocalSalarySettings()));
    }
    setEntries((monthRes.data  ?? []) as TimeEntry[]);
    // Notdienst: sadece haftası bu aya düşenleri tut
    setNdEntries(((ndRes.data ?? []) as NdEntry[]).filter(nd =>
      notdienstBelongsToMonth(nd.date, selectedYear, selectedMonth)
    ));
    setYearEntries((yearRes.data ?? []) as TimeEntry[]);
    setYearNd((yearNdRes.data  ?? []) as NdEntry[]);
    setLast7((last7Res.data    ?? []) as TimeEntry[]);
    setLoading(false);
    // intentionally exclude `today` (re-renders only on real day-change which is fine)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  // Live-sync salary settings from Salary page (localStorage + 'storage' + visibility)
  useEffect(() => {
    function applyLocal() {
      const patch = readLocalSalarySettings();
      if (patch) setSettings(prev => mergeSettings(prev, patch));
    }
    function onStorage(e: StorageEvent) {
      if (e.key === SALARY_LS_KEY && e.newValue) applyLocal();
    }
    function onVisible() {
      if (document.visibilityState === "visible") applyLocal();
    }
    applyLocal();
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // ── Feiertage (Yıllık — selected year için bir kez hesapla) ──
  const yearFeiertage = useMemo(
    () => getFeiertage(selectedYear, bundesland),
    [selectedYear, bundesland],
  );

  // ── Monthly stats (selected month) ──
  const stats = useMemo(() => {
    const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-`;
    const monthFeiertage = Object.keys(yearFeiertage).filter(d => d.startsWith(monthPrefix));
    const m = calcMonthMinutes(entries, ndEntries, monthFeiertage);
    const targetMin = settings.monthly_target_hours * 60;
    const diffMin = m.workedMin + m.ndMin - targetMin;
    const brutto = calcBrutto(m.workedMin, m.ndMin, m.ndCount, settings);
    return { ...m, diffMin, targetMin, brutto };
  }, [entries, ndEntries, settings, yearFeiertage, selectedYear, selectedMonth]);

  // ── Last 7 days bars (always relative to today) ──
  const days7 = useMemo(() => {
    const map = new Map(last7.map(e => [e.date, e]));
    const arr: { dateStr: string; label: string; minutes: number; isWeekend: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0]!;
      const dow = d.getDay();
      const e = map.get(dateStr);
      let mins = 0;
      if (e) {
        if (e.day_type === "urlaub" || e.day_type === "krank" || e.day_type === "feiertag") {
          mins = getDayStdMins(dateStr);
        } else if (e.start_time && e.end_time) {
          mins = calculateWorkDuration(e.start_time, e.end_time, e.break_minutes).net_minutes;
        }
      }
      arr.push({
        dateStr,
        label: ["So","Mo","Di","Mi","Do","Fr","Sa"][dow]!,
        minutes: mins,
        isWeekend: dow === 0 || dow === 6,
      });
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last7]);

  const maxMin = Math.max(...days7.map(d => d.minutes), 60);

  // ── 12-month trend (selected year) ──
  const monthlyBreakdown = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthPrefix = `${selectedYear}-${String(m).padStart(2, "0")}-`;
      const monthEntries = yearEntries.filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === selectedYear && (d.getMonth() + 1) === m;
      });
      // Notdienst: haftasının Pazartesi'si bu aya düşenler (taşan günler dahil)
      const monthNd = yearNd.filter(n => notdienstBelongsToMonth(n.date, selectedYear, m));
      const monthFeiertage = Object.keys(yearFeiertage).filter(d => d.startsWith(monthPrefix));
      const stats = calcMonthMinutes(monthEntries, monthNd, monthFeiertage);
      const brutto = calcBrutto(stats.workedMin, stats.ndMin, stats.ndCount, settings);
      return { month: m, label: MONTHS_SHORT[i]!, ...stats, brutto };
    });
  }, [yearEntries, yearNd, selectedYear, settings, yearFeiertage]);

  const yearlyMaxBrutto = Math.max(...monthlyBreakdown.map(m => m.brutto), 1);

  // ── Yearly totals ──
  const yearly = useMemo(() => {
    let workedMin = 0, ndMin = 0, ndCount = 0, urlaub = 0, krank = 0, arbeitstage = 0;
    let bruttoTotal = 0;
    for (const m of monthlyBreakdown) {
      workedMin   += m.workedMin;
      ndMin       += m.ndMin;
      ndCount     += m.ndCount;
      urlaub      += m.urlaubDays;
      krank       += m.krankDays;
      arbeitstage += m.arbeitstageCount;
      bruttoTotal += m.brutto;
    }
    return { workedMin, ndMin, ndCount, urlaub, krank, arbeitstage, bruttoTotal };
  }, [monthlyBreakdown]);

  // ── Next holiday ──
  const nextHoliday = useMemo(() => {
    const feiertage = getFeiertage(todayYear, bundesland);
    const todayStr = today.toISOString().split("T")[0]!;
    const upcoming = Object.entries(feiertage)
      .filter(([date]) => date >= todayStr)
      .sort(([a], [b]) => a.localeCompare(b))[0];
    if (!upcoming) return null;
    const d = new Date(upcoming[0]!);
    const daysAway = Math.ceil((d.getTime() - today.getTime()) / 86400000);
    return { name: upcoming[1]!, date: d, daysAway };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayYear, bundesland]);

  const urlaubAnspruch = settings.urlaub_anspruch || URLAUB_DEFAULT;
  const urlaubKonto    = Math.max(0, urlaubAnspruch - yearly.urlaub);
  const greeting = today.getHours() < 11 ? "Guten Morgen" : today.getHours() < 18 ? "Hallo" : "Guten Abend";
  const diffColor = stats.diffMin >= 0 ? "var(--green)" : "var(--red)";

  // Month navigation
  function shiftMonth(delta: number) {
    let y = selectedYear, m = selectedMonth + delta;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    setSelectedYear(y);
    setSelectedMonth(m);
  }
  const isCurrentMonth = selectedYear === todayYear && selectedMonth === todayMonth;

  if (loading) return <div style={{ textAlign: "center", padding: 80, color: "var(--muted)" }}>Laden…</div>;

  return (
    <div className="dash-wrapper">
      {/* Greeting */}
      <div className="dash-greet">
        <h1>{greeting}{name ? `, ${name}` : ""} 👋</h1>
        <p>Hier ist deine Übersicht.</p>
      </div>

      {/* Month picker */}
      <div className="dash-month-picker">
        <button onClick={() => shiftMonth(-1)} className="dash-month-arrow" aria-label="Vorheriger Monat">‹</button>
        <div className="dash-month-current">
          <span className="dash-month-label">{MONTHS[selectedMonth - 1]} {selectedYear}</span>
          {!isCurrentMonth && (
            <button
              onClick={() => { setSelectedYear(todayYear); setSelectedMonth(todayMonth); }}
              className="dash-month-today"
            >
              Heute
            </button>
          )}
        </div>
        <button onClick={() => shiftMonth(1)} className="dash-month-arrow" aria-label="Nächster Monat">›</button>
      </div>

      {/* Hero row: Differenz + Brutto (selected month) */}
      <div className="dash-hero">
        <div className="dash-hero-card">
          <span className="label" style={{ color: diffColor }}>📊 Stundensaldo (inkl. Notdienst)</span>
          <span className="value" style={{ color: diffColor }}>
            {stats.diffMin >= 0 ? "+" : ""}{minsToTime(stats.diffMin)}
          </span>
          <span className="sub">
            {minsToTime(stats.workedMin + stats.ndMin)} von {minsToTime(stats.targetMin)} geleistet
          </span>
        </div>
        <div className="dash-hero-card">
          <span className="label" style={{ color: "var(--accent2)" }}>💰 Brutto-Lohn (geschätzt)</span>
          <span className="value" style={{ color: "var(--accent2)" }}>{eur(stats.brutto)}</span>
          <span className="sub">{settings.hourly_rate} €/Std · {settings.monthly_target_hours}h Soll</span>
        </div>
      </div>

      {/* KPI grid (selected month) */}
      <div className="dash-kpi-grid">
        <div className="dash-kpi">
          <span className="kpi-icon">⏱</span>
          <span className="kpi-label">Geleistet</span>
          <span className="kpi-value" style={{ color: "var(--blue)" }}>{minsToTime(stats.workedMin)}</span>
          <span className="kpi-sub">ohne Notdienst</span>
        </div>
        <div className="dash-kpi">
          <span className="kpi-icon">🚨</span>
          <span className="kpi-label">Notdienst</span>
          <span className="kpi-value" style={{ color: "var(--orange)" }}>{stats.ndCount}×</span>
          <span className="kpi-sub">✅ {stats.ndPaid} · ⏳ {stats.ndCount - stats.ndPaid}</span>
        </div>
        <div className="dash-kpi">
          <span className="kpi-icon">🏖</span>
          <span className="kpi-label">Urlaub übrig</span>
          <span className="kpi-value" style={{ color: "var(--blue)" }}>{urlaubKonto}</span>
          <span className="kpi-sub">von {urlaubAnspruch} Tagen</span>
        </div>
        <div className="dash-kpi">
          <span className="kpi-icon">🎉</span>
          <span className="kpi-label">Nächster Feiertag</span>
          <span className="kpi-value" style={{ color: "var(--yellow)", fontSize: 16, lineHeight: 1.2 }}>
            {nextHoliday ? nextHoliday.name : "—"}
          </span>
          <span className="kpi-sub">
            {nextHoliday ? `in ${nextHoliday.daysAway} Tag${nextHoliday.daysAway === 1 ? "" : "en"}` : "—"}
          </span>
        </div>
      </div>

      {/* Yearly summary card */}
      <div className="dash-panel">
        <div className="dash-panel-title">
          🗓 Jahresübersicht {selectedYear}
        </div>
        <div className="dash-year-grid">
          <div className="dash-year-stat">
            <span className="kpi-label">Geleistet (gesamt)</span>
            <span className="kpi-value" style={{ color: "var(--green)" }}>
              {minsToTime(yearly.workedMin + yearly.ndMin)}
            </span>
            <span className="kpi-sub">{yearly.arbeitstage} Arbeitstage</span>
          </div>
          <div className="dash-year-stat">
            <span className="kpi-label">Brutto-Lohn Jahr</span>
            <span className="kpi-value" style={{ color: "var(--accent2)" }}>{eur(yearly.bruttoTotal)}</span>
            <span className="kpi-sub">Ø {eur(yearly.bruttoTotal / 12)} / Monat</span>
          </div>
          <div className="dash-year-stat">
            <span className="kpi-label">Urlaub genommen</span>
            <span className="kpi-value" style={{ color: "var(--blue)" }}>
              {yearly.urlaub} / {urlaubAnspruch}
            </span>
            <span className="kpi-sub">{urlaubKonto} Tage frei</span>
          </div>
          <div className="dash-year-stat">
            <span className="kpi-label">Notdienst Jahr</span>
            <span className="kpi-value" style={{ color: "var(--orange)" }}>{yearly.ndCount}×</span>
            <span className="kpi-sub">{minsToTime(yearly.ndMin)} Std</span>
          </div>
        </div>
      </div>

      {/* 12-month trend chart */}
      <div className="dash-panel">
        <div className="dash-panel-title">📈 Monatliche Brutto-Entwicklung {selectedYear}</div>
        <div className="dash-bars dash-bars-12">
          {monthlyBreakdown.map((m) => {
            const isSelected = m.month === selectedMonth;
            return (
              <button
                key={m.month}
                type="button"
                onClick={() => setSelectedMonth(m.month)}
                className={`dash-bar-btn ${isSelected ? "selected" : ""}`}
                title={`${MONTHS[m.month - 1]}: ${minsToTime(m.workedMin + m.ndMin)} · ${eur(m.brutto)}`}
              >
                <div
                  className="dash-bar"
                  style={{ height: `${Math.max(4, (m.brutto / yearlyMaxBrutto) * 100)}%` }}
                />
              </button>
            );
          })}
        </div>
        <div className="dash-bar-labels">
          {monthlyBreakdown.map(m => (
            <div
              key={m.month}
              className="dash-bar-label"
              style={m.month === selectedMonth ? { color: "var(--accent2)" } : undefined}
            >
              {m.label}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, fontSize: 11, color: "var(--muted)", display: "flex", justifyContent: "space-between" }}>
          <span>Klick auf einen Monat zum Wechseln</span>
          <span>Gesamt {eur(yearly.bruttoTotal)}</span>
        </div>
      </div>

      {/* Body: 7-day chart + quick actions */}
      <div className="dash-body">
        <div className="dash-panel">
          <div className="dash-panel-title">📅 Letzte 7 Tage</div>
          <div className="dash-bars">
            {days7.map((d) => (
              <div
                key={d.dateStr}
                className={`dash-bar ${d.isWeekend ? "weekend" : ""}`}
                style={{ height: `${Math.max(4, (d.minutes / maxMin) * 100)}%` }}
                title={`${d.label} · ${minsToTime(d.minutes)}`}
              />
            ))}
          </div>
          <div className="dash-bar-labels">
            {days7.map(d => (
              <div key={d.dateStr} className="dash-bar-label">{d.label}</div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 11, color: "var(--muted)", display: "flex", justifyContent: "space-between" }}>
            <span>Ø {minsToTime(Math.round(days7.reduce((s, d) => s + d.minutes, 0) / 7))} / Tag</span>
            <span>Gesamt {minsToTime(days7.reduce((s, d) => s + d.minutes, 0))}</span>
          </div>
        </div>

        <div className="dash-panel">
          <div className="dash-panel-title">⚡ Schnellzugriff</div>
          <div className="dash-actions">
            <Link href="/tracker" className="dash-action">
              <span className="dash-action-icon">⏱</span>
              <span>Heute erfassen</span>
              <span className="dash-action-arrow">→</span>
            </Link>
            <Link href="/salary" className="dash-action">
              <span className="dash-action-icon">💰</span>
              <span>Lohn & Steuer</span>
              <span className="dash-action-arrow">→</span>
            </Link>
            <Link href="/vacation" className="dash-action">
              <span className="dash-action-icon">🏖</span>
              <span>Urlaub beantragen</span>
              <span className="dash-action-arrow">→</span>
            </Link>
            <Link href="/calendar" className="dash-action">
              <span className="dash-action-icon">📅</span>
              <span>Kalender ansehen</span>
              <span className="dash-action-arrow">→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
