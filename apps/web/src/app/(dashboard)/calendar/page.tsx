"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calculateWorkDuration, formatDuration, DAY_TYPES } from "@workly/shared";
import type { TimeEntry } from "@workly/shared";
import { useTrackerStore } from "@/store/trackerStore";
import { YearPicker } from "@/components/ui/YearPicker";

const MONTHS_SHORT = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
const TARGET_H     = 174;
const VAC_TOTAL    = 30;

function calcMonthStats(entries: TimeEntry[]) {
  let workedMin = 0, ndMin = 0, ndCount = 0;
  let urlaub = 0, krank = 0, feiertag = 0, arbeiten = 0;
  for (const e of entries) {
    if (e.day_type === DAY_TYPES.URLAUB)    urlaub++;
    if (e.day_type === DAY_TYPES.KRANK)     krank++;
    if (e.day_type === DAY_TYPES.FEIERTAG)  feiertag++;
    if (e.day_type === DAY_TYPES.ARBEITEN)  arbeiten++;
    if (e.day_type === DAY_TYPES.NOTDIENST) ndCount++;
    if (!e.start_time || !e.end_time) {
      if (e.day_type !== DAY_TYPES.FREI && e.day_type !== DAY_TYPES.NOTDIENST) workedMin += 8 * 60;
      continue;
    }
    const { net_minutes } = calculateWorkDuration(e.start_time, e.end_time, e.break_minutes);
    if (e.day_type === DAY_TYPES.NOTDIENST) ndMin += net_minutes;
    else if (e.day_type !== DAY_TYPES.FREI) workedMin += net_minutes;
  }
  return { workedMin, ndMin, ndCount, urlaub, krank, feiertag, arbeiten, diffMin: workedMin - TARGET_H * 60 };
}

function DonutChart({ pct, color, size = 80, stroke = 9, label, sub }: {
  pct: number; color: string; size?: number; stroke?: number; label: string; sub: string;
}) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(Math.max(pct, 0), 100) / 100 * circ;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface2)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
          style={{
            transform:`rotate(90deg)`, transformOrigin:`${size/2}px ${size/2}px`,
            fill:"var(--text)", fontSize:11, fontWeight:700, fontFamily:"'DM Mono',monospace",
          }}>
          {label}
        </text>
      </svg>
      <span style={{ fontSize:9, color:"var(--muted)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>{sub}</span>
    </div>
  );
}

