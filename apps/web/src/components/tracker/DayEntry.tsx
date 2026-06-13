"use client";

import React, { useState, useEffect } from "react";
import type { TimeEntry, DayType } from "@workly/shared";
import { calculateWorkDuration, formatDuration, DAY_TYPES } from "@workly/shared";
import { TimeEntryModal } from "./TimeEntryModal";
import { NotdienstModal, type NotdienstEntry } from "./NotdienstModal";
import { createClient } from "@/lib/supabase/client";
import { useTrackerStore } from "@/store/trackerStore";

const WEEKDAYS = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];

/**
 * Sollstunden für bezahlte Abwesenheit (Urlaub/Krank/Feiertag) in Minuten.
 * Mo-Fr immer 8h flat, Sa/So 0. (Arbeiten-Defaults sind separat — siehe lib/utils/standardTimes.)
 */
function getDayStdMins(dateStr: string): number {
  const dow = new Date(dateStr).getDay();
  if (dow === 0 || dow === 6) return 0;
  return 8 * 60;
}

/** Anzeige-Zeitstempel für Urlaub/Krank/Feiertag (in DB sind die echten Zeiten NULL). */
const STANDARD_TIMES = { start: "08:00", end: "17:00", pauseMin: 60 };

/** Status-Typen, die mit Sollstunden gerechnet werden (ohne echte Zeitstempel) */
const PAID_ABSENCE: DayType[] = [DAY_TYPES.URLAUB, DAY_TYPES.KRANK, DAY_TYPES.FEIERTAG];

const STATUS_COLOR: Record<DayType, string> = {
  arbeiten:"var(--green)", urlaub:"var(--blue)", krank:"var(--red)",
  notdienst:"var(--orange)", feiertag:"var(--yellow)", frei:"var(--muted)",
};
const STATUS_ICON: Record<DayType, string> = {
  arbeiten:"✓", urlaub:"🏖", krank:"🤒", notdienst:"🚨", feiertag:"🎉", frei:"—",
};

interface Props {
  date:       string;
  entry?:     TimeEntry | null;
  isToday?:   boolean;
  dayOfWeek:  number;
  feiertag?:  string | undefined; // holiday name if applicable
  onCreate:   (e: Omit<TimeEntry,"id"|"user_id"|"created_at"|"updated_at"|"synced_at">) => Promise<{error:string|null}|undefined>;
  onUpdate:   (id:string, patch:Partial<TimeEntry>) => Promise<{error:string|null}>;
  onDelete:   (id:string) => Promise<void>;
}

