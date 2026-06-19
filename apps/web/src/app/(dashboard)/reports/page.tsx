"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { calculateWorkDuration, formatDuration, DAY_TYPES } from "@workly/shared";
import type { TimeEntry } from "@workly/shared";
import { YearPicker } from "@/components/ui/YearPicker";
import { generateMonthlyReportPDF } from "@/lib/pdf/monthlyReportPdf";
import type { NotdienstEntry, ProfileInfo } from "@/lib/pdf/monthlyReportPdf";
import { getFeiertage } from "@/lib/utils/feiertage";
import { calcMonthStats } from "@/lib/utils/monthStats";

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const MONTHS_SHORT = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
const STANDARD_HOURS_DEFAULT = 174;

export default function ReportsPage() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()+1);
  const [mode, setMode]   = useState<"month"|"year">("month");
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [bundesland, setBundesland] = useState<string>("NI");
  const [targetHours, setTargetHours] = useState<number>(STANDARD_HOURS_DEFAULT);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const start = mode==="month"
        ? `${year}-${String(month).padStart(2,"0")}-01`
        : `${year}-01-01`;
      const end = mode==="month"
        ? new Date(year, month, 0).toISOString().split("T")[0]!
        : `${year}-12-31`;

      const [{ data }, { data: prof }, { data: salary }] = await Promise.all([
        supabase.from("time_entries").select("*")
          .eq("user_id", session.user.id).gte("date", start).lte("date", end),
        supabase.from("profiles").select("bundesland")
          .eq("user_id", session.user.id).maybeSingle(),
        supabase.from("salary_settings").select("monthly_target_hours")
          .eq("user_id", session.user.id).order("created_at", { ascending: false })
          .limit(1).maybeSingle(),
      ]);
      if (data) setEntries(data as TimeEntry[]);
      if (prof?.bundesland) setBundesland(prof.bundesland as string);
      if (salary?.monthly_target_hours) setTargetHours(Number(salary.monthly_target_hours));
      setLoading(false);
    }
    void load();
  }, [year, month, mode]);

  const feiertage = useMemo(() => getFeiertage(year, bundesland), [year, bundesland]);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const stats = useMemo(() => {
    // Year mode → geçmiş yıllar için yıl sonu raporu, mevcut yıl için YTD.
    const useYtd = !(mode === "year" && year < new Date().getFullYear());
    const r = calcMonthStats({
      entries,
      feiertage,
      year,
      month: mode === "month" ? month : null,
      targetHoursPerMonth: targetHours,
      ...(useYtd ? { todayISO } : {}),
    });
    // Geriye uyumluluk için eski isimlere map'le
    return {
      workedMin: r.workedMin,
      ndMin:     r.ndMin,
      diffMin:   r.diffMin,
      urlaub:    r.urlaubDays,
      krank:     r.krankDays,
      feiertag:  r.feiertagDays,
      arbeiten:  r.workDaysInPeriod,
      notdienst: r.ndCount,
    };
  }, [entries, year, month, mode, feiertage, targetHours, todayISO]);

  // Monthly breakdown for year mode
  const monthlyBreakdown = useMemo(() => {
    if (mode==="month") return [];
    return Array.from({length:12}, (_,i) => {
      const m = i+1;
      const me = entries.filter(e => e.date.startsWith(`${year}-${String(m).padStart(2,"0")}`));
      const r = calcMonthStats({ entries: me, feiertage, year, month: m, targetHoursPerMonth: targetHours });
      return {
        month: m,
        workedMin: r.workedMin, ndMin: r.ndMin, diffMin: r.diffMin,
        urlaub: r.urlaubDays, krank: r.krankDays, feiertag: r.feiertagDays,
        arbeiten: r.workDaysInPeriod, notdienst: r.ndCount,
      };
    });
  }, [entries, year, mode, feiertage, targetHours]);

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

  const fmt = (min: number) => formatDuration(Math.round(Math.abs(min)));
  const sign = (min: number) => min>=0?"+":"-";

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

      const [{ data: nd }, { data: prof }] = await Promise.all([
        supabase.from("notdienst_entries")
          .select("date, start_time, end_time, erledigt, kunde, note")
          .eq("user_id", uid).gte("date", startDate).lte("date", endDate),
        supabase.from("profiles")
          .select("vorname, nachname, personal_nr, abteilung, vorgesetzter, email, company_name, firma_strasse, firma_plz, firma_ort, firma_telefon, logo_data, signature_data, bundesland")
          .eq("user_id", uid).maybeSingle(),
      ]);

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
        dur = fmt(calculateWorkDuration(e.start_time, e.end_time, e.break_minutes).net_minutes);
      } else if (
        e.day_type === DAY_TYPES.URLAUB ||
        e.day_type === DAY_TYPES.KRANK ||
        e.day_type === DAY_TYPES.FEIERTAG
      ) {
        dur = "08:00";
      }
      rows.push([e.date, dow, e.day_type, e.start_time??"-", e.end_time??"-",
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
      <div className="page-header">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, gap:8, flexWrap:"wrap" }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Berichte & Export</h1>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={exportCSV} style={{ background:"color-mix(in srgb,var(--green) 15%,transparent)", border:"1px solid var(--green)", color:"var(--green)", padding:"6px 12px", borderRadius:8, cursor:"pointer", fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700 }}>
              ⬇ CSV
            </button>
            {mode==="month" && (
              <button
                onClick={() => void exportPDF()}
                disabled={pdfLoading || loading || entries.length===0}
                style={{
                  background:"color-mix(in srgb,var(--accent2) 15%,transparent)",
                  border:"1px solid var(--accent2)",
                  color:"var(--accent2)",
                  padding:"6px 12px", borderRadius:8,
                  cursor: (pdfLoading || entries.length===0) ? "not-allowed" : "pointer",
                  opacity: (pdfLoading || entries.length===0) ? 0.6 : 1,
                  fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700,
                }}
              >
                {pdfLoading ? "📄 ..." : "📄 Monatsbericht PDF"}
              </button>
            )}
          </div>
        </div>
        {pdfError && (
          <div style={{
            marginBottom:10, padding:"8px 12px",
            background:"color-mix(in srgb, var(--red) 12%, transparent)",
            border:"1px solid color-mix(in srgb, var(--red) 30%, transparent)",
            color:"var(--red)", borderRadius:8, fontSize:11,
          }}>
            ❌ {pdfError}
          </div>
        )}
        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
          {(["month","year"] as const).map(v => (
            <button key={v} onClick={() => setMode(v)} style={{
              flex:1, padding:"8px", borderRadius:10, cursor:"pointer",
              background:mode===v?"var(--accent)":"var(--surface)",
              border:`1px solid ${mode===v?"var(--accent)":"var(--border)"}`,
              color:mode===v?"white":"var(--muted)",
              fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700,
            }}>{v==="month"?"📋 Monat":"📊 Jahr"}</button>
          ))}
        </div>

        {mode==="month" ? (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <label className="label">Jahr</label>
              <select className="input" value={year} onChange={e=>setYear(+e.target.value)} style={{appearance:"none"}}>
                {[2025,2026,2027,2028].map(y=><option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Monat</label>
              <select className="input" value={month} onChange={e=>setMonth(+e.target.value)} style={{appearance:"none"}}>
                {MONTHS.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div>
            <label className="label">Jahr</label>
            <YearPicker value={year} onChange={setYear} />
          </div>
        )}
      </div>

      <div style={{ padding:"16px 16px 40px", maxWidth: 1000, margin: "0 auto" }}>
        {loading ? (
          <div style={{ textAlign:"center", color:"var(--muted)", padding:"40px 0" }}>Laden...</div>
        ) : (
          <>
            {/* Summary cards */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              {[
                { label:"GEARBEITET",  val:fmt(stats.workedMin),  color:"green" },
                { label:"DIFFERENZ",   val:`${sign(stats.diffMin)}${fmt(stats.diffMin)}`, color:stats.diffMin>=0?"blue":"red" },
                { label:"ARBEITSTAGE", val:String(stats.arbeiten), color:"purple" },
                { label:"URLAUB",      val:`${stats.urlaub} Tage`, color:"blue" },
                { label:"KRANK",       val:`${stats.krank} Tage`,  color:"red" },
                { label:"NOTDIENST",   val:`${stats.notdienst}×`,  color:"orange" },
              ].map(c=>(
                <div key={c.label} className={`card ${c.color}`}>
                  <div className="label">{c.label}</div>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:20, fontWeight:500 }}>{c.val}</div>
                </div>
              ))}
            </div>

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
                  if (e?.day_type === DAY_TYPES.ARBEITEN && e.start_time && e.end_time) {
                    dur = fmt(calculateWorkDuration(e.start_time, e.end_time, e.break_minutes).net_minutes);
                  } else if (
                    e?.day_type === DAY_TYPES.URLAUB ||
                    e?.day_type === DAY_TYPES.KRANK ||
                    e?.day_type === DAY_TYPES.FEIERTAG ||
                    (!e && d.isFeiertag)
                  ) {
                    dur = "08:00";
                  }
                  const rowBg = d.isWeekend && !e ? "color-mix(in srgb, var(--muted) 6%, transparent)" : undefined;
                  return (
                    <div key={d.date} className="report-table-row" style={{ padding:"10px 14px", borderBottom:"1px solid var(--surface2)", display:"grid", gridTemplateColumns:"60px 60px 1fr 80px 80px 60px 60px", gap:8, alignItems:"center", fontSize:12, background: rowBg }}>
                      <span style={{ fontFamily:"'DM Mono',monospace", color:"var(--muted)" }}>{d.date.slice(5)}</span>
                      <span style={{ color:"var(--muted)", fontWeight:700 }}>{dow}</span>
                      <span style={{ color:COLOR[typLabel]??"var(--text)", fontWeight:700, textTransform:"capitalize" }}>{typLabel}</span>
                      <span style={{ fontFamily:"'DM Mono',monospace" }}>{e?.start_time ?? "-"}</span>
                      <span style={{ fontFamily:"'DM Mono',monospace" }}>{e?.end_time ?? "-"}</span>
                      <span style={{ fontFamily:"'DM Mono',monospace", color:"var(--muted)" }}>{e ? `${e.break_minutes}m` : "-"}</span>
                      <span style={{ fontFamily:"'DM Mono',monospace", color: dur === "—" ? "var(--muted)" : "var(--green)" }}>{dur}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Year monthly breakdown table */
              <div className="card" style={{ padding:0, overflow:"hidden" }}>
                <div style={{ padding:"12px 14px", borderBottom:"1px solid var(--border)", fontSize:10, color:"var(--muted)", fontWeight:700, display:"grid", gridTemplateColumns:"50px 1fr 60px 50px 40px 40px", gap:8, textTransform:"uppercase" }}>
                  <span>Monat</span><span>Differenz</span><span>Std</span><span>Nd</span><span>Url</span><span>Krank</span>
                </div>
                {monthlyBreakdown.map((s,i) => (
                  <div key={i} style={{ padding:"10px 14px", borderBottom:"1px solid var(--surface2)", display:"grid", gridTemplateColumns:"50px 1fr 60px 50px 40px 40px", gap:8, alignItems:"center", fontSize:12 }}>
                    <span style={{ fontWeight:700 }}>{MONTHS_SHORT[i]}</span>
                    <div style={{ background:"var(--surface2)", borderRadius:3, height:5, overflow:"hidden" }}>
                      <div style={{ width:`${Math.min(100, (Math.abs(s.diffMin)/Math.max(...monthlyBreakdown.map(x=>Math.abs(x.diffMin)),1))*100)}%`, height:"100%", background:s.diffMin>=0?"var(--green)":"var(--red)", borderRadius:3 }} />
                    </div>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"var(--muted)" }}>{fmt(s.workedMin)}</span>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"var(--orange)" }}>{s.notdienst>0?`${s.notdienst}×`:"—"}</span>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"var(--blue)" }}>{s.urlaub>0?`${s.urlaub}T`:"—"}</span>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"var(--red)" }}>{s.krank>0?`${s.krank}T`:"—"}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