export default function CalendarPage() {
  const now   = new Date();
  const [year,       setYear]       = useState(now.getFullYear());
  const [allEntries, setAllEntries] = useState<TimeEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [view,       setView]       = useState<"year" | "stats">("year");
  const { setMonth: setTrackerMonth } = useTrackerStore();
  const router = useRouter();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from("time_entries").select("*")
        .eq("user_id", session.user.id)
        .gte("date", `${year}-01-01`)
        .lte("date", `${year}-12-31`);
      if (data) setAllEntries(data as TimeEntry[]);
      setLoading(false);
    }
    void load();
  }, [year]);

  const monthStats = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const m  = i + 1;
      const me = allEntries.filter(e => e.date.startsWith(`${year}-${String(m).padStart(2,"0")}`));
      return { month: m, ...calcMonthStats(me) };
    }),
  [allEntries, year]);

  const yearly = useMemo(() => {
    let totalWorked = 0, totalNd = 0, totalDiff = 0;
    let totalUrlaub = 0, totalKrank = 0, totalFeiertag = 0, totalArbeiten = 0;
    for (const s of monthStats) {
      totalWorked   += s.workedMin; totalNd   += s.ndMin;
      totalDiff     += s.diffMin;  totalUrlaub   += s.urlaub;
      totalKrank    += s.krank;    totalFeiertag += s.feiertag;
      totalArbeiten += s.arbeiten;
    }
    return { totalWorked, totalNd, totalDiff, totalUrlaub, totalKrank, totalFeiertag, totalArbeiten };
  }, [monthStats]);

  const maxMonthMin = Math.max(...monthStats.map(s => s.workedMin + s.ndMin), TARGET_H * 60);
  const curMonth    = year === now.getFullYear() ? now.getMonth() + 1 : -1;
  const urlaubPct   = Math.round((yearly.totalUrlaub / VAC_TOTAL) * 100);
  const workedPct   = Math.round((yearly.totalWorked / (TARGET_H * 12 * 60)) * 100);

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Jahreskalender</h1>
          <YearPicker value={year} onChange={setYear} />
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {(["year","stats"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              flex:1, padding:"8px", borderRadius:10, cursor:"pointer",
              background:view===v?"var(--accent)":"var(--surface)",
              border:`1px solid ${view===v?"var(--accent)":"var(--border)"}`,
              color:view===v?"white":"var(--muted)",
              fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700,
            }}>
              {v==="year"?"📅 Jahresansicht":"📊 Statistik"}
            </button>
          ))}
        </div>
      </div>

      {/* Donut row */}
      <div style={{
        padding:"14px 12px 12px", display:"flex", justifyContent:"space-around",
        background:"var(--surface)", borderBottom:"1px solid var(--border)",
      }}>
        <DonutChart pct={workedPct} color="var(--green)"
          label={`${Math.round(yearly.totalWorked/60)}h`} sub="Gearbeitet" />
        <DonutChart pct={urlaubPct}
          color={(VAC_TOTAL-yearly.totalUrlaub)<=5?"var(--red)":"var(--blue)"}
          label={`${VAC_TOTAL-yearly.totalUrlaub}T`} sub="Urlaub" />
        <DonutChart pct={Math.min(100,(Math.abs(yearly.totalDiff)/(TARGET_H*60))*100)}
          color={yearly.totalDiff>=0?"var(--green)":"var(--red)"}
          label={(yearly.totalDiff>=0?"+":"-")+formatDuration(Math.round(Math.abs(yearly.totalDiff)))}
          sub="Differenz" />
        <DonutChart pct={Math.min(100,(yearly.totalNd/(TARGET_H*60))*100)}
          color="var(--orange)" label={formatDuration(Math.round(yearly.totalNd))} sub="Notdienst" />
      </div>

      <div style={{ padding:"16px 16px 40px", maxWidth: 1000, margin: "0 auto" }}>
        {loading ? (
          <div style={{ textAlign:"center", color:"var(--muted)", padding:"40px 0" }}>Laden...</div>
        ) : view==="year" ? (
          <>
            <div style={{ display:"flex", gap:14, padding:"0 2px 10px" }}>
              {[["var(--green)","Arbeiten"],["var(--orange)","Notdienst"],["var(--accent)","Soll"]].map(([c,l]) => (
                <div key={l} style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <div style={{ width:8, height:8, background:c, borderRadius:2 }} />
                  <span style={{ fontSize:10, color:"var(--muted)", fontWeight:600 }}>{l}</span>
                </div>
              ))}
            </div>

            {monthStats.map((s, i) => {
              const isActive = s.month===curMonth;
              const total    = s.workedMin + s.ndMin;
              const wPct     = maxMonthMin>0 ? Math.min(100,(s.workedMin/maxMonthMin)*100) : 0;
              const ndPct    = maxMonthMin>0 ? Math.min(100,(s.ndMin/maxMonthMin)*100) : 0;
              const tPct     = Math.min(100,(TARGET_H*60/maxMonthMin)*100);
              const hasData  = total>0 || s.urlaub>0 || s.krank>0;
              return (
                <div key={i}
                  onClick={() => { setTrackerMonth(year, s.month); router.push("/tracker"); }}
                  style={{
                    background:isActive?"#1e1b38":"var(--surface)",
                    border:`1px solid ${isActive?"var(--accent)":"var(--border)"}`,
                    borderRadius:14, padding:"11px 14px", marginBottom:6, cursor:"pointer",
                  }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:hasData?8:0 }}>
                    <span style={{ fontWeight:700, fontSize:13, width:28, flexShrink:0,
                      color:isActive?"var(--accent2)":"var(--text)" }}>
                      {MONTHS_SHORT[i]}
                    </span>
                    <div style={{ flex:1, position:"relative" }}>
                      <div style={{ background:"var(--surface2)", borderRadius:6, height:10, overflow:"hidden", position:"relative" }}>
                        <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${wPct}%`, background:"var(--green)", transition:"width 0.4s" }} />
                        {ndPct>0 && <div style={{ position:"absolute", left:`${wPct}%`, top:0, height:"100%", width:`${ndPct}%`, background:"var(--orange)", transition:"width 0.4s" }} />}
                      </div>
                      <div style={{ position:"absolute", top:0, left:`${tPct}%`, width:2, height:10, background:"var(--accent)", opacity:0.8 }} />
                    </div>
                    <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                      {hasData && <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"var(--muted)" }}>{formatDuration(Math.round(total))}</span>}
                      {s.diffMin!==0 && (
                        <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:700,
                          color:s.diffMin>0?"var(--green)":"var(--red)" }}>
                          {s.diffMin>0?"+":"-"}{formatDuration(Math.round(Math.abs(s.diffMin)))}
                        </span>
                      )}
                    </div>
                  </div>
                  {hasData && (
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", paddingLeft:38 }}>
                      {s.arbeiten>0 && <span style={{ fontSize:10, color:"var(--green)",  fontWeight:700 }}>✓ {s.arbeiten}T</span>}
                      {s.urlaub>0   && <span style={{ fontSize:10, color:"var(--blue)",   fontWeight:700 }}>🏖 {s.urlaub}T</span>}
                      {s.krank>0    && <span style={{ fontSize:10, color:"var(--red)",    fontWeight:700 }}>🤒 {s.krank}T</span>}
                      {s.feiertag>0 && <span style={{ fontSize:10, color:"var(--yellow)", fontWeight:700 }}>🎉 {s.feiertag}T</span>}
                      {s.ndCount>0  && <span style={{ fontSize:10, color:"var(--orange)", fontWeight:700 }}>🚨 {s.ndCount}×</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                { label:"Arbeitstage", val:String(yearly.totalArbeiten),                                                          color:"green"  },
                { label:"Urlaubstage", val:`${yearly.totalUrlaub} / ${VAC_TOTAL}`,                                                 color:"blue"   },
                { label:"Kranktage",   val:String(yearly.totalKrank),                                                             color:"red"    },
                { label:"Feiertage",   val:String(yearly.totalFeiertag),                                                          color:"yellow" },
                { label:"Notdienst",   val:`${monthStats.reduce((s,m)=>s+m.ndCount,0)}×`,                                        color:"orange" },
                { label:"Überstunden", val:(yearly.totalNd>=0?"+":"")+formatDuration(Math.round(Math.abs(yearly.totalNd))),       color:"purple" },
              ].map(c => (
                <div key={c.label} className={`card ${c.color}`} style={{ textAlign:"center" }}>
                  <div className="label">{c.label}</div>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:22, fontWeight:500 }}>{c.val}</div>
                </div>
              ))}
            </div>

            <div className="card blue">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div className="label" style={{ marginBottom:6 }}>URLAUBSKONTO {year}</div>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:26, fontWeight:500,
                    color:(VAC_TOTAL-yearly.totalUrlaub)<=5?"var(--red)":"var(--blue)" }}>
                    {VAC_TOTAL-yearly.totalUrlaub} Tage frei
                  </div>
                  <div style={{ fontSize:11, color:"var(--muted)", marginTop:4 }}>
                    {yearly.totalUrlaub} genommen · {VAC_TOTAL} bezahlt
                  </div>
                </div>
                <DonutChart pct={urlaubPct}
                  color={(VAC_TOTAL-yearly.totalUrlaub)<=5?"var(--red)":"var(--blue)"}
                  size={72} stroke={8} label={`${urlaubPct}%`} sub="verbraucht" />
              </div>
              <div style={{ background:"var(--surface2)", borderRadius:6, height:8, overflow:"hidden", marginTop:10 }}>
                <div style={{ width:`${urlaubPct}%`, height:"100%", borderRadius:6,
                  background:(VAC_TOTAL-yearly.totalUrlaub)<=5?"var(--red)":"var(--blue)", transition:"width 0.5s" }} />
              </div>
            </div>

            <div className="card">
              <div className="label" style={{ marginBottom:12 }}>MONATLICHE DIFFERENZ</div>
              {monthStats.map((s, i) => {
                const maxD = Math.max(...monthStats.map(m => Math.abs(m.diffMin)), 1);
                const pct  = Math.min(100,(Math.abs(s.diffMin)/maxD)*100);
                return (
                  <div key={i} style={{ marginBottom:7 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3 }}>
                      <span style={{ color:"var(--muted)", fontWeight:700 }}>{MONTHS_SHORT[i]}</span>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11,
                        color:s.diffMin>0?"var(--green)":s.diffMin<0?"var(--red)":"var(--muted)" }}>
                        {s.diffMin===0?"–":(s.diffMin>0?"+":"-")+formatDuration(Math.round(Math.abs(s.diffMin)))}
                      </span>
                    </div>
                    <div style={{ background:"var(--surface2)", borderRadius:3, height:5, overflow:"hidden" }}>
                      <div style={{ width:`${pct}%`, height:"100%", borderRadius:3,
                        background:s.diffMin>0?"var(--green)":"var(--red)", transition:"width 0.4s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
