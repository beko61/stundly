"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { shrinkImage } from "@/lib/scan/shrinkImage";
import { mondayOf, type ScanRow } from "@/lib/company/scanRows";

type Row = ScanRow & { key: number };
interface Member { user_id: string; name: string }

// DSGVO: Firma (Verantwortliche) bestätigt einmal die Übermittlung an Anthropic (USA) zur Texterkennung
const CONSENT_KEY = "stundly_company_ocr_consent_v1";
const TYPES: { v: Row["day_type"]; l: string }[] = [
  { v: "arbeiten", l: "Arbeit" }, { v: "urlaub", l: "Urlaub" }, { v: "krank", l: "Krank" },
];

let nextKey = 1;

/** Probleme einer Zeile (leer = speicherbar) */
function rowIssue(r: Row, dupes: Set<string>): string | null {
  if (!r.userId) return "Mitarbeiter wählen";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return "Datum fehlt";
  if (r.day_type === "arbeiten" && (!r.start_time || !r.end_time || r.start_time === r.end_time)) return "Zeiten prüfen";
  if (dupes.has(`${r.userId}|${r.date}`)) return "doppelt";
  return null;
}

export function ImportClient({ team }: { team: Member[] }) {
  const [rows, setRows]       = useState<Row[]>([]);
  const [busy, setBusy]       = useState<"scan" | "save" | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [done, setDone]       = useState<{ created: number; updated: number; unchanged: number; failed: number } | null>(null);
  const [consent, setConsent] = useState(false);
  // Wochenliste: Woche wählen (Standard: letzte Woche — der Zettel kommt meist nach Wochenende)
  const [week, setWeek] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return mondayOf(d); });
  useEffect(() => { try { setConsent(localStorage.getItem(CONSENT_KEY) === "1"); } catch { /* privat */ } }, []);
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const counts = new Map<string, number>();
  for (const r of rows) if (r.userId && r.date) counts.set(`${r.userId}|${r.date}`, (counts.get(`${r.userId}|${r.date}`) ?? 0) + 1);
  const dupes = new Set([...counts].filter(([, n]) => n > 1).map(([k]) => k));
  const issues = rows.map(r => rowIssue(r, dupes));
  const openIssues = issues.filter(Boolean).length;

  function update(key: number, patch: Partial<Row>) {
    setDone(null);
    setRows(rs => rs.map(r => {
      if (r.key !== key) return r;
      const n = { ...r, ...patch };
      if (patch.day_type && patch.day_type !== "arbeiten") { n.start_time = null; n.end_time = null; n.break_minutes = 0; }
      return n;
    }));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("scan"); setError(null); setHinweis(null); setDone(null);
    try {
      const img = await shrinkImage(file);
      const res = await fetch("/api/company/scan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: img.data, mediaType: img.type, weekStart: week }),
      });
      const j = await res.json().catch(() => ({ error: `Scan fehlgeschlagen (Fehler ${res.status}).` })) as
        { rows?: ScanRow[]; hinweis?: string; error?: string };
      if (!res.ok || j.error) { setError(j.error ?? "Scan fehlgeschlagen."); return; }
      const found = (j.rows ?? []).map(r => ({ ...r, key: nextKey++ }));
      setRows(rs => [...rs, ...found]); // weiteres Foto → anhängen (z. B. zweite Seite)
      setHinweis(found.length ? `${found.length} Zeilen erkannt. ${j.hinweis ?? ""}` : (j.hinweis || "Keine Arbeitszeiten erkannt."));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save"); setError(null);
    const res = await fetch("/api/company/import", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: rows.map(({ userId, date, day_type, start_time, end_time, break_minutes }) =>
        ({ userId, date, day_type, start_time, end_time, break_minutes })) }),
    });
    const j = await res.json().catch(() => ({ error: `Speichern fehlgeschlagen (Fehler ${res.status}).` }));
    setBusy(null);
    if (!res.ok) { setError(j.error ?? "Speichern fehlgeschlagen."); return; }
    setDone(j);
    if (!j.failed) setRows([]);
  }

  const inp:  React.CSSProperties = { padding: "6px 8px", fontSize: 13, minWidth: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 1. Foto */}
      <div className="card" style={{ padding: 20 }}>
        {!consent ? (
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12, lineHeight: 1.6, cursor: "pointer" }}>
            <input type="checkbox" style={{ marginTop: 3, width: 16, height: 16 }}
              onChange={(e) => { if (e.target.checked) { try { localStorage.setItem(CONSENT_KEY, "1"); } catch {} setConsent(true); } }} />
            <span>
              Ich bestätige als Arbeitgeber, dass Fotos von Stundenzetteln (mit Namen und Arbeitszeiten) zur Texterkennung an
              <strong> Anthropic PBC (USA)</strong> übertragen werden dürfen (EU-US Data Privacy Framework, keine Speicherung,
              kein Training). Details in der <a href="/datenschutz" target="_blank" rel="noopener" style={{ color: "var(--accent2)" }}>Datenschutzerklärung</a>.
            </span>
          </label>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)", flexBasis: "100%" }}>
              Woche ab
              <input className="input" type="date" value={week} aria-label="Woche ab Montag" style={{ maxWidth: 170, padding: "6px 8px" }}
                onChange={(e) => e.target.value && setWeek(mondayOf(new Date(`${e.target.value}T12:00:00`)))} />
              <span>(Mo–So; für Listen ohne Datum)</span>
            </label>
            <button className="btn btn-primary" disabled={busy !== null} onClick={() => cameraRef.current?.click()}>
              {busy === "scan" ? "KI liest… (bis 1 Min.)" : rows.length ? "📷 Weiteres Foto" : "📷 Foto aufnehmen"}
            </button>
            <button className="btn" disabled={busy !== null} onClick={() => galleryRef.current?.click()}>🖼️ Aus Galerie</button>
            <button className="btn" disabled={busy !== null} onClick={() => setRows(rs => [...rs, {
              key: nextKey++, name: "", userId: null, date: "", day_type: "arbeiten", start_time: null, end_time: null, break_minutes: 0,
            }])}>+ Zeile</button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
            <input ref={galleryRef} type="file" accept="image/*" hidden onChange={onFile} aria-label="Foto aus Galerie" />
          </div>
        )}
        {hinweis && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>💬 {hinweis}</p>}
        {error && <p style={{ fontSize: 13, color: "var(--red)", marginTop: 10 }}>{error}</p>}
        {done && (
          <p style={{ fontSize: 13, color: done.failed ? "var(--red)" : "var(--green)", marginTop: 10, fontWeight: 700 }}>
            ✅ Gespeichert: {done.created} neu, {done.updated} geändert, {done.unchanged} unverändert
            {done.failed ? ` · ${done.failed} fehlgeschlagen` : ""}. <Link href="/company/reports" style={{ color: "var(--accent2)" }}>Zu den Berichten →</Link>
          </p>
        )}
      </div>

      {/* 2. Tabelle prüfen + korrigieren */}
      {rows.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
            Prüfen & korrigieren ({rows.length} Zeilen{openIssues ? ` · ${openIssues} offen` : ""})
          </div>
          {/* Karten statt breiter Tabelle: am Handy bleibt alles sichtbar (vorher seitlich verschoben) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((r, i) => (
              <div key={r.key} data-testid="import-row" style={{
                border: `1px solid ${issues[i] ? "var(--red)" : "var(--border)"}`, borderRadius: 10, padding: 10,
                background: issues[i] ? "color-mix(in srgb, var(--red) 6%, transparent)" : undefined,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", minWidth: 0, overflowWrap: "anywhere" }}>
                    Zettel: <strong style={{ color: "var(--text)" }}>{r.name || "—"}</strong>
                    {issues[i] && <span style={{ color: "var(--red)", fontWeight: 700 }}> · {issues[i]}</span>}
                  </span>
                  <button className="btn btn-ghost" aria-label="Zeile löschen" style={{ padding: "2px 8px" }}
                    onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))}>✕</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 6 }}>
                  <select className="input" style={inp} aria-label="Mitarbeiter" value={r.userId ?? ""}
                    onChange={(e) => update(r.key, { userId: e.target.value || null })}>
                    <option value="">— Mitarbeiter —</option>
                    {team.map(m => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
                  </select>
                  <input className="input" type="date" style={inp} aria-label="Datum" value={r.date}
                    onChange={(e) => update(r.key, { date: e.target.value })} />
                  <select className="input" style={inp} aria-label="Typ" value={r.day_type}
                    onChange={(e) => update(r.key, { day_type: e.target.value as Row["day_type"] })}>
                    {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                  {r.day_type === "arbeiten" && (<>
                    <input className="input" type="time" style={inp} aria-label="Beginn" value={r.start_time ?? ""}
                      onChange={(e) => update(r.key, { start_time: e.target.value || null })} />
                    <input className="input" type="time" style={inp} aria-label="Ende" value={r.end_time ?? ""}
                      onChange={(e) => update(r.key, { end_time: e.target.value || null })} />
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                      Pause
                      <input className="input" type="number" min={0} max={600} step={5} style={{ ...inp, flex: 1 }} aria-label="Pause"
                        value={r.break_minutes} onChange={(e) => update(r.key, { break_minutes: Math.max(0, Number(e.target.value) || 0) })} />
                    </label>
                  </>)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
            <button className="btn btn-primary" disabled={busy !== null || openIssues > 0} onClick={save}>
              {busy === "save" ? "Speichere…" : `Bei allen speichern (${rows.length})`}
            </button>
            <button className="btn" disabled={busy !== null} onClick={() => { setRows([]); setHinweis(null); }}>Verwerfen</button>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              {openIssues ? "Rot markierte Zeilen zuerst korrigieren." : "Vorhandene Einträge an diesen Tagen werden überschrieben (für den Mitarbeiter sichtbar)."}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
