"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  calculateMonthlySalary,
  calcNettoFromBrutto,
  calcKrankheitEpisodes,
  ENTGFG_KRANKHEIT_LIMIT_DAYS,
  calcAnnualEntitlement,
  calcUrlaubskonto,
} from "@workly/shared";
import type { TimeEntry, SalarySettings, Steuerklasse, KirchensteuerRate, TaxMode, KrankheitEpisode } from "@workly/shared";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTrackerStore } from "@/store/trackerStore";
import { usePrivacyMode, maskMoney } from "@/lib/privacy";
import { getFeiertage } from "@/lib/utils/feiertage";
import { RecordModal } from "./components/RecordModal";
import { SalaryHeader } from "./components/SalaryHeader";
import { YearlyCharts } from "./components/YearlyCharts";
import { TaxSettingsCard } from "./components/TaxSettingsCard";
import { SettingsCard } from "./components/SettingsCard";
import { MonthBreakdown } from "./components/MonthBreakdown";

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
      <SalaryHeader
        year={year}
        month={month}
        moneyHidden={moneyHidden}
        onYearChange={setYear}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        onTogglePrivacy={togglePrivacy}
      />

      <div style={{ padding: "20px 16px 40px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 960, margin: "0 auto" }}>

        <SettingsCard
          settings={settings}
          onChange={setSettings}
          loading={loading}
          settingsSaved={settingsSaved}
          month={month}
          entriesCount={entries.length}
          totalGross={breakdown.total_gross}
          netto={nettoCalc.netto}
          fmtEur={fmtEur}
          whatIfNettoDelta={whatIfPlusOne.nettoDelta}
        />

        <TaxSettingsCard settings={settings} onChange={setSettings} />

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
            <MonthBreakdown
              year={year}
              month={month}
              settings={settings}
              breakdown={breakdown}
              nettoCalc={nettoCalc}
              urlaubskonto={urlaubskonto}
              krankheitOverLimit={krankheitOverLimit}
              currentMonthNotdienstDays={currentMonthNotdienstDays}
              curRecord={curRecord}
              fmtEur={fmtEur}
              onOpenRecordModal={openRecordModal}
              onJumpToPrevMonthTracker={() => {
                const prevMonth = month === 1 ? 12 : month - 1;
                const prevYear  = month === 1 ? year - 1 : year;
                setTrackerMonth(prevYear, prevMonth);
                router.push("/tracker");
              }}
            />

            <YearlyCharts
              year={year}
              month={month}
              yearlyAuto={yearlyAuto}
              yearlyAutoMax={yearlyAutoMax}
              yearlyAutoBruttoTotal={yearlyAutoBruttoTotal}
              yearlyAutoNettoTotal={yearlyAutoNettoTotal}
              records={records}
              yearlyBrutto={yearlyBrutto}
              yearlyNetto={yearlyNetto}
              yearlyMax={yearlyMax}
              fmtEurNoCents={fmtEurNoCents}
            />
          </>
        )}
      </div>

      <RecordModal
        open={recordModal}
        month={month}
        year={year}
        brutto={mBrutto}
        netto={mNetto}
        note={mNote}
        saving={mSaving}
        hasExistingRecord={!!curRecord}
        fmtEur={fmtEur}
        onClose={() => setRecordModal(false)}
        onBruttoChange={setMBrutto}
        onNettoChange={setMNetto}
        onNoteChange={setMNote}
        onSave={() => void saveRecord()}
        onDelete={() => void deleteRecord()}
      />
    </>
  );
}
