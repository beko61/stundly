"use client";

import { useState } from "react";
import type React from "react";
import { createClient } from "@/lib/supabase/client";
import { calculateWorkDuration, formatDuration } from "@workly/shared";
import { useModalA11y } from "@/hooks/useModalA11y";

export interface NotdienstEntry {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  note: string | null;
  kunde: string | null;
  adresse: string | null;
  problem: string | null;
  ergebnis: string | null;
  erledigt: boolean;
}

interface Props {
  date: string;
  entry?: NotdienstEntry | null;
  onSave: (entry: NotdienstEntry) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

const PRESETS: [string, string, string][] = [
  ["16:30","17:30","16:30–17:30"],
  ["17:00","18:00","17:00–18:00"],
  ["17:00","19:00","17:00–19:00"],
  ["18:00","20:00","18:00–20:00"],
  ["20:00","22:00","20:00–22:00"],
  ["06:00","08:00","06:00–08:00"],
  ["08:00","12:00","Sa 08–12"],
  ["08:00","16:00","Sa/So 08–16"],
];

// Default times for a NEW notdienst: round current time down to :00,
// end = +1h. Better UX than always 17:00–18:00.
function defaultStart(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes() < 30 ? 0 : 30).padStart(2, "0")}`;
}
function defaultEnd(start: string): string {
  const [h, m] = start.split(":").map(Number);
  const total = ((h || 0) + 1) * 60 + (m || 0);
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
}

export function NotdienstModal({ date, entry, onSave, onDelete, onClose }: Props) {
  const modalRef = useModalA11y<HTMLDivElement>({ onClose });
  const initStart = entry?.start_time ?? defaultStart();
  const [start,    setStart]    = useState(initStart);
  const [end,      setEnd]      = useState(entry?.end_time   ?? defaultEnd(initStart));
  const [kunde,    setKunde]    = useState(entry?.kunde      ?? "");
  const [adresse,  setAdresse]  = useState(entry?.adresse    ?? "");
  const [problem,  setProblem]  = useState(entry?.problem    ?? "");
  const [ergebnis, setErgebnis] = useState(entry?.ergebnis   ?? "");
  const [note,     setNote]     = useState(entry?.note       ?? "");
  const [erledigt, setErledigt] = useState<boolean>(entry?.erledigt ?? false);
  const [saving,   setSaving]   = useState(false);

  const duration = start && end
    ? formatDuration(calculateWorkDuration(start, end, 0).net_minutes)
    : "--";

  function openMaps() {
    if (!adresse.trim()) return;
    const q = encodeURIComponent(adresse.trim());
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const payload = {
      user_id:    session.user.id,
      date,
      start_time: start,
      end_time:   end,
      note:       note     || null,
      kunde:      kunde    || null,
      adresse:    adresse  || null,
      problem:    problem  || null,
      ergebnis:   ergebnis || null,
      erledigt,
    };

    if (entry) {
      const { data } = await supabase.from("notdienst_entries").update(payload).eq("id", entry.id).select().single();
      if (data) onSave(data as NotdienstEntry);
    } else {
      const { data } = await supabase.from("notdienst_entries").insert(payload).select().single();
      if (data) onSave(data as NotdienstEntry);
    }
    setSaving(false);
    onClose();
  }

  async function handleDelete() {
    if (!entry) return;
    const supabase = createClient();
    await supabase.from("notdienst_entries").delete().eq("id", entry.id);
    onDelete?.(entry.id);
    onClose();
  }

  function handleMailSend() {
    const subject = encodeURIComponent(`Notdienst-Bericht ${date}`);
    const lines = [
      `Datum: ${date}`,
      `Uhrzeit: ${start} – ${end} (${duration})`,
      kunde    ? `Kunde: ${kunde}`         : "",
      adresse  ? `Adresse: ${adresse}`     : "",
      problem  ? `\nProblem:\n${problem}`  : "",
      ergebnis ? `\nErgebnis / Feststellungen:\n${ergebnis}` : "",
      note     ? `\nNotiz: ${note}`        : "",
    ].filter(Boolean).join("\n");
    window.open(`mailto:?subject=${subject}&body=${encodeURIComponent(lines)}`);
  }

  const taStyle: React.CSSProperties = {
    width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
    borderRadius: 10, padding: "11px 14px", color: "var(--text)",
    fontFamily: "'Syne',sans-serif", fontSize: 13, outline: "none",
    resize: "none", lineHeight: 1.5, boxSizing: "border-box",
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div
        ref={modalRef}
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notdienst-modal-title"
        tabIndex={-1}
        style={{ maxHeight: "90dvh", overflowY: "auto" }}
      >

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <h2 id="notdienst-modal-title" style={{ fontSize:18, fontWeight:800, color:"var(--orange)" }}>🚨 Notdienst</h2>
            <p style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>{date}</p>
          </div>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Schließen" style={{ padding:"6px 10px" }}>✕</button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

          {/* Kunde */}
          <div>
            <label className="label">Kunde (Name, Stockwerk)</label>
            <input className="input" type="text" value={kunde} onChange={e => setKunde(e.target.value)}
              placeholder="z.B. Frau Ermakov/Kraft, 2. OG rechts" />
          </div>

          {/* Adresse + Google Maps Button */}
          <div>
            <label className="label">Adresse</label>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input className="input" type="text" value={adresse} onChange={e => setAdresse(e.target.value)}
                placeholder="z.B. Kniestraße 22, 30519 Hannover"
                style={{ flex:1 }} />
              <button onClick={openMaps} title="In Google Maps öffnen" style={{
                background:"var(--surface2)", border:"1px solid var(--green)", color:"var(--green)",
                padding:"11px 13px", borderRadius:10, cursor:"pointer", fontSize:16, flexShrink:0,
              }}>📍</button>
            </div>
          </div>

          {/* Problem */}
          <div>
            <label className="label">Problem</label>
            <textarea style={{ ...taStyle, minHeight:70 }} rows={3} value={problem}
              onChange={e => setProblem(e.target.value)}
              placeholder="z.B. Die WC-Spülung ist undicht..." />
          </div>

          {/* Ergebnis */}
          <div>
            <label className="label">Ergebnis / Feststellungen (jede Zeile = ein Punkt)</label>
            <textarea style={{ ...taStyle, minHeight:90 }} rows={4} value={ergebnis}
              onChange={e => setErgebnis(e.target.value)}
              placeholder={"Laut telefonischer Auskunft wurde...\nNach der Reparatur trat erneut...\nVor Ort wurde festgestellt..."} />
          </div>

          {/* Schnellauswahl */}
          <div style={{ borderTop:"1px solid var(--border)", paddingTop:14 }}>
            <label className="label">⏰ Schnellauswahl</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
              {PRESETS.map(([s, e, label]) => (
                <button key={`${s}-${e}`} onClick={() => { setStart(s); setEnd(e); }}
                  style={{
                    background: start===s && end===e ? "rgba(251,146,60,0.2)" : "var(--surface2)",
                    border:"1px solid var(--orange)", color:"var(--orange)",
                    padding:"7px 11px", borderRadius:8,
                    fontFamily:"'DM Mono',monospace", fontSize:11, cursor:"pointer",
                  }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
              <div>
                <label className="label">Start</label>
                <input className="input" type="time" value={start} onChange={e => setStart(e.target.value)} />
              </div>
              <div>
                <label className="label">Ende</label>
                <input className="input" type="time" value={end} onChange={e => setEnd(e.target.value)} />
              </div>
              <div>
                <label className="label">Arbeitszeit</label>
                <div className="input" style={{ color:"var(--orange)", fontFamily:"'DM Mono',monospace" }}>{duration}</div>
              </div>
            </div>
          </div>

          {/* Notiz */}
          <div>
            <label className="label">Notiz (optional)</label>
            <textarea
              className="input"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Kurze Notiz... (Enter = neue Zeile)"
              rows={2}
              style={{ resize: "vertical", minHeight: 44, fontFamily: "'Syne', sans-serif" }}
            />
          </div>

          {/* Bezahlt-Toggle (Lohn wird oft erst nächsten Monat ausgezahlt) */}
          <div style={{
            background: erledigt
              ? "color-mix(in srgb, var(--green) 12%, transparent)"
              : "color-mix(in srgb, var(--orange) 10%, transparent)",
            border: `1px solid ${erledigt
              ? "color-mix(in srgb, var(--green) 35%, transparent)"
              : "color-mix(in srgb, var(--orange) 30%, transparent)"}`,
            borderRadius: 12,
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: erledigt ? "var(--green)" : "var(--orange)" }}>
                {erledigt ? "✅ Bezahlt" : "⏳ Noch offen"}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                Notdienst wird oft erst nächsten Monat ausgezahlt — hier markieren wenn das Geld da ist.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setErledigt(v => !v)}
              style={{
                position: "relative",
                width: 50,
                height: 28,
                borderRadius: 14,
                background: erledigt ? "var(--green)" : "var(--surface2)",
                border: `1px solid ${erledigt ? "var(--green)" : "var(--border)"}`,
                cursor: "pointer",
                flexShrink: 0,
                padding: 0,
              }}
              aria-label={erledigt ? "Als unbezahlt markieren" : "Als bezahlt markieren"}
            >
              <span style={{
                position: "absolute",
                top: 2,
                left: erledigt ? 24 : 2,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "white",
                transition: "left 0.18s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }} />
            </button>
          </div>

          {/* Speichern */}
          <button onClick={handleSave} disabled={saving} style={{
            width:"100%", padding:14, background:"var(--orange)", border:"none",
            borderRadius:12, color:"white", fontFamily:"'Syne',sans-serif",
            fontSize:15, fontWeight:800, cursor:"pointer",
          }}>
            {saving ? "Speichern..." : "💾 Speichern"}
          </button>

          {/* Per Mail */}
          <button onClick={handleMailSend} style={{
            width:"100%", padding:14, background:"#ea4335", border:"none",
            borderRadius:12, color:"white", fontFamily:"'Syne',sans-serif",
            fontSize:14, fontWeight:800, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          }}>
            <span style={{ fontSize:18 }}>📧</span> Per Mail senden
          </button>
          <p style={{ fontSize:11, color:"var(--muted)", textAlign:"center" }}>
            📎 Fotos bitte manuell anhängen
          </p>

          {entry && (
            <button onClick={handleDelete} style={{
              width:"100%", padding:12, background:"transparent",
              border:"1px solid var(--red)", borderRadius:12,
              color:"var(--red)", fontFamily:"'Syne',sans-serif",
              fontSize:13, fontWeight:700, cursor:"pointer",
            }}>
              🗑 Eintrag löschen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
