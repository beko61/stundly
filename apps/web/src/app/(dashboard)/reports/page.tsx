"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTimeEntriesRangeQuery } from "@/hooks/queries/useTimeEntries";
import { useNotdienstEntriesQuery } from "@/hooks/queries/useNotdienstEntries";
import { useSalarySettingsQuery } from "@/hooks/queries/useSalarySettings";
import { calculateWorkDuration, DAY_TYPES } from "@workly/shared";
import { formatDur, formatDayMonth } from "@/lib/utils/formatDur";
import type { TimeEntry } from "@workly/shared";
import { YearPicker } from "@/components/ui/YearPicker";
// generateMonthlyReportPDF: dynamic import — ~200KB @react-pdf/renderer + jspdf
// initial bundle'da yer almaz, PDF butonuna basınca yüklenir.
import type { NotdienstEntry, ProfileInfo } from "@/lib/pdf/monthlyReportPdf";
import { getFeiertage } from "@/lib/utils/feiertage";
import {
  calcMonthStats,
  calcOvertimeToDate,
  notdienstYearLoadRange,
  DEFAULT_TARGET_HOURS_PER_MONTH,
  type NdEntry as NdEntryHelper,
} from "@/lib/utils/monthStats";
import { notdienstMonthOf, notdienstBelongsToMonth, notdienstLoadRange, isoWeek } from "@/lib/utils/weekMonth";
import { Skeleton } from "@/components/ui/Skeleton";
import { applyBriefkopf, loadMyBriefkopf } from "@/lib/company/briefkopf";

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const MONTHS_SHORT = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];


interface DonutSlice { value: number; color: string; label: string; }

