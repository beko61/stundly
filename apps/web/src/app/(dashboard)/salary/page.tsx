"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  calculateMonthlySalary,
  formatDuration,
  calcNettoFromBrutto,
  calcKrankheitEpisodes,
  ENTGFG_KRANKHEIT_LIMIT_DAYS,
  calcAnnualEntitlement,
  calcUrlaubskonto,
} from "@workly/shared";
import type { TimeEntry, SalarySettings, Steuerklasse, KirchensteuerRate, TaxMode, KrankheitEpisode } from "@workly/shared";
import { YearPicker } from "@/components/ui/YearPicker";
import { MINDESTLOHN_CURRENT, formatMindestlohn } from "@/lib/mindestlohn";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTrackerStore } from "@/store/trackerStore";
import { usePrivacyMode, maskMoney } from "@/lib/privacy";
import { getFeiertage } from "@/lib/utils/feiertage";

const STEUERKLASSEN: { value: Steuerklasse; label: string; hint: string }[] = [
  { value: "I",   label: "I",   hint: "Ledig" },
  { value: "II",  label: "II",  hint: "Alleinerz." },
  { value: "III", label: "III", hint: "Verh. (höher)" },
  { value: "IV",  label: "IV",  hint: "Verh. (gleich)" },
  { value: "V",   label: "V",   hint: "Verh. (niedr.)" },
  { value: "VI",  label: "VI",  hint: "2. Job" },
];

const KIRCHENSTEUER_OPTIONS: { value: KirchensteuerRate; label: string }[] = [
  { value: 0,    label: "Keine" },
  { value: 0.08, label: "8% (BW, BY)" },
  { value: 0.09, label: "9% (übrige)" },
];

const MONTHS     = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const MONTHS_S   = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
const LS_KEY     = "workly_salary_settings_v2";

interface MonthRecord {
  id:        string;
  user_id:   string;
  year:      number;
  month:     number;
  brutto:    number;
  netto:     number;
  note:      string | null;
}

const DEFAULT_SETTINGS: SalarySettings = {
  id: "local", user_id: "local", valid_from: "",
  hourly_rate:              15,
  overtime_rate_multiplier: 1.25,
  night_shift_bonus:        3,
  notdienst_bonus:          50,
  monthly_target_hours:     174,
  steuerklasse:             "I",
  kirchensteuer:            0,
  hat_kinder:               false,
  tax_mode:                 "auto",
  manuell_abzug:            0,
  urlaub_anspruch:          30,
  sfn_enabled:              false,
  employment_start_date:    null,
  employment_end_date:      null,
  urlaub_carry_over:        0,
};

function loadLocalSettings(): SalarySettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) as Partial<SalarySettings> };
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