export function DayEntry({ date, entry, isToday, dayOfWeek, feiertag, onCreate, onUpdate, onDelete }: Props) {
  const [modalOpen, setModalOpen]   = useState(false);
  const [ndModal, setNdModal]       = useState<"new" | NotdienstEntry | null>(null);
  const [ndEntries, setNdEntries]   = useState<NotdienstEntry[]>([]);
  const incrementNdVersion = useTrackerStore(s => s.incrementNdVersion);;

  const dayNum    = parseInt(date.split("-")[2] ?? "0", 10);
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Load Notdienst sub-entries (weekends + Feiertage immer, Wochentage nur wenn Haupteintrag existiert)
  useEffect(() => {
    const isAutoHolidayDay = !!feiertag;
    if (!entry && !isWeekend && !isAutoHolidayDay) return;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      supabase.from("notdienst_entries")
        .select("*").eq("user_id", session.user.id).eq("date", date)
        .order("start_time")
        .then(({ data }) => { if (data) setNdEntries(data as NotdienstEntry[]); });
    });
  }, [date, entry, isWeekend, feiertag]);

  const workDuration = entry?.start_time && entry?.end_time
    ? calculateWorkDuration(entry.start_time, entry.end_time, entry.break_minutes)
    : null;

  // Saat değeri:
  //  - Arbeiten / echte Zeitstempel → tatsächlich gearbeitete Std
  //  - Urlaub / Krank / Feiertag (entry mit NULL Zeiten) → 8h Sollstunden (Mo-Fr)
  //  - Auto-Feiertag (entry yok, feiertag prop var, örn. Neujahr) → 8h Sollstunden
  //  - Andere → null
  const isPaidAbsence    = !!entry && PAID_ABSENCE.includes(entry.day_type);
  const isAutoHoliday    = !entry && !!feiertag;        // örn. 01.01 Neujahr DB'de yokken
  const showSollstunden  = isPaidAbsence || isAutoHoliday;

  const netHours = workDuration
    ? formatDuration(workDuration.net_minutes)
    : showSollstunden
      ? formatDuration(getDayStdMins(date))
      : null;
  const netColor = entry
    ? STATUS_COLOR[entry.day_type]
    : isAutoHoliday ? "var(--yellow)" : "var(--text)";

  const isFeiertag = !!feiertag && !entry;
  const borderStyle: React.CSSProperties = entry
    ? entry.day_type !== DAY_TYPES.ARBEITEN
      ? { borderColor: STATUS_COLOR[entry.day_type] }
      : isToday ? { borderColor: "var(--accent)" } : {}
    : isFeiertag
      ? { borderColor: "var(--yellow)" }
      : isToday ? { borderColor: "var(--accent)" } : {};

  return (
    <>
      <div className="day-entry" style={{ opacity: isWeekend && !entry && ndEntries.length===0 ? 0.55 : 1, ...borderStyle }}>
        {/* Main row */}
        <div style={{ display:"flex", alignItems:"center", padding:"12px 14px", gap:12, cursor:"pointer" }}
          onClick={() => setModalOpen(true)}>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:20, fontWeight:500,
            color: isToday?"var(--accent2)":"var(--muted)", width:28, textAlign:"center", flexShrink:0 }}>
            {String(dayNum).padStart(2,"0")}
          </div>

          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, color:"var(--muted)", fontWeight:600 }}>
              {WEEKDAYS[dayOfWeek]}
              {isToday && <span style={{ display:"inline-block", width:7, height:7, background:"var(--accent2)", borderRadius:"50%", marginLeft:6, verticalAlign:"middle" }} />}
            </div>
            {entry ? (
              <div style={{ fontSize:13, fontWeight:700, color:STATUS_COLOR[entry.day_type], marginTop:1 }}>
                {STATUS_ICON[entry.day_type]} {entry.day_type.charAt(0).toUpperCase()+entry.day_type.slice(1)}
              </div>
            ) : isFeiertag ? (
              <div style={{ marginTop:1 }}>
                <span style={{ fontSize:13, fontWeight:700, color:"var(--yellow)" }}>🎉 Feiertag</span>
                <span style={{ fontSize:10, color:"var(--yellow)", marginLeft:6, opacity:0.8 }}>{feiertag}</span>
                {isAutoHoliday && netHours && getDayStdMins(date) > 0 && (
                  <span style={{ fontSize:10, color:"var(--muted)", marginLeft:8 }}>
                    · Soll {netHours}
                  </span>
                )}
              </div>
            ) : (
              <div style={{ fontSize:12, color:"var(--muted)", marginTop:1 }}>
                {isWeekend ? "Wochenende" : "+ Eintrag hinzufügen"}
              </div>
            )}
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
            {netHours && (
              <span
                style={{ fontFamily:"'DM Mono',monospace", fontSize:14, fontWeight:600, color: netColor }}
                title={isPaidAbsence ? "Sollstunden — zählt zur Differenz" : "Tatsächlich gearbeitet"}
              >
                {netHours}
              </span>
            )}
            {entry && (
              <button style={{ background:"none", border:"none", color:"var(--muted)", fontSize:18, cursor:"pointer", padding:"2px 4px" }}
                onClick={async e => { e.stopPropagation(); await onDelete(entry.id); setNdEntries([]); }}>×</button>
            )}
          </div>
        </div>

        {/* Time strip */}
        {entry?.start_time && entry?.end_time && (
          <div style={{ display:"flex", gap:6, padding:"0 14px 10px", flexWrap:"wrap" }}>
            {[
              { label:"Start", val:entry.start_time },
              { label:"Pause", val:`${String(Math.floor(entry.break_minutes/60)).padStart(2,"0")}:${String(entry.break_minutes%60).padStart(2,"0")}` },
              { label:"Ende",  val:entry.end_time },
              { label:"Std",   val:netHours??"-" },
            ].map(({ label, val }) => (
              <div key={label} className="time-chip">
                <span style={{ color:"var(--muted)", fontSize:10 }}>{label}</span>
                <span style={{ fontWeight:500 }}>{val}</span>
              </div>
            ))}
            {entry.is_night_shift && (
              <div className="time-chip" style={{ borderColor:"var(--accent2)" }}>
                <span style={{ color:"var(--accent2)", fontSize:10 }}>🌙 Nacht</span>
              </div>
            )}
            {entry.note && (
              <div className="time-chip">
                <span style={{ color:"var(--muted)", fontSize:10 }}>📝 {entry.note}</span>
              </div>
            )}
          </div>
        )}

        {/* Urlaub / Krank / Feiertag — voller Zeitstreifen wie Arbeiten (08:00–17:00, 1h Pause, 8h netto) */}
        {entry && !entry.start_time && entry.day_type !== DAY_TYPES.FREI && (
          <div style={{ padding:"0 14px 10px", display:"flex", gap:6, flexWrap:"wrap" }}>
            {isPaidAbsence ? (
              <>
                {[
                  { label:"Start", val: STANDARD_TIMES.start },
                  { label:"Pause", val: "01:00" },
                  { label:"Ende",  val: STANDARD_TIMES.end },
                  { label:"Std",   val: netHours ?? "08:00" },
                ].map(({ label, val }) => (
                  <div key={label} className="time-chip" style={{ borderColor: STATUS_COLOR[entry.day_type] }}>
                    <span style={{ color:"var(--muted)", fontSize:10 }}>{label}</span>
                    <span style={{ color: STATUS_COLOR[entry.day_type], fontSize:11, fontWeight:600 }}>{val}</span>
                  </div>
                ))}
              </>
            ) : (
              <div className="time-chip" style={{ borderColor:STATUS_COLOR[entry.day_type] }}>
                <span style={{ color:STATUS_COLOR[entry.day_type], fontSize:11, fontWeight:700 }}>
                  {STATUS_ICON[entry.day_type]} {entry.day_type.charAt(0).toUpperCase()+entry.day_type.slice(1)}
                </span>
              </div>
            )}
            {entry.note && (
              <div className="time-chip">
                <span style={{ color:"var(--muted)", fontSize:10 }}>📝 {entry.note}</span>
              </div>
            )}
          </div>
        )}

        {/* Notdienst sub-entries */}
        {ndEntries.length > 0 && (
          <div style={{ padding:"0 14px 8px", borderTop:"1px solid var(--border)" }}>
            {ndEntries.map((nd, idx) => {
              const ndDur = formatDuration(calculateWorkDuration(nd.start_time, nd.end_time, 0).net_minutes);
              return (
                <div key={nd.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0",
                  borderBottom: idx<ndEntries.length-1?"1px solid var(--surface2)":"none" }}
                  onClick={e => { e.stopPropagation(); setNdModal(nd); }}>
                  <span style={{ fontSize:10, color:"var(--orange)", fontWeight:700, flexShrink:0 }}>Nd {idx+1}</span>
                  <div style={{ display:"flex", gap:5, flex:1, flexWrap:"wrap" }}>
                    {[
                      { label:"Start", val:nd.start_time },
                      { label:"Ende",  val:nd.end_time },
                      { label:"Std",   val:ndDur },
                    ].map(({ label, val }) => (
                      <div key={label} className="time-chip" style={{ borderColor:"var(--orange)" }}>
                        <span style={{ color:"var(--muted)", fontSize:9 }}>{label}</span>
                        <span style={{ fontSize:11, color:"var(--orange)" }}>{val}</span>
                      </div>
                    ))}
                    {nd.kunde && (
                      <div className="time-chip">
                        <span style={{ color:"var(--muted)", fontSize:9 }}>📋 {nd.kunde}</span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={async (ev) => {
                      ev.stopPropagation();
                      const supabase = createClient();
                      const newValue = !nd.erledigt;
                      const { data, error } = await supabase
                        .from("notdienst_entries")
                        .update({ erledigt: newValue })
                        .eq("id", nd.id)
                        .select()
                        .single();
                      if (!error && data) {
                        setNdEntries(prev => prev.map(e => e.id === nd.id ? (data as NotdienstEntry) : e));
                        incrementNdVersion();
                      }
                    }}
                    title={nd.erledigt ? "Als unbezahlt markieren" : "Als bezahlt markieren"}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: nd.erledigt ? "var(--green)" : "var(--muted)",
                      fontSize: 16,
                      cursor: "pointer",
                      padding: "4px 6px",
                      borderRadius: 6,
                    }}
                  >
                    {nd.erledigt ? "✅" : "⏳"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* + Notdienst hinzufügen — auch an Wochenenden + Feiertagen (DB-Eintrag nicht nötig) */}
        {(entry || isWeekend || isFeiertag) && ndEntries.length < 6 && (
          <button onClick={e => { e.stopPropagation(); setNdModal("new"); }}
            style={{ width:"calc(100% - 28px)", margin:"0 14px 12px", padding:"7px",
              background:"transparent", border:"1px dashed var(--orange)", borderRadius:8,
              color:"var(--orange)", fontSize:11, fontWeight:700, cursor:"pointer",
              fontFamily:"'Syne',sans-serif" }}>
            + Notdienst hinzufügen
          </button>
        )}
      </div>

      {modalOpen && (
        <TimeEntryModal date={date} dayOfWeek={dayOfWeek} feiertag={feiertag || undefined} entry={entry}
          onCreate={onCreate} onUpdate={onUpdate} onClose={() => setModalOpen(false)} />
      )}

      {ndModal && (
        <NotdienstModal
          date={date}
          entry={ndModal === "new" ? null : ndModal}
          onSave={saved => {
            setNdEntries(prev =>
              ndModal === "new"
                ? [...prev, saved]
                : prev.map(e => e.id === saved.id ? saved : e)
            );
            incrementNdVersion();
          }}
          onDelete={id => { setNdEntries(prev => prev.filter(e => e.id !== id)); incrementNdVersion(); }}
          onClose={() => setNdModal(null)}
        />
      )}
    </>
  );
}
