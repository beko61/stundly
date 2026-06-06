"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { calculateWorkDuration, formatDuration, DAY_TYPES } from "@workly/shared";
import type { TimeEntry } from "@workly/shared";
import { YearPicker } from "@/components/ui/YearPicker";

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const MONTHS_SHORT = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
const STANDARD_HOURS = 174;

function calcStats(entries: TimeEntry[]) {
  let workedMin = 0, ndMin = 0;
  let urlaub=0, krank=0, feiertag=0, arbeiten=0, notdienst=0;
  for (const e of entries) {
    if (e.day_type===DAY_TYPES.URLAUB)    { urlaub++;    workedMin+=8*60; }
    if (e.day_type===DAY_TYPES.KRANK)     { krank++;     workedMin+=8*60; }
    if (e.day_type===DAY_TYPES.FEIERTAG)  { feiertag++;  workedMin+=8*60; }
    if (e.day_type===DAY_TYPES.ARBEITEN)  arbeiten++;
    if (e.day_type===DAY_TYPES.NOTDIENST) notdienst++;
    if (!e.start_time||!e.end_time) continue;
    const { net_minutes } = calculateWorkDuration(e.start_time, e.end_time, e.break_minutes);
    if (e.day_type===DAY_TYPES.NOTDIENST) ndMin+=net_minutes;
    else if (e.day_type===DAY_TYPES.ARBEITEN) workedMin+=net_minutes;
  }
  return { workedMin, ndMin, diffMin: workedMin-(STANDARD_HOURS*60), urlaub, krank, feiertag, arbeiten, notdienst };
}

export default function ReportsPage() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()+1);
  const [mode, setMode]   = useState<"month"|"year">("month");
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);

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

      const { data } = await supabase.from("time_entries").select("*")
        .eq("user_id", session.user.id).gte("date", start).lte("date", end);
      if (data) setEntries(data as TimeEntry[]);
      setLoading(false);
    }
    void load();
  }, [year, month, mode]);

  const stats = useMemo(() => calcStats(entries), [entries]);

  // Monthly breakdown for year mode
  const monthlyBreakdown = useMemo(() => {
    if (mode==="month") return [];
    return Array.from({length:12}, (_,i) => {
      const m = i+1;
      const me = entries.filter(e => e.date.startsWith(`${year}-${String(m).padStart(2,"0")}`));
      return { month:m, ...calcStats(me) };
    });
  }, [entries, year, mode]);

  const fmt = (min: number) => formatDuration(Math.round(Math.abs(min)));
  const sign = (min: number) => min>=0?"+":"-";

  function exportCSV() {
    const rows = [["Datum","Tag","Typ","Start","Ende","Pause","Stunden","Notiz"]];
    for (const e of entries) {
      const d = new Date(e.date);
      const dow = ["So","Mo","Di","Mi","Do","Fr","Sa"][d.getDay()]!;
      const dur = e.start_time&&e.end_time
        ? fmt(calculateWorkDuration(e.start_time, e.end_time, e.break_minutes).net_minutes)
        : "";
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
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Berichte & Export</h1>
          <button onClick={exportCSV} style={{ background:"color-mix(in srgb,var(--green) 15%,transparent)", border:"1px solid var(--green)", color:"var(--green)", padding:"6px 12px", borderRadius:8, cursor:"pointer", fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700 }}>
            ⬇ CSV Export
          </button>
        </div>
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
              /* Day list table */
              entries.length===0 ? (
                <div style={{ textAlign:"center", color:"var(--muted)", padding:"30px 0" }}>Keine Einträge für diesen Monat.</div>
              ) : (
                <div className="card" style={{ padding:0, overflow:"hidden" }}>
                  <div className="report-table-header" style={{ padding:"12px 14px", borderBottom:"1px solid var(--border)", fontSize:10, color:"var(--muted)", fontWeight:700, display:"grid", gridTemplateColumns:"60px 60px 1fr 80px 80px 60px 60px", gap:8, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                    <span>Datum</span><span>Tag</span><span>Typ</span><span>Start</span><span>Ende</span><span>Pause</span><span>Std</span>
                  </div>
                  {entries.sort((a,b)=>a.date.localeCompare(b.date)).map(e => {
                    const d = new Date(e.date);
                    const dow = ["So","Mo","Di","Mi","Do","Fr","Sa"][d.getDay()]!;
                    const dur = e.start_time&&e.end_time
                      ? fmt(calculateWorkDuration(e.start_time,e.end_time,e.break_minutes).net_minutes)
                      : "—";
                    const COLOR: Record<string,string> = { arbeiten:"var(--green)", urlaub:"var(--blue)", krank:"var(--red)", notdienst:"var(--orange)", feiertag:"var(--yellow)", frei:"var(--muted)" };
                    return (
                      <div key={e.id} className="report-table-row" style={{ padding:"10px 14px", borderBottom:"1px solid var(--surface2)", display:"grid", gridTemplateColumns:"60px 60px 1fr 80px 80px 60px 60px", gap:8, alignItems:"center", fontSize:12 }}>
                        <span style={{ fontFamily:"'DM Mono',monospace", color:"var(--muted)" }}>{e.date.slice(5)}</span>
                        <span style={{ color:"var(--muted)", fontWeight:700 }}>{dow}</span>
                        <span style={{ color:COLOR[e.day_type]??"var(--text)", fontWeight:700, textTransform:"capitalize" }}>{e.day_type}</span>
                        <span style={{ fontFamily:"'DM Mono',monospace" }}>{e.start_time??"-"}</span>
                        <span style={{ fontFamily:"'DM Mono',monospace" }}>{e.end_time??"-"}</span>
                        <span style={{ fontFamily:"'DM Mono',monospace", color:"var(--muted)" }}>{e.break_minutes}m</span>
                        <span style={{ fontFamily:"'DM Mono',monospace", color:"var(--green)" }}>{dur}</span>
                      </div>
                    );
                  })}
                </div>
              )
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