export default function SalaryPage() {
  const now = new Date();
  const [year,     setYear]     = useState(now.getFullYear());
  const [month,    setMonth]    = useState(now.getMonth() + 1);
  const router = useRouter();
  const setTrackerMonth = useTrackerStore(s => s.setMonth);
  const [entries,  setEntries]  = useState<TimeEntry[]>([]);
  const [records,  setRecords]  = useState<MonthRecord[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [settings, setSettings] = useState<SalarySettings>(DEFAULT_SETTINGS);
  const [settingsSaved,  setSettingsSaved]  = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  // Supabase row id for current settings record (for updates)
  const settingsRowId = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal state
  const [recordModal, setRecordModal] = useState(false);
  const [mBrutto, setMBrutto] = useState("");
  const [mNetto,  setMNetto]  = useState("");
  const [mNote,   setMNote]   = useState("");
  const [mSaving, setMSaving] = useState(false);

  // Load settings: Supabase first, fallback to localStorage
  useEffect(() => {
    async function loadSettings() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setSettings(loadLocalSettings());
        setSettingsLoaded(true);
        return;
      }
      const { data } = await supabase
        .from("salary_settings")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        settingsRowId.current = data.id as string;
        const loaded: SalarySettings = {
          id:                       data.id as string,
          user_id:                  data.user_id as string,
          valid_from:               data.valid_from as string,
          hourly_rate:              Number(data.hourly_rate),
          overtime_rate_multiplier: Number(data.overtime_rate_multiplier),
          night_shift_bonus:        Number(data.night_shift_bonus),
          notdienst_bonus:          Number(data.notdienst_bonus),
          monthly_target_hours:     Number(data.monthly_target_hours),
          steuerklasse:             (data.steuerklasse as Steuerklasse | null) ?? "I",
          kirchensteuer:            (Number(data.kirchensteuer ?? 0) as KirchensteuerRate),
          hat_kinder:               Boolean(data.hat_kinder ?? false),
          tax_mode:                 (data.tax_mode as TaxMode | null) ?? "auto",
          manuell_abzug:            Number(data.manuell_abzug ?? 0),
          urlaub_anspruch:          Number(data.urlaub_anspruch ?? 30),
          sfn_enabled:              Boolean(data.sfn_enabled ?? false),
          employment_start_date:    (data.employment_start_date as string | null) ?? null,
          employment_end_date:      (data.employment_end_date   as string | null) ?? null,
          urlaub_carry_over:        Number(data.urlaub_carry_over ?? 0),
        };
        setSettings(loaded);
        localStorage.setItem(LS_KEY, JSON.stringify(loaded));
      } else {
        setSettings(loadLocalSettings());
      }
      setSettingsLoaded(true);
    }
    void loadSettings();
  }, []);

  // Auto-save settings: localStorage + Supabase (debounced)
  useEffect(() => {
    if (!settingsLoaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      localStorage.setItem(LS_KEY, JSON.stringify(settings));

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const payload = {
          hourly_rate:              settings.hourly_rate,
          overtime_rate_multiplier: settings.overtime_rate_multiplier,
          night_shift_bonus:        settings.night_shift_bonus,
          notdienst_bonus:          settings.notdienst_bonus,
          monthly_target_hours:     settings.monthly_target_hours,
          steuerklasse:             settings.steuerklasse ?? "I",
          kirchensteuer:            settings.kirchensteuer ?? 0,
          hat_kinder:               settings.hat_kinder ?? false,
          tax_mode:                 settings.tax_mode ?? "auto",
          manuell_abzug:            settings.manuell_abzug ?? 0,
          urlaub_anspruch:          settings.urlaub_anspruch ?? 30,
          sfn_enabled:              settings.sfn_enabled ?? false,
          employment_start_date:    settings.employment_start_date ?? null,
          employment_end_date:      settings.employment_end_date ?? null,
          urlaub_carry_over:        settings.urlaub_carry_over ?? 0,
        };
        if (settingsRowId.current) {
          await supabase.from("salary_settings").update(payload).eq("id", settingsRowId.current);
        } else {
          const { data: inserted } = await supabase
            .from("salary_settings")
            .insert({ ...payload, user_id: session.user.id, valid_from: new Date().toISOString().split("T")[0] })
            .select("id")
            .single();
          if (inserted) settingsRowId.current = inserted.id as string;
        }
      }

      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 1500);
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [settings, settingsLoaded]);

  // ALL entries for the year (for monthly auto-netto chart)
  const [yearEntries, setYearEntries] = useState<TimeEntry[]>([]);
  const [bundesland,  setBundesland]  = useState("NI");

  // Bundesland aus Profil (Feiertage-Lookup für SFN §3b)
  useEffect(() => {
    async function loadBundesland() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from("profiles").select("bundesland")
        .eq("id", session.user.id).maybeSingle();
      if (data?.bundesland) setBundesland(data.bundesland as string);
    }
    void loadBundesland();
  }, []);

  const feiertage = useMemo(() => getFeiertage(year, bundesland), [year, bundesland]);

  // Yıl boyunca tüm Notdienst entry'lerinin tarihleri (sadece date kolonu)
  // — Notdienst bir önceki ayın işidir, bu ayın brutto'suna gider
  const [yearNotdienstDates, setYearNotdienstDates] = useState<string[]>([]);

  // Load time entries + monthly records + notdienst dates
  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }

      const yearStart = `${year}-01-01`;
      const yearEnd   = `${year}-12-31`;
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate   = new Date(year, month, 0).toISOString().split("T")[0]!;

      // Notdienst-Range: yıllık + önceki Aralık (Ocak salary için) + sonraki Ocak (Aralık için pek değil ama tutarlı)
      const ndStart = `${year - 1}-12-01`;
      const ndEnd   = `${year}-12-31`;

      const [{ data: te }, { data: rec }, { data: yte }, { data: nd }] = await Promise.all([
        supabase.from("time_entries").select("*")
          .eq("user_id", user.id).gte("date", startDate).lte("date", endDate),
        supabase.from("salary_records").select("*")
          .eq("user_id", user.id).eq("year", year).order("month"),
        supabase.from("time_entries").select("*")
          .eq("user_id", user.id).gte("date", yearStart).lte("date", yearEnd),
        supabase.from("notdienst_entries").select("date")
          .eq("user_id", user.id).gte("date", ndStart).lte("date", ndEnd),
      ]);

      if (te)  setEntries(te as TimeEntry[]);
      if (rec) setRecords(rec as MonthRecord[]);
      if (yte) setYearEntries(yte as TimeEntry[]);
      if (nd)  setYearNotdienstDates((nd as { date: string }[]).map(n => n.date));
      setLoading(false);
    }
    void load();
  }, [year, month]);

  /** Bu ayın brutto'suna giren Notdienst sayısı = ÖNCEKI ay'ın Notdienst'leri.
   *  Ocak için: önceki yılın Aralık ayı. */
  function notdienstDaysForBilling(billingYear: number, billingMonth: number): number {
    const prevMonth = billingMonth === 1 ? 12 : billingMonth - 1;
    const prevYear  = billingMonth === 1 ? billingYear - 1 : billingYear;
    const prefix    = `${prevYear}-${String(prevMonth).padStart(2, "0")}-`;
    return yearNotdienstDates.filter(d => d.startsWith(prefix)).length;
  }

  // Auto-calc: 12 ay brutto + netto serisi (time_entries'ten)
  // Notdienst bir önceki ayın işidir → her ayın brutto'suna PREVIOUS month'un Notdienst'i ekleniyor
  const yearlyAuto = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthEntries = yearEntries.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() + 1 === m && d.getFullYear() === year;
      });
      const ndDays = notdienstDaysForBilling(year, m);
      const bd = calculateMonthlySalary(monthEntries, settings, { notdienstDaysOverride: ndDays, feiertage });
      const nc = calcNettoFromBrutto({
        monthBrutto:   bd.total_gross,
        steuerklasse:  settings.steuerklasse  ?? "I",
        kirchensteuer: settings.kirchensteuer ?? 0,
        hatKinder:     settings.hat_kinder    ?? false,
        taxMode:       settings.tax_mode      ?? "auto",
        manuellAbzug:  settings.manuell_abzug ?? 0,
        sfnLstFrei:    bd.sfn_lst_frei,
        sfnSvFrei:     bd.sfn_sv_frei,
      });
      return { month: m, brutto: bd.total_gross, netto: nc.netto, ndDays };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearEntries, year, settings, yearNotdienstDates, feiertage]);

  const yearlyAutoMax = Math.max(...yearlyAuto.map(a => a.brutto), 1);
  const yearlyAutoBruttoTotal = yearlyAuto.reduce((s, a) => s + a.brutto, 0);
  const yearlyAutoNettoTotal  = yearlyAuto.reduce((s, a) => s + a.netto, 0);

  /** Year-to-Date: nur abgeschlossene Monate (Brutto > 0 ODER vergangene Monate). */
  const ytd = useMemo(() => {
    const today = new Date();
    const isCurrentYear = year === today.getFullYear();
    const isPastYear    = year < today.getFullYear();
    // Vollständig abgeschlossene Monate (1-indexed):
    //   Vergangenes Jahr -> alle 12
    //   Aktuelles Jahr   -> aktueller Monat - 1 (Mai im Juni)
    //   Zukünftiges Jahr -> 0
    const completedMonths =
      isPastYear    ? 12 :
      isCurrentYear ? today.getMonth() :
                      0;
    const slice = yearlyAuto.slice(0, completedMonths);
    const brutto = slice.reduce((s, m) => s + m.brutto, 0);
    const netto  = slice.reduce((s, m) => s + m.netto,  0);
    const withData = slice.filter(m => m.brutto > 0).length;
    return { brutto, netto, completedMonths, withData };
  }, [yearlyAuto, year]);

  /** Bu ay brutto = bu ay çalışma + ÖNCEKI ay Notdienst (ödeme gecikmesi). */
  const currentMonthNotdienstDays = notdienstDaysForBilling(year, month);
  const breakdown = useMemo(
    () => calculateMonthlySalary(entries, settings, { notdienstDaysOverride: currentMonthNotdienstDays, feiertage }),
    [entries, settings, currentMonthNotdienstDays, feiertage],
  );

  // Otomatik Netto-Berechnung (Almanya 2024)
  const nettoCalc = useMemo(() => calcNettoFromBrutto({
    monthBrutto:   breakdown.total_gross,
    steuerklasse:  settings.steuerklasse  ?? "I",
    kirchensteuer: settings.kirchensteuer ?? 0,
    hatKinder:     settings.hat_kinder    ?? false,
    taxMode:       settings.tax_mode      ?? "auto",
    manuellAbzug:  settings.manuell_abzug ?? 0,
    sfnLstFrei:    breakdown.sfn_lst_frei,
    sfnSvFrei:     breakdown.sfn_sv_frei,
  }), [breakdown.total_gross, breakdown.sfn_lst_frei, breakdown.sfn_sv_frei,
       settings.steuerklasse, settings.kirchensteuer,
       settings.hat_kinder, settings.tax_mode, settings.manuell_abzug]);

  /** What-if simülatörü: Stundenlohn +1 € senaryosu, aylık Netto farkı.
   *  Kullanıcının pazarlık değeri için: "+1 €/h ne kazandırır?" */
  const whatIfPlusOne = useMemo(() => {
    const settingsPlus = { ...settings, hourly_rate: settings.hourly_rate + 1 };
    const bdPlus = calculateMonthlySalary(entries, settingsPlus, { notdienstDaysOverride: currentMonthNotdienstDays, feiertage });
    const ncPlus = calcNettoFromBrutto({
      monthBrutto:   bdPlus.total_gross,
      steuerklasse:  settings.steuerklasse  ?? "I",
      kirchensteuer: settings.kirchensteuer ?? 0,
      hatKinder:     settings.hat_kinder    ?? false,
      taxMode:       settings.tax_mode      ?? "auto",
      manuellAbzug:  settings.manuell_abzug ?? 0,
      sfnLstFrei:    bdPlus.sfn_lst_frei,
      sfnSvFrei:     bdPlus.sfn_sv_frei,
    });
    return {
      bruttoDelta: bdPlus.total_gross - breakdown.total_gross,
      nettoDelta:  ncPlus.netto       - nettoCalc.netto,
    };
  }, [entries, settings, currentMonthNotdienstDays, feiertage, breakdown.total_gross, nettoCalc.netto]);

  // §3 EntgFG — Krank-Episoden auf yearEntries (kalenderdays)
  const krankheitEpisodes = useMemo<KrankheitEpisode[]>(
    () => calcKrankheitEpisodes(yearEntries),
    [yearEntries],
  );
  const krankheitOverLimit = krankheitEpisodes.filter(e => e.days > ENTGFG_KRANKHEIT_LIMIT_DAYS);

  // §5 + §7 BUrlG — Urlaubskonto (Zwölftelung + Übertrag/Verfall 31.03)
  const urlaubskonto = useMemo(() => {
    const entitlement = calcAnnualEntitlement({
      annualAnspruch:  settings.urlaub_anspruch ?? 30,
      employmentStart: settings.employment_start_date ?? null,
      employmentEnd:   settings.employment_end_date ?? null,
      year,
    });
    const usedThisYear = yearEntries.filter(e => e.day_type === "urlaub").length;
    const todayISO = new Date().toISOString().slice(0, 10);
    const konto = calcUrlaubskonto({
      thisYearEntitlement:   entitlement.anspruch,
      thisYearUsed:          usedThisYear,
      previousYearRemaining: settings.urlaub_carry_over ?? 0,
      refDate:               todayISO,
      year,
    });
    return { entitlement, usedThisYear, konto };
  }, [settings.urlaub_anspruch, settings.employment_start_date, settings.employment_end_date,
      settings.urlaub_carry_over, yearEntries, year]);

  const [moneyHidden, togglePrivacy] = usePrivacyMode();
  const fmtEur    = (n: number) => maskMoney(n, moneyHidden);
  const fmtEurNoCents = (n: number) => maskMoney(n, moneyHidden, { decimals: 0 });

  // Yearly totals from records
  const yearlyBrutto = records.reduce((s, r) => s + r.brutto, 0);
  const yearlyNetto  = records.reduce((s, r) => s + r.netto,  0);
  const yearlyMax    = Math.max(...records.map(r => r.brutto), 1);

  // Current month record
  const curRecord = records.find(r => r.month === month);

  function prevMonth() { if (month === 1) { setYear(y => y-1); setMonth(12); } else setMonth(m => m-1); }
  function nextMonth() { if (month === 12) { setYear(y => y+1); setMonth(1); } else setMonth(m => m+1); }

  function openRecordModal() {
    setMBrutto(curRecord ? String(curRecord.brutto) : String(breakdown.total_gross.toFixed(2)));
    setMNetto(curRecord ? String(curRecord.netto) : "");
    setMNote(curRecord?.note ?? "");
    setRecordModal(true);
  }

  async function saveRecord() {
    setMSaving(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setMSaving(false); return; }

    const payload = {
      user_id: session.user.id,
      year,
      month,
      brutto:  parseFloat(mBrutto) || 0,
      netto:   parseFloat(mNetto)  || 0,
      note:    mNote || null,
    };

    if (curRecord) {
      await supabase.from("salary_records").update(payload).eq("id", curRecord.id);
      setRecords(prev => prev.map(r => r.month === month ? { ...r, ...payload } : r));
    } else {
      const { data } = await supabase.from("salary_records").insert(payload).select().single();
      if (data) setRecords(prev => [...prev, data as MonthRecord].sort((a,b) => a.month - b.month));
    }

    setMSaving(false);
    setRecordModal(false);
  }

  async function deleteRecord() {
    if (!curRecord) return;
    const supabase = createClient();
    await supabase.from("salary_records").delete().eq("id", curRecord.id);
    setRecords(prev => prev.filter(r => r.month !== month));
    setRecordModal(false);
  }

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Gehaltsübersicht</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={togglePrivacy}
              title={moneyHidden ? "Beträge anzeigen" : "Beträge verbergen"}
              aria-label={moneyHidden ? "Beträge anzeigen" : "Beträge verbergen"}
              style={{
                background: moneyHidden ? "color-mix(in srgb, var(--blue) 14%, transparent)" : "var(--surface2)",
                border: `1px solid ${moneyHidden ? "color-mix(in srgb, var(--blue) 35%, transparent)" : "var(--border)"}`,
                color: moneyHidden ? "var(--blue)" : "var(--muted)",
                width: 36, height: 30, borderRadius: 8, cursor: "pointer",
                fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {moneyHidden ? "🔒" : "👁"}
            </button>
            <YearPicker value={year} onChange={setYear} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <button onClick={prevMonth} style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", width: 44, height: 44, borderRadius: 10, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} aria-label="Vorheriger Monat">‹</button>
          <h1 style={{ fontSize: 18, fontWeight: 800, minWidth: 90, textAlign: "center" }}>{MONTHS[month - 1]}</h1>
          <button onClick={nextMonth} style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", width: 44, height: 44, borderRadius: 10, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} aria-label="Nächster Monat">›</button>
        </div>
      </div>

      <div style={{ padding: "20px 16px 40px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 960, margin: "0 auto" }}>

        {/* ── Settings ── */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span className="label">⚙️ Einstellungen</span>
            {settingsSaved && <span style={{ fontSize: 10, color: "var(--green)", fontWeight: 700 }}>✓ Gespeichert</span>}
          </div>

          {/* Live preview — Settings değişince anında güncellenir */}
          {!loading && entries.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 10, marginBottom: 14,
              padding: "10px 14px",
              background: "color-mix(in srgb, var(--accent2) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent2) 25%, transparent)",
              borderRadius: 10,
              fontFamily: "'DM Mono',monospace",
              fontSize: 12,
            }}>
              <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "'Syne',sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                ⚡ Live {MONTHS[month-1]}
              </span>
              <span style={{ color: "var(--green)" }}>{fmtEur(breakdown.total_gross)} <span style={{ fontSize: 9, color: "var(--muted)" }}>Brutto</span></span>
              <span style={{ color: "var(--muted)" }}>→</span>
              <span style={{ color: "var(--accent2)" }}>{fmtEur(nettoCalc.netto)} <span style={{ fontSize: 9, color: "var(--muted)" }}>Netto</span></span>
            </div>
          )}
          <div className="settings-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {([
              {
                key: "hourly_rate", label: "Stundenlohn (€)",
                tipTitle: "Stundenlohn",
                tipBody: "Dein Brutto-Stundenlohn. Grundlage für alle Berechnungen — Grundgehalt, Überstunden und Bonusbeträge.\n\nStandard für Handwerk: 15 €/h.\nGesetzlicher Mindestlohn 2026: 13,90 €/h.",
              },
              {
                key: "monthly_target_hours", label: "Sollstunden/Monat",
                tipTitle: "Sollstunden / Monat",
                tipBody: "Deine vertragliche Monatsarbeitszeit.\n\nVerwendung:\n• Lohnberechnung (Festgehalt = Sollstunden × Stundenlohn)\n• Tracker-Differenz (Über-/Unterstunden)\n\nTypisch 160-174h für Vollzeit.",
              },
              {
                key: "overtime_rate_multiplier", label: "Überstunden ×",
                tipTitle: "Überstunden-Multiplikator",
                tipBody: "Aufschlag für Stunden über deiner Sollzeit.\n\n• 1,00 = kein Extra (Überstunden wie normale Stunden)\n• 1,25 = 25 % Aufschlag (üblich)\n• 1,50 = 50 % Aufschlag (Wochenende/Nacht)",
              },
              {
                key: "night_shift_bonus", label: "Nachtzuschlag €/h",
                tipTitle: "Nachtzuschlag",
                tipBody: "Zusätzlicher Bonus pro Stunde für als 'Nachtschicht' markierte Einträge.\n\nWird auf den Stundenlohn aufgeschlagen, NICHT mit dem Überstundensatz multipliziert.",
              },
              {
                key: "notdienst_bonus", label: "Notdienst €/Tag",
                tipTitle: "Notdienst-Bonus",
                tipBody: "Pauschal pro Einsatz (unabhängig von der Dauer).\n\n⏱ Auszahlungs-Zeitpunkt:\nNotdienst aus Vormonat wird im aktuellen Monat ausgezahlt. Beispiel: Januar-Notdienst → Februar-Brutto.",
              },
              {
                key: "urlaub_anspruch", label: "Urlaubsanspruch / Jahr",
                tipTitle: "Urlaubsanspruch",
                tipBody: "Deine jährlichen Urlaubstage laut Vertrag.\n\n• 24 Tage = BUrlG-Minimum (6-Tage-Woche)\n• 20 Tage = BUrlG-Minimum (5-Tage-Woche)\n• 30 Tage = übliche Regelung im Handwerk\n\nWird im Tracker für 'Urlaub übrig' verwendet.",
              },
            ] as { key: keyof SalarySettings; label: string; tipTitle: string; tipBody: string }[]).map(({ key, label, tipTitle, tipBody }) => {
              const isHourly = key === "hourly_rate";
              const rate = settings.hourly_rate ?? 0;
              const belowMindestlohn = isHourly && rate > 0 && rate < MINDESTLOHN_CURRENT;
              return (
                <div key={key}>
                  <label className="label" style={{ display: "inline-flex", alignItems: "center" }}>
                    {label}
                    <InfoTooltip title={tipTitle}>{tipBody}</InfoTooltip>
                  </label>
                  <input
                    className="input" type="number" step="0.01"
                    value={settings[key] as number}
                    onChange={(e) => setSettings(s => ({ ...s, [key]: parseFloat(e.target.value) || 0 }))}
                    style={isHourly && belowMindestlohn ? { borderColor: "var(--red)" } : undefined}
                  />
                  {isHourly && (
                    <div style={{ fontSize: 10, marginTop: 4, lineHeight: 1.5 }}>
                      <div style={{ color: belowMindestlohn ? "var(--red)" : "var(--muted)" }}>
                        {belowMindestlohn ? (
                          <>⚠️ Unter dem gesetzlichen Mindestlohn ({formatMindestlohn()}/h) — bitte prüfen.</>
                        ) : (
                          <>💶 Gesetzlicher Mindestlohn {new Date().getFullYear()}: <strong style={{ color: "var(--text)" }}>{formatMindestlohn()}/h</strong></>
                        )}
                      </div>
                      {entries.length > 0 && whatIfPlusOne.nettoDelta > 0 && (
                        <div style={{ color: "var(--green)", marginTop: 2 }}>
                          💡 <strong>+1 €/h</strong> ≈ +{fmtEur(whatIfPlusOne.nettoDelta)} / Monat Netto
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Beschäftigung & Urlaub (BUrlG) ── */}
        <div className="card">
          <div className="label" style={{ marginBottom: 12 }}>💼 Beschäftigung & Urlaub</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            <div>
              <label className="label" style={{ display: "inline-flex", alignItems: "center" }}>
                Beschäftigt seit
                <InfoTooltip title="§5 BUrlG Zwölftelung">
                  Datum, an dem dein Arbeitsverhältnis begonnen hat.{"\n\n"}
                  Wenn im laufenden Jahr, wird der Urlaubsanspruch anteilig
                  gekürzt (1/12 pro fehlendem Kalendermonat).{"\n\n"}
                  Nach 6 Monaten Wartezeit (§4 BUrlG) besteht der volle Anspruch.
                </InfoTooltip>
              </label>
              <input
                className="input" type="date"
                value={settings.employment_start_date ?? ""}
                onChange={(e) => setSettings(s => ({ ...s, employment_start_date: e.target.value || null }))}
              />
            </div>
            <div>
              <label className="label" style={{ display: "inline-flex", alignItems: "center" }}>
                Beschäftigt bis (optional)
                <InfoTooltip title="Beschäftigungsende">
                  Datum, an dem dein Arbeitsverhältnis endet (letzter Arbeitstag).
                  Nur ausfüllen wenn befristet oder Kündigung ausgesprochen.
                  Leer = weiterhin aktiv.
                </InfoTooltip>
              </label>
              <input
                className="input" type="date"
                value={settings.employment_end_date ?? ""}
                onChange={(e) => setSettings(s => ({ ...s, employment_end_date: e.target.value || null }))}
              />
            </div>
            <div>
              <label className="label" style={{ display: "inline-flex", alignItems: "center" }}>
                Übertrag Vorjahr (Tage)
                <InfoTooltip title="§7 III BUrlG Übertrag">
                  Übertragene Urlaubstage aus dem Vorjahr, die noch nicht
                  genommen wurden.{"\n\n"}
                  Diese Tage verfallen am 31.03. des laufenden Jahres, wenn
                  sie bis dahin nicht genommen wurden (§7 III S. 2 BUrlG).{"\n\n"}
                  Übertragung ist nur bei dringenden betrieblichen oder
                  persönlichen Gründen zulässig — Abstimmung mit AG.
                </InfoTooltip>
              </label>
              <input
                className="input" type="number" step="0.5" min={0} max={60}
                value={settings.urlaub_carry_over ?? 0}
                onChange={(e) => setSettings(s => ({ ...s, urlaub_carry_over: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>
        </div>

        {/* ── Steuer-Einstellungen ── */}
        <div className="card">
          <div className="label" style={{ marginBottom: 12 }}>🇩🇪 Steuer & Abzüge</div>

          {/* Steuerklasse — visual buttons */}
          <div style={{ marginBottom: 14 }}>
            <label className="label" style={{ marginBottom: 6, display: "inline-flex", alignItems: "center" }}>
              Steuerklasse
              <InfoTooltip title="Lohnsteuerklasse">
                Deine Steuerklasse laut Lohnsteuerkarte (I–VI).{"\n\n"}
                • I = Ledig / dauernd getrennt{"\n"}
                • II = Alleinerziehend{"\n"}
                • III = Verheiratet, höher verdienend{"\n"}
                • IV = Verheiratet, etwa gleich{"\n"}
                • V = Verheiratet, niedriger verdienend{"\n"}
                • VI = Zweitjob (höchste Steuer)
              </InfoTooltip>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
              {STEUERKLASSEN.map(({ value, label, hint }) => {
                const active = (settings.steuerklasse ?? "I") === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, steuerklasse: value }))}
                    title={hint}
                    style={{
                      padding: "10px 4px",
                      background: active ? "var(--accent)" : "var(--surface2)",
                      border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: 8,
                      color: active ? "white" : "var(--muted)",
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 800,
                      fontSize: 14,
                      cursor: "pointer",
                      lineHeight: 1.1,
                    }}
                  >
                    <div>{label}</div>
                    <div style={{ fontSize: 8, fontWeight: 600, opacity: 0.8, marginTop: 2 }}>{hint}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 2: Kirchensteuer + Kind */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label className="label" style={{ display: "inline-flex", alignItems: "center" }}>
                Kirchensteuer
                <InfoTooltip title="Kirchensteuer">
                  Wird auf die Lohnsteuer aufgeschlagen, wenn du Mitglied einer Kirche bist.{"\n\n"}
                  • 9 % in den meisten Bundesländern{"\n"}
                  • 8 % in Bayern und Baden-Württemberg{"\n"}
                  • Keine, wenn nicht in der Kirche
                </InfoTooltip>
              </label>
              <select
                className="input"
                value={String(settings.kirchensteuer ?? 0)}
                onChange={(e) => setSettings(s => ({ ...s, kirchensteuer: Number(e.target.value) as KirchensteuerRate }))}
                style={{ appearance: "none" }}
              >
                {KIRCHENSTEUER_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" style={{ display: "inline-flex", alignItems: "center" }}>
                Kind im Haushalt
                <InfoTooltip title="Kinder & Pflegeversicherung">
                  Beeinflusst nur die Pflegeversicherung (PV):{"\n\n"}
                  • Mit Kind: 1,7 % PV{"\n"}
                  • Ohne Kind (ab 23 Jahre): 2,35 % PV (Kinderlosenzuschlag 0,6 %){"\n\n"}
                  Hat KEINEN Einfluss auf die Lohnsteuer.
                </InfoTooltip>
              </label>
              <button
                type="button"
                onClick={() => setSettings(s => ({ ...s, hat_kinder: !s.hat_kinder }))}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: settings.hat_kinder ? "var(--green)" : "var(--surface2)",
                  border: `1px solid ${settings.hat_kinder ? "var(--green)" : "var(--border)"}`,
                  borderRadius: 10,
                  color: settings.hat_kinder ? "white" : "var(--muted)",
                  fontFamily: "'Syne',sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {settings.hat_kinder ? "✓ Ja (PV 1,7%)" : "Nein (PV 2,35%)"}
              </button>
            </div>
          </div>

          {/* Manual mode */}
          <div style={{ background: "var(--surface2)", borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: settings.tax_mode === "manual" ? 10 : 0 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", display: "inline-flex", alignItems: "center" }}>
                  Manueller Modus
                  <InfoTooltip title="Manueller Abzugs-Modus">
                    Wenn die automatische Berechnung stark von deiner echten Abrechnung abweicht, kannst du einen festen Gesamt-Abzugssatz eingeben.{"\n\n"}
                    Beispiel: Echte Abrechnung zeigt 32 % Abzug → trage 32 ein.{"\n\n"}
                    Stundly nutzt dann diesen Prozentsatz statt EStG-Berechnung + SV-Beiträge.
                  </InfoTooltip>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Fester % statt echte Berechnung</div>
              </div>
              <button
                type="button"
                onClick={() => setSettings(s => ({ ...s, tax_mode: s.tax_mode === "manual" ? "auto" : "manual" }))}
                style={{
                  padding: "6px 14px",
                  background: settings.tax_mode === "manual" ? "var(--accent)" : "var(--surface)",
                  border: `1px solid ${settings.tax_mode === "manual" ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 999,
                  color: settings.tax_mode === "manual" ? "white" : "var(--muted)",
                  fontFamily: "'Syne',sans-serif",
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                {settings.tax_mode === "manual" ? "AN" : "AUS"}
              </button>
            </div>
            {settings.tax_mode === "manual" && (
              <div>
                <label className="label">Abzug in %</label>
                <input
                  className="input"
                  type="number" step="0.1" min="0" max="100"
                  value={settings.manuell_abzug ?? 0}
                  onChange={(e) => setSettings(s => ({ ...s, manuell_abzug: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            )}
          </div>

          {/* §3b EStG SFN-Zuschläge */}
          <div style={{ background: "var(--surface2)", borderRadius: 10, padding: 12, marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", display: "inline-flex", alignItems: "center" }}>
                  §3b Zuschlag (SFN)
                  <InfoTooltip title="Sonntag/Feiertag/Nacht-Zuschläge">
                    §3b EStG: Zuschläge für Arbeit an Sonntagen, Feiertagen und in der Nacht
                    (20-06 Uhr) sind steuer- und teilweise sv-frei.{"\n\n"}
                    • Nacht 20-06 Uhr: 25 %{"\n"}
                    • Sonntag: 50 %{"\n"}
                    • Feiertag: 125 %{"\n"}
                    • Überschneidung: additiv (z.B. Sonntag+Nacht = 75 %){"\n\n"}
                    Grundlohn-Cap: 50 €/h steuerfrei, 25 €/h sv-frei.{"\n\n"}
                    Wenn aktiv: automatisch aus deinen Arbeitszeiten berechnet und
                    zum Brutto addiert. Netto wird höher (weniger Lohnsteuer + SV).{"\n\n"}
                    Vereinfacht — exakte Payroll nur mit Steuerberater.
                  </InfoTooltip>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Steuerfreie Zuschläge automatisch berechnen</div>
              </div>
              <button
                type="button"
                onClick={() => setSettings(s => ({ ...s, sfn_enabled: !s.sfn_enabled }))}
                style={{
                  padding: "6px 14px",
                  background: settings.sfn_enabled ? "var(--accent)" : "var(--surface)",
                  border: `1px solid ${settings.sfn_enabled ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 999,
                  color: settings.sfn_enabled ? "white" : "var(--muted)",
                  fontFamily: "'Syne',sans-serif",
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                {settings.sfn_enabled ? "AN" : "AUS"}
              </button>
            </div>
          </div>

          <div style={{
            marginTop: 12,
            padding: "10px 12px",
            background: "color-mix(in srgb, var(--yellow) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--yellow) 25%, transparent)",
            borderRadius: 8,
            fontSize: 11,
            color: "var(--muted)",
            lineHeight: 1.55,
          }}>
            ⚠️ <strong style={{ color: "var(--text)" }}>Wichtig:</strong> Alle Brutto/Netto-Werte sind <strong style={{ color: "var(--yellow)" }}>Schätzungen</strong>.
            Die echte Lohnabrechnung kann abweichen — Krankenkassen-Zusatzbeitrag (kassenspezifisch),
            geldwerte Vorteile, Pauschalsteuer und Freibeträge werden nicht berücksichtigt.
            Für exakte Werte bitte deine echte Gehaltsabrechnung verwenden.
          </div>
        </div>

        {/* ── Year-to-Date Übersicht ── */}
        {!loading && ytd.brutto > 0 && (
          <div style={{
            background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 14%, var(--surface)) 0%, color-mix(in srgb, var(--accent2) 8%, var(--surface)) 100%)",
            border: "1px solid color-mix(in srgb, var(--accent2) 30%, transparent)",
            borderRadius: 16,
            padding: "18px 20px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--accent2)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                📊 Year-to-Date {year}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                {ytd.completedMonths > 0
                  ? `${MONTHS_S[0]} – ${MONTHS_S[ytd.completedMonths - 1]}`
                  : "—"}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              <div style={{ textAlign: "center", background: "color-mix(in srgb, var(--green) 12%, transparent)", borderRadius: 10, padding: "10px 6px" }}>
                <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>BRUTTO</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 700, color: "var(--green)" }}>
                  {fmtEur(ytd.brutto)}
                </div>
              </div>
              <div style={{ textAlign: "center", background: "color-mix(in srgb, var(--accent2) 14%, transparent)", borderRadius: 10, padding: "10px 6px" }}>
                <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>NETTO</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 700, color: "var(--accent2)" }}>
                  {fmtEur(ytd.netto)}
                </div>
              </div>
              <div style={{ textAlign: "center", background: "color-mix(in srgb, var(--blue) 10%, transparent)", borderRadius: 10, padding: "10px 6px" }}>
                <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>Ø NETTO / MO</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 700, color: "var(--blue)" }}>
                  {fmtEur(ytd.withData > 0 ? ytd.netto / ytd.withData : 0)}
                </div>
              </div>
            </div>

            {/* 12-Monate Fortschritts-Balken */}
            <div style={{ display: "flex", gap: 3 }}>
              {Array.from({ length: 12 }, (_, i) => {
                const filled = i < ytd.completedMonths;
                const withData = yearlyAuto[i]?.brutto && yearlyAuto[i]!.brutto > 0;
                return (
                  <div
                    key={i}
                    title={`${MONTHS_S[i]}: ${withData ? fmtEur(yearlyAuto[i]!.netto) : "—"}`}
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 3,
                      background: filled
                        ? (withData ? "var(--accent2)" : "color-mix(in srgb, var(--accent2) 30%, transparent)")
                        : "var(--surface2)",
                      transition: "background 0.3s",
                    }}
                  />
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6, textAlign: "center" }}>
              {ytd.withData} von {ytd.completedMonths} abgeschlossenen Monaten haben Daten
              {!yearlyAuto[(new Date()).getMonth()]?.brutto && year === new Date().getFullYear() && (
                <> · {MONTHS[(new Date()).getMonth()]} läuft noch</>
              )}
            </div>
          </div>
        )}

        {/* ── Monatsberechnung ── */}
        {loading ? (
          <div
            role="status"
            aria-label="Gehaltsdaten werden geladen"
            style={{ display: "flex", flexDirection: "column", gap: 12, padding: "6px 0" }}
          >
            <Skeleton fullWidth height={120} radius={12} />
            <Skeleton fullWidth height={180} radius={12} />
            <Skeleton fullWidth height={80}  radius={12} />
          </div>
        ) : entries.length === 0 && yearEntries.length === 0 ? (
          /* Yeni kullanıcı: bu yıl henüz hiç entry yok → setup hint */
          <div style={{
            background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 14%, var(--surface)) 0%, color-mix(in srgb, var(--accent2) 8%, var(--surface)) 100%)",
            border: "1px solid color-mix(in srgb, var(--accent2) 30%, transparent)",
            borderRadius: 16,
            padding: "24px 22px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>💰</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
              Noch keine Berechnung möglich
            </div>
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 18, maxWidth: 460, margin: "0 auto 18px" }}>
              Stelle oben deinen <strong style={{ color: "var(--text)" }}>Stundenlohn</strong> ein und erfasse anschließend deinen ersten Arbeitstag im Tracker. Stundly berechnet dann automatisch dein geschätztes Brutto- und Netto-Gehalt.
            </p>
            <Link href="/tracker" style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "var(--accent)",
              color: "white",
              borderRadius: 10,
              fontFamily: "'Syne',sans-serif",
              fontSize: 13,
              fontWeight: 800,
              textDecoration: "none",
            }}>
              ⏱ Zur Zeiterfassung →
            </Link>
          </div>
        ) : entries.length === 0 ? (
          /* Bu ayda entry yok ama yıllık var → küçük info notice */
          <div className="card" style={{
            textAlign: "center",
            background: "color-mix(in srgb, var(--accent2) 6%, var(--surface))",
            border: "1px solid color-mix(in srgb, var(--accent2) 25%, transparent)",
          }}>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
              ℹ️ Für <strong style={{ color: "var(--text)" }}>{MONTHS[month-1]} {year}</strong> gibt es noch keine Zeiteinträge — daher wird kein Lohn berechnet.
              <br />
              <Link href="/tracker" style={{ color: "var(--accent2)", fontWeight: 700, textDecoration: "none" }}>
                Arbeitstage erfassen →
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* HERO — Brutto → Netto */}
            <div className="card purple">
              <div className="label" style={{ marginBottom: 12, display: "inline-flex", alignItems: "center" }}>
                💰 {MONTHS[month-1]} — Schätzung
                <InfoTooltip title="Warum nur eine Schätzung?" color="var(--yellow)" icon="⚠️">
                  Die echte Lohnabrechnung kann abweichen, weil:{"\n\n"}
                  • <strong>Krankenkassen-Zusatzbeitrag</strong> variiert je Kasse (0,9 – 2,5 %){"\n"}
                  • <strong>Geldwerte Vorteile</strong> (Dienstwagen, Job-Ticket, Essensgutscheine){"\n"}
                  • <strong>Pauschalsteuer</strong> bei Minijobs oder Bonuszahlungen{"\n"}
                  • <strong>Vermögenswirksame Leistungen</strong>, betriebliche Altersvorsorge{"\n"}
                  • <strong>Freibeträge</strong> auf deiner Steuerkarte (Werbungskosten, Kinderfreibetrag){"\n\n"}
                  Stundly nutzt EStG §32a 2024 + Standard-SV-Sätze. Genauigkeit ±5 % bei mittlerem Brutto.{"\n\n"}
                  Für exakte Werte → echte Gehaltsabrechnung verwenden.
                </InfoTooltip>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center", marginBottom: 10 }}>
                <div style={{ textAlign: "center", background: "color-mix(in srgb, var(--green) 12%, transparent)", borderRadius: 12, padding: "12px 8px" }}>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>BRUTTO</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 500, color: "var(--green)" }}>
                    {fmtEur(breakdown.total_gross)}
                  </div>
                </div>
                <div style={{ fontSize: 22, color: "var(--muted)" }}>→</div>
                <div style={{ textAlign: "center", background: "color-mix(in srgb, var(--accent2) 14%, transparent)", borderRadius: 12, padding: "12px 8px" }}>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>NETTO</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 500, color: "var(--accent2)" }}>
                    {fmtEur(nettoCalc.netto)}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "center", fontSize: 11, color: "var(--muted)" }}>
                Abzüge gesamt: <strong style={{ color: "var(--red)" }}>{fmtEur(nettoCalc.abzuege.gesamt)}</strong>
                {nettoCalc.abzuege.manuell && <> (manuell {nettoCalc.abzuege.manuellProzent}%)</>}
              </div>
            </div>

            {/* §5+§7 BUrlG — Urlaubskonto (Zwölftelung + Verfall 31.03) */}
            {(urlaubskonto.entitlement.isProrated || urlaubskonto.konto.carryOverAvailable > 0 || urlaubskonto.konto.verfallWarning) && (
              <div
                className="card"
                style={{
                  background: urlaubskonto.konto.verfallWarning
                    ? "color-mix(in srgb, var(--red) 10%, var(--surface))"
                    : "color-mix(in srgb, var(--accent2) 8%, var(--surface))",
                  border: urlaubskonto.konto.verfallWarning
                    ? "1px solid color-mix(in srgb, var(--red) 35%, transparent)"
                    : "1px solid color-mix(in srgb, var(--accent2) 30%, transparent)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 8, display: "inline-flex", alignItems: "center" }}>
                  🏖 Urlaubskonto {year}
                  <InfoTooltip title="BUrlG Zwölftelung + Verfall">
                    §5 BUrlG (Zwölftelung): Wenn dein Arbeitsverhältnis nicht das
                    ganze Jahr besteht, verringert sich der Anspruch um 1/12 pro
                    fehlendem Kalendermonat.{"\n\n"}
                    §7 III BUrlG (Übertrag): Urlaub muss im Kalenderjahr genommen
                    werden. Übertrag aus dem Vorjahr verfällt am 31.03.
                    des laufenden Jahres, wenn er bis dahin nicht genommen wurde.{"\n\n"}
                    Einstellungen unten:
                    {" "}Beschäftigungsbeginn/-ende + Übertrag aus Vorjahr.
                  </InfoTooltip>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, fontSize: 12 }}>
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Anspruch</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500 }}>
                      {urlaubskonto.entitlement.anspruch} Tage
                    </div>
                    {urlaubskonto.entitlement.isProrated && (
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>
                        {urlaubskonto.entitlement.fullMonths}/12 Monate (§5)
                      </div>
                    )}
                  </div>
                  {urlaubskonto.konto.carryOverAvailable > 0 && (
                    <div>
                      <div style={{ color: "var(--muted)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Übertrag</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500 }}>
                        +{urlaubskonto.konto.carryOverAvailable}
                      </div>
                      <div style={{ fontSize: 10, color: urlaubskonto.konto.verfallWarning ? "var(--red)" : "var(--muted)" }}>
                        Verfall {urlaubskonto.konto.verfallDate}
                      </div>
                    </div>
                  )}
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Genommen</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500 }}>
                      {urlaubskonto.usedThisYear} Tage
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Rest</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500, color: urlaubskonto.konto.remaining < 0 ? "var(--red)" : "var(--green)" }}>
                      {urlaubskonto.konto.remaining} Tage
                    </div>
                  </div>
                </div>
                {urlaubskonto.konto.verfallWarning && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "var(--red)", fontWeight: 700 }}>
                    ⚠️ {urlaubskonto.konto.carryOverAvailable} Übertrag-Tag(e) verfallen in {urlaubskonto.konto.daysUntilVerfall} Tagen (31.03.)
                  </div>
                )}
                {urlaubskonto.entitlement.waitingPeriodActive && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
                    ℹ️ §4 BUrlG Wartezeit: Voller Urlaubsanspruch erst nach 6 Monaten Beschäftigung.
                  </div>
                )}
              </div>
            )}

            {/* §3 EntgFG — Krankheit über 6 Wochen */}
            {krankheitOverLimit.length > 0 && (
              <div
                role="alert"
                className="card"
                style={{
                  background: "color-mix(in srgb, var(--red) 10%, var(--surface))",
                  border: "1px solid color-mix(in srgb, var(--red) 35%, transparent)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--red)", marginBottom: 6, display: "inline-flex", alignItems: "center" }}>
                  🩺 §3 EntgFG — Lohnfortzahlung endet
                  <InfoTooltip title="6 Wochen Lohnfortzahlung">
                    §3 EntgFG: Der Arbeitgeber zahlt bei Krankheit maximal
                    6 Wochen (42 Kalendertage) das volle Gehalt weiter.{"\n\n"}
                    Ab dem 43. Tag zahlt die Krankenkasse Krankengeld:{"\n"}
                    • 70 % des Bruttos{"\n"}
                    • Höchstens 90 % des Nettos{"\n\n"}
                    Diese Anzeige nutzt eine vereinfachte Kettenlogik
                    (kalendarisch aufeinanderfolgende Krank-Einträge).
                    Fortsetzungserkrankung nach §3 II EntgFG wird nicht modelliert.
                  </InfoTooltip>
                </div>
                {krankheitOverLimit.map(ep => (
                  <div key={ep.start} style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.55 }}>
                    <strong style={{ color: "var(--text)" }}>{ep.start} — {ep.end}</strong>
                    {" · "}{ep.days} Kalendertage{" · "}
                    <span style={{ color: "var(--red)" }}>
                      {ep.excessDates.length} Tag{ep.excessDates.length === 1 ? "" : "e"} über Limit
                    </span>
                    {" · ab "}{ep.excessDates[0]}{" Krankengeld"}
                  </div>
                ))}
              </div>
            )}

            {/* Verdienst breakdown */}
            <div className="card">
              <div className="label" style={{ marginBottom: 10 }}>📊 Verdienst-Aufschlüsselung</div>
              {(() => {
                const prevMonthName = MONTHS[(month - 2 + 12) % 12]!;
                const rows: Array<{ key: string; label: string; value: string; clickable: boolean }> = [
                  { key: "hours",     label: "Gearbeitete Stunden",   value: formatDuration(Math.round(breakdown.worked_hours * 60)), clickable: false },
                  { key: "base",      label: "Grundgehalt",           value: fmtEur(breakdown.base_pay),           clickable: false },
                  { key: "overtime",  label: "Überstundenvergütung",  value: fmtEur(breakdown.overtime_pay),       clickable: false },
                  { key: "night",     label: "Nachtzuschlag",         value: fmtEur(breakdown.night_shift_bonus),  clickable: false },
                  {
                    key:   "notdienst",
                    label: currentMonthNotdienstDays > 0
                      ? `Notdienst-Bonus (${currentMonthNotdienstDays}× aus ${prevMonthName}) →`
                      : `Notdienst-Bonus (0× aus ${prevMonthName})`,
                    value:     fmtEur(breakdown.notdienst_bonus),
                    clickable: currentMonthNotdienstDays > 0,
                  },
                ];
                if (settings.sfn_enabled && breakdown.sfn_zuschlag > 0) {
                  rows.push({
                    key: "sfn",
                    label: "§3b Zuschlag (SFN, steuerfrei-Anteil)",
                    value: fmtEur(breakdown.sfn_zuschlag),
                    clickable: false,
                  });
                }
                return rows;
              })().map(({ key, label, value, clickable }) => {
                const onClick = clickable && key === "notdienst" ? () => {
                  const prevMonth = month === 1 ? 12 : month - 1;
                  const prevYear  = month === 1 ? year - 1 : year;
                  setTrackerMonth(prevYear, prevMonth);
                  router.push("/tracker");
                } : undefined;
                return (
                  <div
                    key={key}
                    onClick={onClick}
                    title={clickable ? "Klick: zu Notdienst-Einträgen im Tracker springen" : undefined}
                    style={{
                      display: "flex", justifyContent: "space-between",
                      padding: "7px 0",
                      borderBottom: "1px solid var(--border)",
                      cursor: clickable ? "pointer" : "default",
                      ...(clickable ? {
                        marginLeft: -6, marginRight: -6, paddingLeft: 6, paddingRight: 6, borderRadius: 6,
                        transition: "background 0.15s",
                      } : {}),
                    }}
                    onMouseEnter={clickable ? (e) => { (e.currentTarget as HTMLDivElement).style.background = "color-mix(in srgb, var(--orange) 8%, transparent)"; } : undefined}
                    onMouseLeave={clickable ? (e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; } : undefined}
                  >
                    <span style={{ fontSize: 13, color: clickable ? "var(--orange)" : "var(--muted)", fontWeight: clickable ? 700 : 400 }}>{label}</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13 }}>{value}</span>
                  </div>
                );
              })}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Brutto Gesamt</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500, color: "var(--green)" }}>
                  {fmtEur(breakdown.total_gross)}
                </span>
              </div>
            </div>

            {/* Abzüge breakdown — only in auto mode */}
            {!nettoCalc.abzuege.manuell && breakdown.total_gross > 0 && (
              <div className="card red">
                <div className="label" style={{ marginBottom: 10 }}>🧾 Abzüge im Detail</div>
                {[
                  { label: "Lohnsteuer",          value: nettoCalc.abzuege.lohnsteuer },
                  { label: "Solidaritätszuschlag", value: nettoCalc.abzuege.soli },
                  { label: "Kirchensteuer",       value: nettoCalc.abzuege.kirchensteuer },
                  { label: "Rentenversicherung (RV)", value: nettoCalc.abzuege.rv },
                  { label: "Arbeitslosenversicherung (AV)", value: nettoCalc.abzuege.av },
                  { label: "Krankenversicherung (KV)", value: nettoCalc.abzuege.kv },
                  { label: "Pflegeversicherung (PV)", value: nettoCalc.abzuege.pv },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: value > 0 ? "var(--red)" : "var(--muted)" }}>
                      − {fmtEur(value)}
                    </span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Summe Abzüge</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 500, color: "var(--red)" }}>
                    − {fmtEur(nettoCalc.abzuege.gesamt)}
                  </span>
                </div>
              </div>
            )}

            {/* ── Monatsabrechnung eintragen ── */}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span className="label">🧾 Abrechnung {MONTHS[month-1]}</span>
                <button
                  onClick={openRecordModal}
                  style={{
                    background: "var(--accent)", border: "none", color: "white",
                    padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                    fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 700,
                  }}
                >
                  {curRecord ? "✏️ Bearbeiten" : "+ Eintragen"}
                </button>
              </div>

              {curRecord ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>BRUTTO</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500, color: "var(--green)" }}>{fmtEur(curRecord.brutto)}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>NETTO</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500, color: "var(--blue)" }}>{fmtEur(curRecord.netto)}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>STEUER</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500, color: "var(--red)" }}>{fmtEur(curRecord.brutto - curRecord.netto)}</div>
                  </div>
                  {curRecord.note && (
                    <div style={{ gridColumn: "1/-1", fontSize: 12, color: "var(--muted)", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                      📝 {curRecord.note}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "16px 0", color: "var(--muted)", fontSize: 13 }}>
                  Noch keine Abrechnung eingetragen.
                </div>
              )}
            </div>

            {/* ── Auto-Jahresübersicht (Stundly berechnet) ── */}
            <div className="card purple">
              <div className="label" style={{ marginBottom: 8 }}>🤖 Jahres-Schätzung {year} (automatisch)</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                {[
                  { label: "Brutto/Jahr",  val: fmtEurNoCents(yearlyAutoBruttoTotal), color: "var(--green)" },
                  { label: "Netto/Jahr",   val: fmtEurNoCents(yearlyAutoNettoTotal),  color: "var(--accent2)"  },
                  { label: "Ø Netto/Mon", val: fmtEurNoCents(yearlyAutoNettoTotal/12), color: "var(--blue)" },
                ].map(c => (
                  <div key={c.label} style={{ textAlign: "center", background: "var(--surface2)", borderRadius: 10, padding: "10px 6px" }}>
                    <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 500, color: c.color }}>{c.val}</div>
                  </div>
                ))}
              </div>

              {yearlyAutoBruttoTotal === 0 ? (
                <div style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", padding: "12px 0" }}>
                  Noch keine Zeiteinträge für {year}.
                </div>
              ) : (
                Array.from({ length: 12 }, (_, i) => {
                  const a = yearlyAuto[i]!;
                  const bPct = Math.round((a.brutto / yearlyAutoMax) * 100);
                  const nPct = Math.round((a.netto  / yearlyAutoMax) * 100);
                  const isEmpty = a.brutto === 0;
                  return (
                    <div key={a.month} style={{ marginBottom: 7, opacity: isEmpty ? 0.3 : 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                        <span style={{ color: a.month === month ? "var(--accent2)" : "var(--muted)", fontWeight: 700, width: 28 }}>{MONTHS_S[i]}</span>
                        {isEmpty ? (
                          <span style={{ fontSize: 10, color: "var(--muted)" }}>—</span>
                        ) : (
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--muted)" }}>
                            B: {fmtEurNoCents(a.brutto)} · N: {fmtEurNoCents(a.netto)}
                          </span>
                        )}
                      </div>
                      <div style={{ position: "relative", height: 8, background: "var(--surface2)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${bPct}%`, background: "var(--green)", borderRadius: 4, transition: "width 0.4s" }} />
                        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${nPct}%`, background: "var(--accent2)", borderRadius: 4, opacity: 0.7, transition: "width 0.4s" }} />
                      </div>
                    </div>
                  );
                })
              )}

              {yearlyAutoBruttoTotal > 0 && (
                <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
                  {[["var(--green)","Brutto"],["var(--accent2)","Netto"]].map(([c,l]) => (
                    <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 8, height: 8, background: c, borderRadius: 2 }} />
                      <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>{l}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8, lineHeight: 1.4 }}>
                ℹ️ Basierend auf Zeiteinträgen × Stundenlohn × Steuereinstellungen.
                Schätzung — die echte Lohnabrechnung kann ±5% abweichen.
              </div>
            </div>

            {/* ── Manuelle Jahresübersicht (Abrechnungen) ── */}
            <div className="card">
              <div className="label" style={{ marginBottom: 6 }}>📊 Echte Abrechnungen {year}</div>

              {/* Totals */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                {[
                  { label: "Brutto",  val: fmtEurNoCents(yearlyBrutto), color: "var(--green)" },
                  { label: "Netto",   val: fmtEurNoCents(yearlyNetto),  color: "var(--blue)"  },
                  { label: "Steuer",  val: fmtEurNoCents(yearlyBrutto - yearlyNetto), color: "var(--red)" },
                ].map(c => (
                  <div key={c.label} style={{ textAlign: "center", background: "var(--surface2)", borderRadius: 10, padding: "10px 6px" }}>
                    <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 500, color: c.color }}>{c.val}</div>
                  </div>
                ))}
              </div>

              {/* Monthly bars */}
              {records.length === 0 ? (
                <div style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", padding: "12px 0" }}>
                  Noch keine Einträge für {year}.
                </div>
              ) : (
                Array.from({ length: 12 }, (_, i) => {
                  const m   = i + 1;
                  const rec = records.find(r => r.month === m);
                  const bPct = rec ? Math.round((rec.brutto / yearlyMax) * 100) : 0;
                  const nPct = rec ? Math.round((rec.netto  / yearlyMax) * 100) : 0;
                  return (
                    <div key={m} style={{ marginBottom: 7, opacity: rec ? 1 : 0.35 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                        <span style={{ color: m === month ? "var(--accent2)" : "var(--muted)", fontWeight: 700, width: 28 }}>{MONTHS_S[i]}</span>
                        {rec ? (
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--muted)" }}>
                            B: {fmtEurNoCents(rec.brutto)} · N: {fmtEurNoCents(rec.netto)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, color: "var(--muted)" }}>—</span>
                        )}
                      </div>
                      <div style={{ position: "relative", height: 8, background: "var(--surface2)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${bPct}%`, background: "var(--green)", borderRadius: 4, transition: "width 0.4s" }} />
                        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${nPct}%`, background: "var(--blue)", borderRadius: 4, opacity: 0.6, transition: "width 0.4s" }} />
                      </div>
                    </div>
                  );
                })
              )}

              {/* Legend */}
              {records.length > 0 && (
                <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
                  {[["var(--green)","Brutto"],["var(--blue)","Netto"]].map(([c,l]) => (
                    <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 8, height: 8, background: c, borderRadius: 2 }} />
                      <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>{l}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Record modal */}
      {recordModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setRecordModal(false)}>
          <div className="modal-sheet">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>🧾 {MONTHS[month-1]} {year}</h2>
              <button className="btn btn-ghost" onClick={() => setRecordModal(false)} style={{ padding: "6px 10px" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="label">Brutto erhalten (€)</label>
                  <input className="input" type="number" step="0.01" value={mBrutto}
                    onChange={e => setMBrutto(e.target.value)} placeholder="z.B. 2500.00" />
                </div>
                <div>
                  <label className="label">Netto erhalten (€)</label>
                  <input className="input" type="number" step="0.01" value={mNetto}
                    onChange={e => setMNetto(e.target.value)} placeholder="z.B. 1800.00" />
                </div>
              </div>

              {mBrutto && mNetto && (
                <div style={{
                  background: "color-mix(in srgb, var(--red) 10%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)",
                  borderRadius: 10, padding: "10px 14px",
                  display: "flex", justifyContent: "space-between",
                }}>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>Steuer / Abzüge</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: "var(--red)" }}>
                    {fmtEur(parseFloat(mBrutto||"0") - parseFloat(mNetto||"0"))}
                  </span>
                </div>
              )}

              <div>
                <label className="label">Notiz (optional)</label>
                <input className="input" type="text" value={mNote}
                  onChange={e => setMNote(e.target.value)} placeholder="z.B. Bonus, Sonderzahlung..." />
              </div>

              <button className="btn btn-primary" onClick={() => void saveRecord()} disabled={mSaving || !mBrutto} style={{ width: "100%" }}>
                {mSaving ? "Speichern..." : "💾 Speichern"}
              </button>

              {curRecord && (
                <button onClick={() => void deleteRecord()} style={{
                  width: "100%", padding: 12, background: "transparent",
                  border: "1px solid var(--red)", borderRadius: 12, color: "var(--red)",
                  fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>
                  🗑 Eintrag löschen
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
