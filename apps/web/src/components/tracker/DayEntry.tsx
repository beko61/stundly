"use client";

import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TimeEntry, DayType } from "@workly/shared";
import { calculateWorkDuration, formatDuration, DAY_TYPES } from "@workly/shared";
import { TimeEntryModal } from "./TimeEntryModal";
import { NotdienstModal, type NotdienstEntry } from "./NotdienstModal";
import { createClient } from "@/lib/supabase/client";

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

/** DB liefert Zeiten teils als "07:45:00" — Anzeige immer HH:MM. */
function hhmm(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : "-";
}

/**
 * Notiz/Kunde unter den Zeit-Chips — max. 2 Zeilen, bläht die Tageszeile nicht auf.
 * Icon in eigener Spalte, damit Folgezeilen bündig unter dem Text stehen.
 */
function NoteLine({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{
      display:"flex", gap:6, marginTop:6, fontSize:12, lineHeight:1.4,
      color:"color-mix(in srgb, var(--text) 65%, transparent)",
    }}>
      <span aria-hidden="true" style={{ flexShrink:0 }}>{icon}</span>
      <div style={{
        minWidth:0, whiteSpace:"pre-line", overflowWrap:"anywhere",
        display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden",
      }}>
        {text}
      </div>
    </div>
  );
}

interface Props {
  date:       string;
  entry?:     TimeEntry | null;
  /** Vortag-Eintrag für §5 ArbZG Ruhezeit-Check im Modal. */
  previousEntry?: TimeEntry | null;
  isToday?:   boolean;
  dayOfWeek:  number;
  feiertag?:  string | undefined; // holiday name if applicable
  /** Notdienst-Einträge dieses Tages — vom Tracker einmal pro Monat geladen (React Query). */
  ndEntries:  NotdienstEntry[];
  onCreate:   (e: Omit<TimeEntry,"id"|"user_id"|"created_at"|"updated_at"|"synced_at">) => Promise<{error:string|null}|undefined>;
  onUpdate:   (id:string, patch:Partial<TimeEntry>) => Promise<{error:string|null}>;
  onDelete:   (id:string) => Promise<void>;
}

export function DayEntry({ date, entry, previousEntry, isToday, dayOfWeek, feiertag, ndEntries, onCreate, onUpdate, onDelete }: Props) {
  const [modalOpen, setModalOpen]   = useState(false);
  const [ndModal, setNdModal]       = useState<"new" | NotdienstEntry | null>(null);
  const qc = useQueryClient();
  // Früher lud jede Tageszeile ihre Notdienste selbst (~30 Requests, nach dem Scroll-zu-heute
  // → Zeilen wuchsen nachträglich und schoben "heute" aus dem Bild). Jetzt: Monats-Query im
  // Tracker, hier nur invalidieren.
  const refreshNd = () => { void qc.invalidateQueries({ queryKey: ["notdienst_entries"] }); };

  const dayNum    = parseInt(date.split("-")[2] ?? "0", 10);
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

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
              <button
                aria-label="Eintrag löschen"
                style={{
                  background:"none", border:"none", color:"var(--muted)",
                  fontSize:22, lineHeight:1, cursor:"pointer",
                  // 44×44 tap-target (WCAG)
                  minWidth:44, minHeight:44,
                  display:"inline-flex", alignItems:"center", justifyContent:"center",
                  borderRadius:8,
                }}
                onClick={async e => { e.stopPropagation(); await onDelete(entry.id); }}>×</button>
            )}
          </div>
        </div>

        {/* Time strip */}
        {entry?.start_time && entry?.end_time && (
          <div style={{ padding:"0 14px 10px" }}>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {[
                { label:"Start", val:hhmm(entry.start_time) },
                { label:"Pause", val:`${String(Math.floor(entry.break_minutes/60)).padStart(2,"0")}:${String(entry.break_minutes%60).padStart(2,"0")}` },
                { label:"Ende",  val:hhmm(entry.end_time) },
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
            </div>
            {entry.note && <NoteLine icon="📝" text={entry.note} />}
          </div>
        )}

        {/* Urlaub / Krank / Feiertag — voller Zeitstreifen wie Arbeiten (08:00–17:00, 1h Pause, 8h netto) */}
        {entry && !entry.start_time && entry.day_type !== DAY_TYPES.FREI && (
          <div style={{ padding:"0 14px 10px" }}>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
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
            </div>
            {entry.note && <NoteLine icon="📝" text={entry.note} />}
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
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                      {[
                        { label:"Start", val:hhmm(nd.start_time) },
                        { label:"Ende",  val:hhmm(nd.end_time) },
                        { label:"Std",   val:ndDur },
                      ].map(({ label, val }) => (
                        <div key={label} className="time-chip" style={{ borderColor:"var(--orange)" }}>
                          <span style={{ color:"var(--muted)", fontSize:9 }}>{label}</span>
                          <span style={{ fontSize:11, color:"var(--orange)" }}>{val}</span>
                        </div>
                      ))}
                    </div>
                    {nd.kunde && <NoteLine icon="📋" text={nd.kunde} />}
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
                      if (!error && data) refreshNd();
                    }}
                    aria-label={nd.erledigt ? "Als unbezahlt markieren" : "Als bezahlt markieren"}
                    title={nd.erledigt ? "Als unbezahlt markieren" : "Als bezahlt markieren"}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: nd.erledigt ? "var(--green)" : "var(--muted)",
                      fontSize: 20,
                      lineHeight: 1,
                      cursor: "pointer",
                      // 44×44 tap-target (WCAG)
                      minWidth: 44, minHeight: 44,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      borderRadius: 8,
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
          previousEntry={previousEntry ?? null}
          onCreate={onCreate} onUpdate={onUpdate} onClose={() => setModalOpen(false)} />
      )}

      {ndModal && (
        <NotdienstModal
          date={date}
          entry={ndModal === "new" ? null : ndModal}
          onSave={refreshNd}
          onDelete={refreshNd}
          onClose={() => setNdModal(null)}
        />
      )}
    </>
  );
}
