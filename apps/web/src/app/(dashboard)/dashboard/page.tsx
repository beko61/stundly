"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { calculateWorkDuration } from "@workly/shared";
import { getFeiertage } from "@/lib/utils/feiertage";

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const TARGET_HOURS_DEFAULT = 174;
const URLAUB_DEFAULT = 30;
const SALARY_LS_KEY = "workly_salary_settings_v2"; // same key Salary page writes

function getDayStdMins(dateStr: string): number {
  const dow = new Date(dateStr).getDay();
  if (dow === 0 || dow === 6) return 0;
  if (dow === 5) return 6 * 60 + 15;
  return 8 * 60 + 15;
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
}

const DEFAULT_SETTINGS: SalarySettings = {
  hourly_rate: 15,
  monthly_target_hours: 174,
  overtime_rate_multiplier: 1.25,
  night_shift_bonus: 0,
  notdienst_bonus: 0,
};

/** Salary page writes the same shape to localStorage on every change. We trust it as the freshest source. */
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
  };
}

export default function DashboardPage() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const [name, setName] = useState("");
  const [bundesland, setBundesland] = useState("NI");
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [last7, setLast7] = useState<TimeEntry[]>([]);
  const [ndEntries, setNdEntries] = useState<NdEntry[]>([]);
  const [yearUrlaub, setYearUrlaub] = useState(0);
  const [settings, setSettings] = useState<SalarySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadAll();
  }, []);

  // Live-sync salary settings: Salary page writes to localStorage and
  // emits a 'storage' event (other tabs) or we re-read on visibilitychange.
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
    applyLocal(); // immediate read on mount (covers same-tab navigation)
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  async function loadAll() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setLoading(false); return; }
    const uid = session.user.id;

    const startMonth = `${year}-${String(month).padStart(2, "0")}-01`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const endMonth = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    const last7Start = new Date(today);
    last7Start.setDate(last7Start.getDate() - 6);
    const last7StartStr = last7Start.toISOString().split("T")[0]!;
    const todayStr = today.toISOString().split("T")[0]!;

    const [profileRes, settingsRes, monthRes, last7Res, ndRes, yearUrlaubRes] = await Promise.all([
      supabase.from("profiles").select("vorname, bundesland").eq("user_id", uid).maybeSingle(),
      supabase.from("salary_settings")
        .select("hourly_rate, monthly_target_hours, overtime_rate_multiplier, night_shift_bonus, notdienst_bonus")
        .eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("time_entries").select("date, day_type, start_time, end_time, break_minutes, is_night_shift")
        .eq("user_id", uid).gte("date", startMonth).lte("date", endMonth),
      supabase.from("time_entries").select("date, day_type, start_time, end_time, break_minutes, is_night_shift")
        .eq("user_id", uid).gte("date", last7StartStr).lte("date", todayStr),
      supabase.from("notdienst_entries").select("date, start_time, end_time, erledigt")
        .eq("user_id", uid).gte("date", startMonth).lte("date", endMonth),
      supabase.from("time_entries").select("date").eq("user_id", uid).eq("day_type", "urlaub")
        .gte("date", `${year}-01-01`).lte("date", `${year}-12-31`),
    ]);

    setName(profileRes.data?.vorname ?? session.user.email?.split("@")[0] ?? "");
    if (profileRes.data?.bundesland) setBundesland(profileRes.data.bundesland as string);
    if (settingsRes.data) {
      const fromSupabase: SalarySettings = {
        hourly_rate: Number(settingsRes.data.hourly_rate) || DEFAULT_SETTINGS.hourly_rate,
        monthly_target_hours: Number(settingsRes.data.monthly_target_hours) || DEFAULT_SETTINGS.monthly_target_hours,
        overtime_rate_multiplier: Number(settingsRes.data.overtime_rate_multiplier) || DEFAULT_SETTINGS.overtime_rate_multiplier,
        night_shift_bonus: Number(settingsRes.data.night_shift_bonus) || 0,
        notdienst_bonus: Number(settingsRes.data.notdienst_bonus) || 0,
      };
      // Local cache (written by Salary page on every keystroke, debounce 600ms)
      // beats Supabase if newer — covers the case where the user just edited
      // a value and immediately navigated to Dashboard.
      setSettings(mergeSettings(fromSupabase, readLocalSalarySettings()));
    }
    setEntries((monthRes.data ?? []) as TimeEntry[]);
    setLast7((last7Res.data ?? []) as TimeEntry[]);
    setNdEntries((ndRes.data ?? []) as NdEntry[]);
    setYearUrlaub(yearUrlaubRes.data?.length ?? 0);
    setLoading(false);
  }

  // ── Berechnungen ──
  const stats = useMemo(() => {
    let workedMin = 0;
    let urlaubDays = 0;
    let krankDays = 0;

    for (const e of entries) {
      if (e.day_type === "urlaub") urlaubDays++;
      if (e.day_type === "krank") krankDays++;
      if (e.day_type === "urlaub" || e.day_type === "krank" || e.day_type === "feiertag") {
        workedMin += getDayStdMins(e.date);
        continue;
      }
      if (e.day_type === "notdienst" || e.day_type === "frei") continue;
      if (!e.start_time || !e.end_time) continue;
      const { net_minutes } = calculateWorkDuration(e.start_time, e.end_time, e.break_minutes);
      workedMin += net_minutes;
    }

    const ndMin = ndEntries.reduce((s, n) => {
      if (!n.start_time || !n.end_time) return s;
      return s + calculateWorkDuration(n.start_time, n.end_time, 0).net_minutes;
    }, 0);
    const ndCount = ndEntries.length;
    const ndPaid = ndEntries.filter(n => n.erledigt).length;

    const targetMin = settings.monthly_target_hours * 60;
    const diffMin = workedMin + ndMin - targetMin;

    const targetHours = settings.monthly_target_hours;
    const workedHours = (workedMin + ndMin) / 60;
    const overtimeHours = Math.max(0, workedHours - targetHours);
    const basePay = targetHours * settings.hourly_rate;
    const overtimePay = overtimeHours * settings.hourly_rate * (settings.overtime_rate_multiplier - 1);
    const ndBonus = ndCount * settings.notdienst_bonus;
    const brutto = basePay + overtimePay + ndBonus;

    return { workedMin, ndMin, ndCount, ndPaid, urlaubDays, krankDays, diffMin, targetMin, brutto };
  }, [entries, ndEntries, settings]);

  // ── Last 7 days bars ──
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
  }, [last7]);

  const maxMin = Math.max(...days7.map(d => d.minutes), 60);

  // ── Yaklaşan Feiertag ──
  const nextHoliday = useMemo(() => {
    const feiertage = getFeiertage(year, bundesland);
    const todayStr = today.toISOString().split("T")[0]!;
    const upcoming = Object.entries(feiertage)
      .filter(([date]) => date >= todayStr)
      .sort(([a], [b]) => a.localeCompare(b))[0];
    if (!upcoming) return null;
    const d = new Date(upcoming[0]!);
    const daysAway = Math.ceil((d.getTime() - today.getTime()) / 86400000);
    return { name: upcoming[1]!, date: d, daysAway };
  }, [year, bundesland]);

  const urlaubKonto = Math.max(0, URLAUB_DEFAULT - yearUrlaub);
  const greeting = today.getHours() < 11 ? "Guten Morgen" : today.getHours() < 18 ? "Hallo" : "Guten Abend";
  const diffColor = stats.diffMin >= 0 ? "var(--green)" : "var(--red)";

  if (loading) return <div style={{ textAlign: "center", padding: 80, color: "var(--muted)" }}>Laden…</div>;

  return (
    <div className="dash-wrapper">
      {/* Greeting */}
      <div className="dash-greet">
        <h1>{greeting}{name ? `, ${name}` : ""} 👋</h1>
        <p>Hier ist deine Übersicht für {MONTHS[month - 1]} {year}.</p>
      </div>

      {/* Hero row: Differenz + Brutto */}
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

      {/* KPI grid */}
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
          <span className="kpi-sub">von {URLAUB_DEFAULT} Tagen</span>
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

      {/* Body: chart + quick actions */}
      <div className="dash-body">
        <div className="dash-panel">
          <div className="dash-panel-title">📈 Letzte 7 Tage</div>
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