/** Differenz mit Vorzeichen ("+23h", "−1h 30m") — einheitliches Dauer-Format (formatDur). */
function minsToHM(min: number): string {
  return formatDur(min, true);
}
function minsToHMNoSign(min: number): string {
  return formatDur(Math.abs(min));
}
/** CSV bleibt maschinenlesbar: HH:MM */
function csvHM(min: number): string {
  const abs = Math.abs(Math.round(min));
  return `${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** Anzeige-Zeiten für Urlaub/Krank/Feiertag — identisch mit der Zeiterfassung (DayEntry). */
const STANDARD_TIMES = { start: "08:00", end: "17:00", pauseMin: 60 };

function ReportDonut({ arbeitenDays, urlaubDays, krankDays, feiertagDays }: {
  arbeitenDays: number; urlaubDays: number; krankDays: number; feiertagDays: number;
}) {
  const slices: DonutSlice[] = [
    { value: arbeitenDays, color: "var(--green)",  label: "Arbeiten" },
    { value: urlaubDays,   color: "var(--blue)",   label: "Urlaub"   },
    { value: krankDays,    color: "var(--red)",    label: "Krank"    },
    { value: feiertagDays, color: "var(--yellow)", label: "Feiertag" },
  ];
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  const r = 56, cx = 70, cy = 70, stroke = 18;
  const circ = 2 * Math.PI * r;

  if (total === 0) {
    return (
      <div style={{ display:"flex", alignItems:"center", gap:18, flexWrap:"wrap" }}>
        <svg width={cx*2} height={cy*2}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface2)" strokeWidth={stroke}/>
        </svg>
        <div style={{ color:"var(--muted)", fontSize:12 }}>Noch keine Daten in diesem Jahr.</div>
      </div>
    );
  }

  let offset = 0;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:22, flexWrap:"wrap" }}>
      <div style={{ position:"relative", flexShrink:0 }}>
        <svg width={cx*2} height={cy*2} style={{ transform:"rotate(-90deg)" }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface2)" strokeWidth={stroke}/>
          {slices.filter(s => s.value > 0).map((s, i) => {
            const dash = (s.value / total) * circ;
            const el = (
              <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                stroke={s.color} strokeWidth={stroke}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div style={{
          position:"absolute", inset:0,
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          pointerEvents:"none",
        }}>
          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:22, fontWeight:700, color:"var(--text)", lineHeight:1 }}>{total}</span>
          <span style={{ fontSize:10, color:"var(--muted)", fontWeight:700, marginTop:2, textTransform:"uppercase", letterSpacing:"0.08em" }}>Tage</span>
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:8, flex:1, minWidth:160 }}>
        {slices.map(s => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={s.label} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:10, height:10, borderRadius:3, background:s.color, flexShrink:0 }}/>
                <span style={{ fontSize:12, color:"var(--text)", fontWeight:600 }}>{s.label}</span>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"baseline" }}>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:700, color:s.color }}>{s.value}T</span>
                <span style={{ fontSize:10, color:"var(--muted)" }}>{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()+1);
  const [mode, setMode]   = useState<"month"|"year">("month");
  const [bundesland, setBundesland] = useState<string>("NI");

  // Date range — month veya year mode
  const { start, end } = useMemo(() => {
    if (mode === "month") {
      // Ay sonu lokal hesaplanır — toISOString() UTC'ye çevirip Almanya'da 1 gün geri kaydırıyordu
      // (30.09 → "09-29", ayın son günü hiç yüklenmiyordu).
      const lastDay = new Date(year, month, 0).getDate();
      return {
        start: `${year}-${String(month).padStart(2,"0")}-01`,
        end:   `${year}-${String(month).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`,
      };
    }
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }, [year, month, mode]);

  // Notdienst ±1 hafta pay ile (hafta-Pazar atfı) — aşağıda aya/yıla filtrelenir.
  // Eskiden month mode'da sadece ayın tarihleri çekiliyordu → önceki ayda başlayıp
  // bu aya atfedilen haftanın Notdienst'leri eksik kalıyordu.
  const ndLoad = useMemo(
    () => (mode === "month" ? notdienstLoadRange(year, month) : notdienstYearLoadRange(year)),
    [year, month, mode],
  );

  // RQ hooks — time_entries + notdienst_entries + salary_settings
  const { data: entriesRaw = [], isLoading: lEntries } = useTimeEntriesRangeQuery(start, end);
  const { data: ndRaw      = [], isLoading: lNd }      = useNotdienstEntriesQuery(ndLoad.start, ndLoad.end);
  const { data: salaryData }                            = useSalarySettingsQuery();

  const loading = lEntries || lNd;
  const entries = entriesRaw as TimeEntry[];

  // Notdienst filter — hafta bu aya/yıla düşenler
  const ndEntries = useMemo(
    () => (ndRaw as Array<{ date: string; start_time: string | null; end_time: string | null; erledigt?: boolean | null; kunde?: string | null; note?: string | null }>)
      .filter(n => {
        const m = notdienstMonthOf(n.date);
        if (mode === "year") return m.year === year;
        return m.year === year && m.month === month;
      }) as Array<NdEntryHelper & { kunde?: string | null; note?: string | null }>,
    [ndRaw, mode, year, month],
  );

  const targetHours = salaryData?.monthly_target_hours ? Number(salaryData.monthly_target_hours) : DEFAULT_TARGET_HOURS_PER_MONTH;
  const vacTotal    = salaryData?.urlaub_anspruch     ? Number(salaryData.urlaub_anspruch)     : 30;

  // Profile bundesland — direct supabase (single fetch, no hook)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase.from("profiles")
        .select("bundesland")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!cancelled && data?.bundesland) setBundesland(data.bundesland as string);
    })();
    return () => { cancelled = true; };
  }, []);

  const feiertage = useMemo(() => getFeiertage(year, bundesland), [year, bundesland]);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const stats = useMemo(() => {
    // Month mode YTD'siz (tek ay zaten dar). Year mode tüm yıl özeti — "1 sene ne yaptın".
    const r = calcMonthStats({
      entries,
      ndEntries,
      feiertage,
      year,
      month: mode === "month" ? month : null,
      targetHoursPerMonth: targetHours,
    });
    return {
      workedMin:      r.workedMin,
      workedMinPure:  r.workedMinPure,
      paidAbsenceMin: r.paidAbsenceMin,
      ndMin:          r.ndMin,
      ndPaid:         r.ndPaid,
      targetMin:      r.targetMin,
      diffMin:        r.diffMin,
      urlaub:         r.urlaubDays,
      krank:          r.krankDays,
      krankMin:       r.krankMin,
      feiertag:       r.feiertagDays,
      arbeitenDays:   r.arbeitenEntries,
      workDaysInPeriod: r.workDaysInPeriod,
      notdienst:      r.ndCount,
    };
  }, [entries, ndEntries, year, month, mode, feiertage, targetHours]);

  // "Gesamt Überstunden" — bis heute, identisch mit der Urlaub-Seite (calcOvertimeToDate).
  // Der restliche Jahresbericht (Soll, Differenz, Tabelle) bleibt das ganze Jahr.
  const overtimeToDate = useMemo(() => {
    if (mode !== "year") return null;
    return calcOvertimeToDate({
      entries, ndEntries: ndRaw as NdEntryHelper[], feiertage, year,
      targetHoursPerMonth: targetHours, todayISO,
    });
  }, [mode, entries, ndRaw, feiertage, year, targetHours, todayISO]);

  // Year mode'da Notdienst'leri (ay, KW) bazında grupla — açılır kapanır detay için
  const ndByWeek = useMemo(() => {
    if (mode !== "year") return [];
    interface WeekGroup {
      month: number;          // ait olduğu ay (hafta Pazar atfı)
      kw:    number;          // ISO Kalenderwoche
      count: number;
      mins:  number;
      paid:  number;          // erledigt=true sayısı
      items: Array<{ date: string; start: string; end: string; mins: number; erledigt: boolean; kunde?: string | null }>;
    }
    const m = new Map<string, WeekGroup>();
    for (const nd of ndEntries) {
      const w = notdienstMonthOf(nd.date);
      const kw = isoWeek(nd.date);
      const key = `${w.month}-${kw}`;
      const mins = calculateWorkDuration(nd.start_time as string, nd.end_time as string, 0).net_minutes;
      const existing = m.get(key) ?? { month: w.month, kw, count: 0, mins: 0, paid: 0, items: [] };
      existing.count++;
      existing.mins += mins;
      if (nd.erledigt) existing.paid++;
      existing.items.push({
        date:     nd.date,
        start:    nd.start_time as string,
        end:      nd.end_time as string,
        mins,
        erledigt: Boolean(nd.erledigt),
        kunde:    nd.kunde ?? null,
      });
      m.set(key, existing);
    }
    return Array.from(m.values()).sort((a, b) => a.month - b.month || a.kw - b.kw);
  }, [ndEntries, mode]);

  // Monthly breakdown for year mode (hafta-Pazar atfı ile)
  const monthlyBreakdown = useMemo(() => {
    if (mode==="month") return [];
    return Array.from({length:12}, (_,i) => {
      const m = i+1;
      const me = entries.filter(e => e.date.startsWith(`${year}-${String(m).padStart(2,"0")}`));
      const mNd = ndEntries.filter(n => {
        const w = notdienstMonthOf(n.date);
        return w.year === year && w.month === m;
      });
      const r = calcMonthStats({ entries: me, ndEntries: mNd, feiertage, year, month: m, targetHoursPerMonth: targetHours });
      return {
        month: m,
        workedMin:     r.workedMin,
        workedMinPure: r.workedMinPure,
        ndMin:         r.ndMin,
        targetMin:     r.targetMin,
        diffMin:       r.diffMin,
        urlaub:        r.urlaubDays,
        krank:         r.krankDays,
        feiertag:      r.feiertagDays,
        arbeitenDays:  r.arbeitenEntries,
        workDaysInPeriod: r.workDaysInPeriod,
        notdienst:     r.ndCount,
      };
    });
  }, [entries, ndEntries, year, mode, feiertage, targetHours]);

  // Tüm ay günleri (month mode için)
  const monthDays = useMemo(() => {
    if (mode !== "month") return [];
    const daysInMonth = new Date(year, month, 0).getDate();
    const entryMap = new Map(entries.map(e => [e.date, e]));
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const iso = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const dow = new Date(year, month - 1, d).getDay();
      return {
        date: iso,
        dow,
        isWeekend: dow === 0 || dow === 6,
        isFeiertag: !!feiertage[iso],
        entry: entryMap.get(iso),
      };
    });
  }, [entries, year, month, mode, feiertage]);

  const fmt = (min: number) => formatDur(Math.abs(min));

  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError]     = useState<string | null>(null);

  /** Aylık Monatsbericht PDF — seçili year+month için. */
  async function exportPDF() {
    setPdfError(null);
    setPdfLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setPdfLoading(false); return; }
      const uid = session.user.id;

      const startDate = `${year}-${String(month).padStart(2,"0")}-01`;
      const daysInMonth = new Date(year, month, 0).getDate();
      const endDate   = `${year}-${String(month).padStart(2,"0")}-${String(daysInMonth).padStart(2,"0")}`;

      // Notdienst: hafta-Pazar-ay-atfı için ±7 gün pay ile çek, sonra filter
      const ndRange = notdienstLoadRange(year, month);

      const [{ data: ndRaw }, { data: profRaw }, briefkopf] = await Promise.all([
        supabase.from("notdienst_entries")
          .select("date, start_time, end_time, erledigt, kunde, note")
          .eq("user_id", uid).gte("date", ndRange.start).lte("date", ndRange.end),
        supabase.from("profiles")
          .select("vorname, nachname, personal_nr, abteilung, vorgesetzter, email, company_name, firma_strasse, firma_plz, firma_ort, firma_telefon, logo_data, signature_data, bundesland")
          .eq("user_id", uid).maybeSingle(),
        loadMyBriefkopf(supabase),
      ]);
      // Firmen-Mitarbeiter: Briefkopf kommt von der Firma (Chef pflegt ihn)
      const prof = profRaw ? applyBriefkopf(profRaw, briefkopf) : profRaw;
      const nd = (ndRaw ?? []).filter(n => notdienstBelongsToMonth(n.date, year, month));

      const notdienst: NotdienstEntry[] = (nd ?? []).map((n) => ({
        date:       n.date as string,
        start_time: n.start_time as string,
        end_time:   n.end_time as string,
        erledigt:   Boolean((n as { erledigt?: boolean }).erledigt),
        kunde:      (n as { kunde?: string | null }).kunde ?? null,
        note:       (n as { note?: string | null }).note ?? null,
      }));
      const profile: ProfileInfo = {
        company_name: (prof?.company_name as string | null) ?? "Stundly",
        logo_data:    (prof?.logo_data as string | null) ?? null,
        signature_data: (prof?.signature_data as string | null) ?? null,
      };
      // Mitarbeiter alanları
      if (prof?.vorname)      profile.vorname      = prof.vorname as string;
      if (prof?.nachname)     profile.nachname     = prof.nachname as string;
      if (prof?.personal_nr)  profile.personal_nr  = prof.personal_nr as string;
      if (prof?.abteilung)    profile.abteilung    = prof.abteilung as string;
      if (prof?.vorgesetzter) profile.vorgesetzter = prof.vorgesetzter as string;
      // Firma alanları
      if (prof?.firma_strasse) profile.firma_strasse = prof.firma_strasse as string;
      if (prof?.firma_plz)     profile.firma_plz     = prof.firma_plz as string;
      if (prof?.firma_ort)     profile.firma_ort     = prof.firma_ort as string;
      if (prof?.firma_telefon) profile.firma_telefon = prof.firma_telefon as string;
      if (prof?.email)         profile.company_email = prof.email as string;

      const feiertage = getFeiertage(year, (prof?.bundesland as string | null) ?? "NI");
      // Lazy load PDF module (~200KB) — sadece butona basınca
      const { generateMonthlyReportPDF } = await import("@/lib/pdf/monthlyReportPdf");
      await generateMonthlyReportPDF({ year, month, entries, notdienst, feiertage, profile });
    } catch (err) {
      console.error("PDF Error:", err);
      setPdfError("PDF konnte nicht erstellt werden: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setPdfLoading(false);
    }
  }

  function exportCSV() {
    const rows = [["Datum","Tag","Typ","Start","Ende","Pause","Stunden","Notiz"]];
    for (const e of entries) {
      const d = new Date(e.date);
      const dow = ["So","Mo","Di","Mi","Do","Fr","Sa"][d.getDay()]!;
      let dur = "";
      if (e.start_time && e.end_time) {
        dur = csvHM(calculateWorkDuration(e.start_time, e.end_time, e.break_minutes).net_minutes);
      } else if (
        e.day_type === DAY_TYPES.URLAUB ||
        e.day_type === DAY_TYPES.KRANK ||
        e.day_type === DAY_TYPES.FEIERTAG
      ) {
        dur = "08:00";
      }
      rows.push([e.date, dow, e.day_type, e.start_time?.slice(0, 5) ?? "-", e.end_time?.slice(0, 5) ?? "-",
        String(e.break_minutes), dur, e.note??""]);
    }
    const csv = rows.map(r=>r.map(v=>`"${v}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff"+csv], { type:"text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const suffix = mode === "month" ? "_" + String(month).padStart(2, "0") : "";
    a.download = `workly_${year}${suffix}.csv`;
    a.click();
  }

  return (
    <>
      <div className="page-header page-header-contained">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, gap:10, flexWrap:"wrap" }}>
          <h1>Berichte & Export</h1>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button onClick={exportCSV} className="btn btn-secondary">
              ⬇ CSV
            </button>
            {mode==="month" && (
              <button
                onClick={() => void exportPDF()}
                disabled={pdfLoading || loading || entries.length===0}
                className="btn btn-primary"
                style={{
                  cursor: (pdfLoading || entries.length===0) ? "not-allowed" : "pointer",
                  opacity: (pdfLoading || entries.length===0) ? 0.6 : 1,
                }}
              >
                {pdfLoading ? "📄 Wird erstellt…" : "📄 Monatsbericht PDF"}
              </button>
            )}
          </div>
        </div>
        {pdfError && (
          <div style={{
            marginBottom:10, padding:"8px 12px",
            background:"color-mix(in srgb, var(--red) 12%, transparent)",
            border:"1px solid color-mix(in srgb, var(--red) 30%, transparent)",
            color:"var(--red)", borderRadius:8, fontSize:12,
          }}>
            ❌ {pdfError}
          </div>
        )}
        {/* Filter in einer Zeile: Ansicht (Monat/Jahr) · Jahr · Monat */}
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          <div role="tablist" aria-label="Ansicht" style={{ display:"flex", gap:4, padding:4, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12 }}>
            {(["month","year"] as const).map(v => (
              <button key={v} role="tab" aria-selected={mode===v} onClick={() => setMode(v)} style={{
                padding:"8px 16px", minHeight:36, borderRadius:9, cursor:"pointer", border:"none",
                background:mode===v?"var(--accent)":"transparent",
                color:mode===v?"white":"var(--muted)",
                fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700,
              }}>{v==="month"?"📋 Monat":"📊 Jahr"}</button>
            ))}
          </div>

          {mode==="month" ? (
            <>
              <select className="input" aria-label="Jahr" value={year} onChange={e=>setYear(+e.target.value)} style={{ width:"auto", minWidth:110 }}>
                {[2025,2026,2027,2028].map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <select className="input" aria-label="Monat" value={month} onChange={e=>setMonth(+e.target.value)} style={{ width:"auto", minWidth:150 }}>
                {MONTHS.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </>
          ) : (
            <div style={{ minWidth:200 }}>
              <YearPicker value={year} onChange={setYear} />
            </div>
          )}
        </div>
      </div>

      <div style={{ padding:"16px 16px 40px", maxWidth: 960, margin: "0 auto" }}>
        {loading ? (
          <div
            role="status"
            aria-label="Bericht wird geladen"
            style={{ display: "flex", flexDirection: "column", gap: 12, padding: "6px 0" }}
          >
            <Skeleton fullWidth height={140} radius={12} />
            <Skeleton fullWidth height={220} radius={12} />
          </div>
        ) : (
          <>
            {/* Hero kartlar — sadece year mode */}
            {mode === "year" && (() => {
              const gesamtUeber = overtimeToDate?.diffMin ?? 0;  // bis heute: (worked + nd) − soll
              const ueberTage = gesamtUeber / 60 / 8;
              const bisLabel = todayISO.startsWith(`${year}-`)
                ? `bis heute (${todayISO.slice(8, 10)}.${todayISO.slice(5, 7)}.)`
                : `Jahr ${year}`;
              const ndStunden = stats.ndMin / 60;
              const ndTage = ndStunden / 8;
              return (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
                  {/* Gesamt Überstunden */}
                  <div className="card" style={{
                    padding:"16px 18px",
                    background: gesamtUeber >= 0
                      ? "color-mix(in srgb, var(--blue) 10%, transparent)"
                      : "color-mix(in srgb, var(--red) 10%, transparent)",
                    border: `1px solid ${gesamtUeber >= 0
                      ? "color-mix(in srgb, var(--blue) 35%, transparent)"
                      : "color-mix(in srgb, var(--red) 35%, transparent)"}`,
                  }}>
                    <div style={{ fontSize:10, color:"var(--muted)", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>
                      ⏱ Gesamt Überstunden
                    </div>
                    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:26, fontWeight:800, color: gesamtUeber >= 0 ? "var(--blue)" : "var(--red)" }}>
                      {minsToHM(gesamtUeber)}
                    </div>
                    <div style={{ fontSize:11, color:"var(--muted)", marginTop:4 }}>
                      {bisLabel} · ≈ {gesamtUeber >= 0 ? "+" : ""}{ueberTage.toFixed(1)} Tage à 8 Std/Tag
                    </div>
                  </div>

                  {/* Notdienst */}
                  <div className="card" style={{
                    padding:"16px 18px",
                    background:"color-mix(in srgb, var(--orange) 10%, transparent)",
                    border:"1px solid color-mix(in srgb, var(--orange) 35%, transparent)",
                  }}>
                    <div style={{ fontSize:10, color:"var(--muted)", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>
                      🚨 Notdienst
                    </div>
                    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:26, fontWeight:800, color:"var(--orange)" }}>
                      +{minsToHMNoSign(stats.ndMin)}
                    </div>
                    <div style={{ fontSize:11, color:"var(--muted)", marginTop:4 }}>
                      ≈ {ndTage.toFixed(1)} Tage · {stats.notdienst} Einsätze
                      {stats.notdienst > 0 && (
                        <> · <span style={{ color:"var(--green)" }}>✅ {stats.ndPaid}</span> <span style={{ color:"var(--red)" }}>❌ {stats.notdienst - stats.ndPaid}</span></>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* KPI Cards — Gearbeitet (pure arbeiten), Soll, Differenz, Arbeitstage */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              {[
                { label:"GEARBEITET",  val:fmt(stats.workedMinPure), color:"green",  hint:`Soll: ${fmt(stats.targetMin)}` },
                // Differenz = Gearbeitet + bezahlte Abwesenheit (Urlaub/Krank/Feiertag) + Notdienst − Soll
                { label:"DIFFERENZ",   val:formatDur(stats.diffMin, true), color:stats.diffMin>=0?"blue":"red",
                  hint:`${fmt(stats.workedMinPure)} + ${fmt(stats.paidAbsenceMin)} Urlaub/Krank/Feiertag + ${fmt(stats.ndMin)} Notdienst − ${fmt(stats.targetMin)} Soll${mode === "year" ? " (ganzes Jahr)" : ""}` },
                { label:"ARBEITSTAGE", val:`${stats.arbeitenDays} / ${stats.workDaysInPeriod}`, color:"purple", hint:"Erfasst / Werktage" },
                { label:"URLAUB",      val:`${stats.urlaub} T`, color:"blue", hint:mode === "year" ? `Rest ${Math.max(0, vacTotal - stats.urlaub)}/${vacTotal}` : "Tage" },
              ].map(c=>(
                <div key={c.label} className={`card ${c.color}`}>
                  <div className="label">{c.label}</div>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:20, fontWeight:500 }}>{c.val}</div>
                  <div style={{ fontSize:12, color:"var(--muted)", marginTop:4, lineHeight:1.4 }}>{c.hint}</div>
                </div>
              ))}
            </div>

            {/* Abwesenheit Zeile — gleiche Optik wie die KPI-Karten */}
            <div className="card" style={{ padding:"14px 16px", marginBottom:14, display:"grid", gridTemplateColumns:`repeat(${mode === "month" ? 3 : 2}, 1fr)`, gap:12 }}>
              {[
                { label:"🤒 Krank",    color:"var(--red)",    val:`${stats.krank} T`,    sub: stats.krankMin > 0 ? fmt(stats.krankMin) : null },
                { label:"🎉 Feiertag", color:"var(--yellow)", val:`${stats.feiertag} T`, sub: stats.feiertag > 0 ? fmt(stats.feiertag * 8 * 60) : null },
                ...(mode === "month"
                  ? [{ label:"🚨 Notdienst", color:"var(--orange)", val:`${stats.notdienst}×`, sub: stats.ndMin > 0 ? fmt(stats.ndMin) : null }]
                  : []),
              ].map(x => (
                <div key={x.label} style={{ textAlign:"center" }}>
                  <div className="label" style={{ color:x.color, marginBottom:4 }}>{x.label}</div>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:20, fontWeight:500 }}>{x.val}</div>
                  {x.sub && <div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>{x.sub}</div>}
                </div>
              ))}
            </div>

            {/* Year mode — Donut chart for visual year overview */}
            {mode === "year" && (
              <div className="card" style={{ padding:"18px 16px", marginBottom:14 }}>
                <div style={{ fontSize:10, color:"var(--muted)", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12 }}>
                  Jahresübersicht — Tag-Verteilung
                </div>
                <ReportDonut
                  arbeitenDays={stats.arbeitenDays}
                  urlaubDays={stats.urlaub}
                  krankDays={stats.krank}
                  feiertagDays={stats.feiertag}
                />
              </div>
            )}

            {/* Year mode — Notdienst aylık dağılım (chip satırı) */}
            {mode === "year" && stats.notdienst > 0 && (
              <div className="card" style={{ padding:"14px 16px", marginBottom:14 }}>
                <div style={{ fontSize:10, color:"var(--muted)", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10, display:"flex", justifyContent:"space-between" }}>
                  <span>🚨 Notdienst pro Monat</span>
                  <span style={{ color:"var(--muted)", fontWeight:600, textTransform:"none", letterSpacing:0 }}>
                    Ø {(stats.notdienst > 0 ? (stats.ndMin / 60 / stats.notdienst) : 0).toFixed(1)}h / Einsatz
                  </span>
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {monthlyBreakdown.filter(m => m.notdienst > 0).map(m => (
                    <div key={m.month} style={{
                      padding:"6px 10px",
                      background:"color-mix(in srgb, var(--orange) 12%, transparent)",
                      border:"1px solid color-mix(in srgb, var(--orange) 28%, transparent)",
                      borderRadius:8, fontSize:11, display:"flex", gap:6, alignItems:"baseline",
                    }}>
                      <span style={{ fontWeight:700, color:"var(--text)" }}>{MONTHS_SHORT[m.month - 1]}</span>
                      <span style={{ color:"var(--orange)", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>
                        {m.notdienst}× {minsToHMNoSign(m.ndMin)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Year mode — Notdienst KW Detay (açılır kapanır) */}
            {mode === "year" && ndByWeek.length > 0 && (
              <details className="card" style={{ padding:0, marginBottom:14, overflow:"hidden" }}>
                <summary style={{
                  padding:"14px 16px",
                  cursor:"pointer",
                  fontSize:12,
                  fontWeight:700,
                  color:"var(--text)",
                  display:"flex", justifyContent:"space-between", alignItems:"center",
                  listStyle:"none",
                  userSelect:"none",
                }}>
                  <span>🚨 Notdienst-Details · {ndByWeek.length} Wochen</span>
                  <span style={{ fontSize:10, color:"var(--muted)", fontWeight:600 }}>▼ Klicken</span>
                </summary>
                <div style={{ borderTop:"1px solid var(--border)" }}>
                  {/* Table header */}
                  <div style={{ padding:"10px 16px", fontSize:10, color:"var(--muted)", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", display:"grid", gridTemplateColumns:"50px 60px 1fr 80px", gap:8 }}>
                    <span>Monat</span><span>KW</span><span>Nd</span><span style={{ textAlign:"right" }}>Überstd</span>
                  </div>
                  {ndByWeek.map(w => (
                    <details key={`${w.month}-${w.kw}`} style={{ borderTop:"1px solid var(--surface2)" }}>
                      <summary style={{
                        padding:"10px 16px",
                        display:"grid", gridTemplateColumns:"50px 60px 1fr 80px", gap:8,
                        fontSize:12, alignItems:"center", cursor:"pointer", listStyle:"none",
                      }}>
                        <span style={{ fontWeight:700 }}>{MONTHS_SHORT[w.month - 1]}</span>
                        <span style={{ color:"var(--muted)", fontSize:11 }}>KW {w.kw}</span>
                        <span style={{ color:"var(--orange)", fontFamily:"'DM Mono',monospace", fontSize:11 }}>
                          {w.count}× {minsToHMNoSign(w.mins)}
                        </span>
                        <span style={{ color:"var(--orange)", fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:12, textAlign:"right" }}>
                          +{minsToHMNoSign(w.mins)}
                        </span>
                      </summary>
                      {/* Hafta içi tek tek nd entry'leri */}
                      <div style={{ padding:"4px 16px 10px", display:"flex", flexDirection:"column", gap:4 }}>
                        {w.items.map((it, idx) => (
                          <div key={idx} style={{
                            display:"grid", gridTemplateColumns:"110px 60px 60px 1fr 60px", gap:6,
                            fontSize:11, padding:"4px 8px", borderRadius:6,
                            background:"color-mix(in srgb, var(--orange) 6%, transparent)",
                            alignItems:"center",
                          }}>
                            <span style={{ fontFamily:"'DM Mono',monospace", color:"var(--muted)" }}>
                              {new Date(it.date).toLocaleDateString("de-DE", { weekday:"short", day:"2-digit", month:"2-digit" })}
                            </span>
                            <span style={{ fontFamily:"'DM Mono',monospace" }}>{it.start}</span>
                            <span style={{ fontFamily:"'DM Mono',monospace" }}>{it.end}</span>
                            <span style={{ color:"var(--muted)", fontSize:10, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {it.kunde ?? ""}
                            </span>
                            <span style={{ fontFamily:"'DM Mono',monospace", color:"var(--orange)", fontWeight:700, textAlign:"right" }}>
                              {minsToHMNoSign(it.mins)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            )}

            {mode==="month" ? (
              /* Day list table — tüm ay günleri */
              <div className="card" style={{ padding:0, overflow:"hidden" }}>
                <div className="report-table-header" style={{ padding:"12px 14px", borderBottom:"1px solid var(--border)", fontSize:10, color:"var(--muted)", fontWeight:700, display:"grid", gridTemplateColumns:"60px 60px 1fr 80px 80px 60px 60px", gap:8, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                  <span>Datum</span><span>Tag</span><span>Typ</span><span>Start</span><span>Ende</span><span>Pause</span><span>Std</span>
                </div>
                {monthDays.map(d => {
                  const dow = ["So","Mo","Di","Mi","Do","Fr","Sa"][d.dow]!;
                  const e = d.entry;
                  const typLabel = e
                    ? e.day_type
                    : d.isFeiertag ? "feiertag"
                    : d.isWeekend ? "wochenende"
                    : "frei";
                  const COLOR: Record<string,string> = {
                    arbeiten:"var(--green)", urlaub:"var(--blue)", krank:"var(--red)",
                    notdienst:"var(--orange)", feiertag:"var(--yellow)",
                    frei:"var(--muted)", wochenende:"var(--muted)",
                  };
                  let dur = "—";
                  // Urlaub/Krank/Feiertag: Standardzeiten gedimmt anzeigen — wie in der Zeiterfassung
                  const paidAbsence =
                    e?.day_type === DAY_TYPES.URLAUB ||
                    e?.day_type === DAY_TYPES.KRANK ||
                    e?.day_type === DAY_TYPES.FEIERTAG ||
                    (!e && d.isFeiertag);
                  const workday = d.dow !== 0 && d.dow !== 6;
                  if (e?.day_type === DAY_TYPES.ARBEITEN && e.start_time && e.end_time) {
                    dur = fmt(calculateWorkDuration(e.start_time, e.end_time, e.break_minutes).net_minutes);
                  } else if (paidAbsence && workday) {
                    dur = fmt(8 * 60);
                  }
                  const std = paidAbsence && workday && !e?.start_time;
                  const startTxt = e?.start_time ? e.start_time.slice(0, 5) : std ? STANDARD_TIMES.start : "–";
                  const endTxt   = e?.end_time   ? e.end_time.slice(0, 5)   : std ? STANDARD_TIMES.end   : "–";
                  const pauseTxt = e?.start_time ? fmt(e.break_minutes) : std ? fmt(STANDARD_TIMES.pauseMin) : "–";
                  const timeColor = std ? "var(--muted)" : "var(--text)";
                  const rowBg = d.isWeekend && !e ? "color-mix(in srgb, var(--muted) 6%, transparent)" : undefined;
                  return (
                    <div key={d.date} className="report-table-row" style={{ padding:"10px 14px", borderBottom:"1px solid var(--surface2)", display:"grid", gridTemplateColumns:"60px 60px 1fr 80px 80px 60px 60px", gap:8, alignItems:"center", fontSize:12, background: rowBg }}>
                      <span style={{ fontFamily:"'DM Mono',monospace", color:"var(--muted)" }}>{formatDayMonth(d.date)}</span>
                      <span style={{ color:"var(--muted)", fontWeight:700 }}>{dow}</span>
                      <span style={{ color:COLOR[typLabel]??"var(--text)", fontWeight:700, textTransform:"capitalize" }}>{typLabel}</span>
                      <span style={{ fontFamily:"'DM Mono',monospace", color:timeColor }}>{startTxt}</span>
                      <span style={{ fontFamily:"'DM Mono',monospace", color:timeColor }}>{endTxt}</span>
                      <span style={{ fontFamily:"'DM Mono',monospace", color:"var(--muted)" }}>{pauseTxt}</span>
                      <span style={{ fontFamily:"'DM Mono',monospace", color: dur === "—" ? "var(--muted)" : "var(--green)" }}>{dur}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Year monthly breakdown — detaylı kart listesi, tıklanabilir */
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ fontSize:10, color:"var(--muted)", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4, paddingLeft:4 }}>
                  📋 Monatsdetail · Zeile anklicken zum Springen 👇
                </div>
                {monthlyBreakdown.map((s, i) => {
                  const diffPlusNd = s.diffMin;
                  const m = i + 1;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setMode("month"); setMonth(m); }}
                      className="card"
                      style={{
                        padding:"12px 14px", textAlign:"left", cursor:"pointer",
                        border:"1px solid var(--border)", background:"var(--surface)",
                        display:"flex", flexDirection:"column", gap:8,
                      }}
                    >
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                          <span style={{ fontWeight:800, fontSize:14, minWidth:36 }}>{MONTHS_SHORT[i]}</span>
                          {s.urlaub > 0 && (
                            <span style={{ fontSize:11, color:"var(--blue)", fontWeight:700 }}>🏖 {s.urlaub}T</span>
                          )}
                          {s.krank > 0 && (
                            <span style={{ fontSize:11, color:"var(--red)", fontWeight:700 }}>🤒 {s.krank}T</span>
                          )}
                          {s.feiertag > 0 && (
                            <span style={{ fontSize:11, color:"var(--yellow)", fontWeight:700 }}>🎉 {s.feiertag}T</span>
                          )}
                          {s.notdienst > 0 && (
                            <span style={{ fontSize:11, color:"var(--orange)", fontWeight:700, fontFamily:"'DM Mono',monospace" }}>
                              🚨 {minsToHMNoSign(s.ndMin)}
                            </span>
                          )}
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:700, color: diffPlusNd >= 0 ? "var(--blue)" : "var(--red)" }}>
                            {minsToHM(diffPlusNd)}
                          </div>
                          {s.ndMin > 0 && (
                            <div style={{ fontSize:10, color:"var(--muted)", marginTop:1 }}>
                              Σ Diff+Nd
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:11, color:"var(--muted)" }}>
                        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                          <span style={{ fontFamily:"'DM Mono',monospace", color:"var(--green)", fontWeight:700 }}>
                            {minsToHMNoSign(s.workedMinPure)}
                          </span>
                          <span>/</span>
                          <span style={{ fontFamily:"'DM Mono',monospace" }}>
                            {minsToHMNoSign(s.targetMin)} Std
                          </span>
                        </div>
                        <div>
                          {s.arbeitenDays} / {s.workDaysInPeriod} Arbeitstage
                        </div>
                      </div>
                      <div style={{ background:"var(--surface2)", borderRadius:3, height:4, overflow:"hidden" }}>
                        <div style={{
                          width:`${Math.min(100, (Math.abs(diffPlusNd)/Math.max(...monthlyBreakdown.map(x=>Math.abs(x.diffMin)),1))*100)}%`,
                          height:"100%",
                          background: diffPlusNd >= 0 ? "var(--blue)" : "var(--red)",
                          borderRadius:3,
                        }}/>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
