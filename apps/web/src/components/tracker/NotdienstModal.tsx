"use client";

import { useState, useEffect } from "react";
import type React from "react";
import { createClient } from "@/lib/supabase/client";
import { calculateWorkDuration } from "@workly/shared";
import { formatDur } from "@/lib/utils/formatDur";
import { useModalA11y } from "@/hooks/useModalA11y";
import { notdienstOtherMonthHint } from "@/lib/utils/weekMonth";
import { NotdienstBerichtPanel } from "./NotdienstBerichtPanel";
import { useOnline, useOutbox } from "@/hooks/useOffline";
import { cachedUserId, isNetworkError, isOffline } from "@/lib/offline/network";
import { hasPending } from "@/lib/offline/outbox";
import { offlineDeleteNotdienst, offlineSaveNotdienst } from "@/lib/offline/notdienst";
import {
  filterStreets, joinAdresse, splitAdresse, type StreetSuggestion,
} from "@/lib/address/streets";

export interface NotdienstEntry {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  note: string | null;
  kunde: string | null;
  kunde_telefon?: string | null;
  adresse: string | null;
  problem: string | null;
  ergebnis: string | null;
  erledigt: boolean;
}

interface Props {
  date: string;
  entry?: NotdienstEntry | null;
  /** Firmen-Mitarbeiter: Bezahlt-Status setzt die Firma (Migration 033) — nur Anzeige */
  paidByCompany?: boolean;
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

// Neuer Notdienst: Start = Uhrzeit beim Öffnen (minutengenau), Ende = Start + 1h.
function defaultStart(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function defaultEnd(start: string): string {
  const [h, m] = start.split(":").map(Number);
  const total = ((h || 0) + 1) * 60 + (m || 0);
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
}

export function NotdienstModal({ date, entry, paidByCompany = false, onSave, onDelete, onClose }: Props) {
  const modalRef = useModalA11y<HTMLDivElement>({ onClose });
  // DB liefert Zeiten teils als "18:00:00" — <input type="time"> soll HH:MM zeigen.
  const initStart = entry?.start_time?.slice(0, 5) ?? defaultStart();
  const [start,    setStart]    = useState(initStart);
  const [end,      setEnd]      = useState(entry?.end_time?.slice(0, 5) ?? defaultEnd(initStart));
  // Bei neuen Einträgen läuft Ende automatisch mit (Start + 1h), bis der User Ende selbst setzt.
  const [endTouched, setEndTouched] = useState(!!entry);
  const [kunde,    setKunde]    = useState(entry?.kunde      ?? "");
  const [kundeTelefon, setKundeTelefon] = useState(entry?.kunde_telefon ?? "");
  const initAdr = splitAdresse(entry?.adresse);
  const [strasse,  setStrasse]  = useState(initAdr.strasse);
  const [plz,      setPlz]      = useState(initAdr.plz);
  const [ort,      setOrt]      = useState(initAdr.ort);
  const adresse = joinAdresse({ strasse, plz, ort });
  const [streets,  setStreets]  = useState<StreetSuggestion[] | null>(null);
  const [streetFocus, setStreetFocus] = useState(false);
  const [problem,  setProblem]  = useState(entry?.problem    ?? "");
  const [ergebnis, setErgebnis] = useState(entry?.ergebnis   ?? "");
  const [note,     setNote]     = useState(entry?.note       ?? "");
  const [erledigt, setErledigt] = useState<boolean>(entry?.erledigt ?? false);
  const [saving,   setSaving]   = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedId,  setSavedId]  = useState<string | null>(entry?.id ?? null);
  const [justSaved, setJustSaved] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const online = useOnline();
  const { pending } = useOutbox();
  // Noch nicht übertragen → Anhänge (brauchen den Eintrag auf dem Server) erst nach dem Sync
  const notSynced = !!savedId && pending.some(o => o.key === `nd:${savedId}`);

  // Straßen je PLZ einmal laden, dann beim Tippen clientseitig filtern
  useEffect(() => {
    setStreets(null);
    if (!/^\d{5}$/.test(plz)) return;
    const ctrl = new AbortController();
    fetch(`/api/address/streets?plz=${plz}`, { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : null))
      .then((d: { orte: string[]; streets: StreetSuggestion[] } | null) => {
        if (!d) return;
        setStreets(d.streets);
        setOrt(o => o || d.orte[0] || "");
      })
      .catch(() => { /* Vorschläge optional — Adresse bleibt frei eintippbar */ });
    return () => ctrl.abort();
  }, [plz]);

  const suggestions = streetFocus && streets ? filterStreets(streets, strasse) : [];

  function pickStreet(s: StreetSuggestion) {
    setStrasse(`${s.name} `);
    if (s.ort) setOrt(s.ort);
  }

  function changeStart(v: string) {
    setStart(v);
    if (!endTouched && /^\d{2}:\d{2}$/.test(v)) setEnd(defaultEnd(v));
  }

  const duration = start && end
    ? formatDur(calculateWorkDuration(start, end, 0).net_minutes)
    : "--";

  function openMaps() {
    if (!adresse.trim()) return;
    const q = encodeURIComponent(adresse.trim());
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
  }

  async function handleSave() {
    setSaveError(null);
    // Start = Ende ergibt 0h (Ende vergessen). Ende < Start ist erlaubt (über Mitternacht).
    if (start.slice(0, 5) === end.slice(0, 5)) {
      setSaveError("Start und Ende sind gleich — bitte die Endzeit eintragen.");
      return;
    }
    setSaving(true);
    let userId: string | null = null;

    // Ohne Netz: in die Offline-Outbox, wird automatisch übertragen (OfflineSync)
    const saveOffline = (payload: Record<string, unknown>) => {
      if (!userId) return false;
      const row = offlineSaveNotdienst(userId, savedId, { ...payload, date } as { date: string });
      if (!savedId) setSavedId(row.id);
      onSave(row as unknown as NotdienstEntry);
      setSavedOffline(true);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 4000);
      return true;
    };

    let payload: Record<string, unknown> | null = null;
    try {
      if (!isOffline()) {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        userId = session?.user?.id ?? null;
      }
      if (!userId && isOffline()) userId = cachedUserId();
      if (!userId) {
        setSaveError("Session abgelaufen — bitte Seite neu laden und erneut versuchen.");
        return;
      }

      payload = {
        user_id:    userId,
        date,
        start_time: start,
        end_time:   end,
        note:       note     || null,
        kunde:      kunde    || null,
        ...(kundeTelefon.trim() || entry?.kunde_telefon ? { kunde_telefon: kundeTelefon.trim() || null } : {}),
        adresse:    adresse  || null,
        problem:    problem  || null,
        ergebnis:   ergebnis || null,
        // Bei Firmen-Mitarbeitern setzt die Firma den Bezahlt-Status — nicht mitschicken
        ...(paidByCompany ? {} : { erledigt }),
      };

      if (isOffline() || (savedId && hasPending(`nd:${savedId}`))) {
        saveOffline(payload);
        return;
      }

      const supabase = createClient();
      const { data, error } = savedId
        ? await supabase.from("notdienst_entries").update(payload).eq("id", savedId).select().single()
        : await supabase.from("notdienst_entries").insert(payload).select().single();

      if (error && isNetworkError(error) && saveOffline(payload)) return;
      if (error || !data) {
        setSaveError(error?.message || "Speichern fehlgeschlagen — bitte erneut versuchen.");
        return;
      }

      if (!savedId) setSavedId((data as NotdienstEntry).id);
      onSave(data as NotdienstEntry);
      // Modal bleibt offen — Fotos/Unterschrift/Bericht direkt anschließen. Schließen über ✕.
      setSavedOffline(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch (e) {
      if (payload && isNetworkError(e) && saveOffline(payload)) return;
      setSaveError("Netzwerkfehler — bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!savedId) return;
    const deleteOffline = () => {
      const uid = cachedUserId();
      if (!uid) return false;
      offlineDeleteNotdienst(uid, savedId);
      onDelete?.(savedId);
      onClose();
      return true;
    };
    if ((isOffline() || hasPending(`nd:${savedId}`)) && deleteOffline()) return;
    const supabase = createClient();
    const { error } = await supabase.from("notdienst_entries").delete().eq("id", savedId);
    if (error && isNetworkError(error) && deleteOffline()) return;
    if (error) {
      setSaveError(error.message || "Löschen fehlgeschlagen — bitte erneut versuchen.");
      return;
    }
    onDelete?.(savedId);
    onClose();
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
            {notdienstOtherMonthHint(date) && (
              <p style={{ fontSize:11, color:"var(--orange)", marginTop:2 }}>📅 {notdienstOtherMonthHint(date)}</p>
            )}
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

          {/* Telefon des Kunden + Anrufen */}
          <div>
            <label className="label" htmlFor="nd-kunde-telefon">Telefon (Kunde)</label>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input id="nd-kunde-telefon" className="input" type="tel" inputMode="tel" autoComplete="tel"
                value={kundeTelefon} onChange={e => setKundeTelefon(e.target.value)}
                placeholder="z.B. 0511 123456" style={{ flex:1, minWidth:0 }} />
              {kundeTelefon.trim() && (
                <a href={`tel:${kundeTelefon.replace(/[^\d+]/g, "")}`} aria-label="Kunde anrufen" title="Anrufen" style={{
                  background:"var(--surface2)", border:"1px solid var(--green)", color:"var(--green)",
                  padding:"11px 13px", borderRadius:10, fontSize:16, flexShrink:0, textDecoration:"none",
                }}>📞</a>
              )}
            </div>
          </div>

          {/* Adresse: PLZ → Ort automatisch, Straße mit Vorschlägen + Google Maps */}
          <div>
            <label className="label">Adresse</label>
            <div style={{ display:"flex", gap:8, marginBottom:8 }}>
              <input className="input" type="text" inputMode="numeric" autoComplete="postal-code"
                aria-label="PLZ" placeholder="PLZ" maxLength={5} value={plz}
                onChange={e => setPlz(e.target.value.replace(/\D/g, "").slice(0, 5))}
                style={{ width:92, flexShrink:0 }} />
              <input className="input" type="text" autoComplete="address-level2"
                aria-label="Ort" placeholder="Ort" value={ort}
                onChange={e => setOrt(e.target.value)} style={{ flex:1, minWidth:0 }} />
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <div style={{ position:"relative", flex:1, minWidth:0 }}>
                <input className="input" type="text" autoComplete="off"
                  role="combobox" aria-label="Straße und Hausnummer"
                  aria-autocomplete="list" aria-expanded={suggestions.length > 0}
                  aria-controls="nd-street-list"
                  value={strasse} onChange={e => setStrasse(e.target.value)}
                  onFocus={() => setStreetFocus(true)} onBlur={() => setStreetFocus(false)}
                  placeholder={plz.length === 5 ? "Straße & Nr. — tippen für Vorschläge" : "Straße & Nr. (erst PLZ für Vorschläge)"}
                  style={{ width:"100%" }} />
                {suggestions.length > 0 && (
                  <ul id="nd-street-list" role="listbox" style={{
                    position:"absolute", top:"calc(100% + 4px)", left:0, right:0, zIndex:5,
                    margin:0, padding:4, listStyle:"none",
                    background:"var(--surface)", border:"1px solid var(--border)", borderRadius:10,
                    boxShadow:"0 8px 24px rgba(0,0,0,0.35)",
                  }}>
                    {suggestions.map(s => (
                      // mousedown statt click: sonst verliert das Input zuerst den Fokus und die Liste verschwindet
                      <li key={`${s.name}|${s.ort}`} role="option" aria-selected={false}
                        onMouseDown={e => { e.preventDefault(); pickStreet(s); }}
                        onMouseEnter={e => { e.currentTarget.style.background = "var(--surface2)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                        style={{
                          padding:"9px 10px", borderRadius:8, cursor:"pointer", fontSize:13,
                          display:"flex", justifyContent:"space-between", gap:8,
                        }}>
                        <span>{s.name}</span>
                        {s.ort && s.ort !== ort && <span style={{ color:"var(--muted)", fontSize:11 }}>{s.ort}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button onClick={openMaps} title="In Google Maps öffnen" aria-label="In Google Maps öffnen" style={{
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
                <button key={`${s}-${e}`} onClick={() => { setStart(s); setEnd(e); setEndTouched(true); }}
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
                <input className="input" type="time" aria-label="Start" value={start} onChange={e => changeStart(e.target.value)} />
              </div>
              <div>
                <label className="label">Ende</label>
                <input className="input" type="time" aria-label="Ende" value={end} onChange={e => { setEnd(e.target.value); setEndTouched(true); }} />
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
                {paidByCompany
                  ? "🔒 Den Bezahlt-Status setzt deine Firma."
                  : "Notdienst wird oft erst nächsten Monat ausgezahlt — hier markieren wenn das Geld da ist."}
              </div>
            </div>
            {!paidByCompany && (
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
            )}
          </div>

          {saveError && (
            <div style={{
              background: "color-mix(in srgb, var(--red) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--red) 35%, transparent)",
              borderRadius: 10, padding: "10px 12px",
              color: "var(--red)", fontSize: 12, fontWeight: 600,
            }}>
              ⚠️ {saveError}
            </div>
          )}

          {justSaved && !saveError && (
            <div style={{
              background: "color-mix(in srgb, var(--green) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--green) 35%, transparent)",
              borderRadius: 10, padding: "10px 12px",
              color: "var(--green)", fontSize: 12, fontWeight: 600,
            }}>
              {savedOffline
                ? "📴 Offline gespeichert — wird automatisch übertragen, sobald wieder Internet da ist."
                : "✅ Gespeichert — Fotos, Unterschrift und Bericht kannst du jetzt direkt hinzufügen."}
            </div>
          )}

          {/* Speichern */}
          <button onClick={handleSave} disabled={saving} style={{
            width:"100%", padding:14, background:"var(--orange)", border:"none",
            borderRadius:12, color:"white", fontFamily:"'Syne',sans-serif",
            fontSize:15, fontWeight:800, cursor:"pointer",
          }}>
            {saving ? "Speichern..." : savedId ? "💾 Aktualisieren" : "💾 Speichern"}
          </button>

          {/* Fotos, Kundenunterschrift, PDF-Bericht (braucht gespeicherten Einsatz) */}
          <NotdienstBerichtPanel
            notdienstId={savedId}
            offline={!online || notSynced}
            bericht={{ date, start, end, duration, kunde, telefon: kundeTelefon, adresse, problem, ergebnis, note }}
          />

          {savedId && (
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
