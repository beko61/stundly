"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import SignatureCanvas from "react-signature-canvas";
import { BUNDESLAENDER } from "@/lib/utils/feiertage";
import { parseInternetsizExport } from "@/lib/import/internetsizImport";
import type { ImportPayload } from "@/lib/import/internetsizImport";

interface Profile {
  vorname:        string;
  nachname:       string;
  personal_nr:    string;
  eintrittsdatum: string;
  abteilung:      string;
  vorgesetzter:   string;
  email:          string;
  company_name:   string;
  logo_data:      string | null;
  bundesland:     string;
  signature_data: string | null;
}

const EMPTY: Profile = {
  vorname: "", nachname: "", personal_nr: "", eintrittsdatum: "",
  abteilung: "", vorgesetzter: "", email: "",
  company_name: "", logo_data: null, bundesland: "NI",
  signature_data: null,
};

export default function SettingsPage() {
  const [profile,  setProfile]  = useState<Profile>(EMPTY);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [sigSaved, setSigSaved] = useState(false);
  const sigRef = useRef<SignatureCanvas>(null);

  // ── Import (von alter App / internettesiz HTML) ──
  const [importPreview, setImportPreview] = useState<ImportPayload | null>(null);
  const [importError,   setImportError]   = useState<string | null>(null);
  const [importing,     setImporting]     = useState(false);
  const [importResult,  setImportResult]  = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError(null);
    setImportPreview(null);
    setImportResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = ev.target?.result;
      if (typeof raw !== "string") { setImportError("Datei konnte nicht gelesen werden."); return; }
      try {
        const payload = parseInternetsizExport(raw);
        setImportPreview(payload);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : String(err));
      }
    };
    reader.readAsText(file);
  }

  async function handleImportConfirm() {
    if (!importPreview) return;
    setImporting(true);
    setImportError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Nicht angemeldet.");
      const userId = session.user.id;

      // 1) time_entries — batch upsert (onConflict on user_id + date)
      let teInserted = 0;
      const teBatchSize = 200;
      const teRows = importPreview.timeEntries.map(e => ({ ...e, user_id: userId }));
      for (let i = 0; i < teRows.length; i += teBatchSize) {
        const batch = teRows.slice(i, i + teBatchSize);
        const { error } = await supabase
          .from("time_entries")
          .upsert(batch, { onConflict: "user_id,date" });
        if (error) throw new Error(`time_entries Batch ${i}: ${error.message}`);
        teInserted += batch.length;
      }

      // 2) notdienst_entries — plain insert (allows multiple per day)
      let ndInserted = 0;
      const ndBatchSize = 200;
      const ndRows = importPreview.notdienst.map(n => ({ ...n, user_id: userId }));
      for (let i = 0; i < ndRows.length; i += ndBatchSize) {
        const batch = ndRows.slice(i, i + ndBatchSize);
        const { error } = await supabase.from("notdienst_entries").insert(batch);
        if (error) throw new Error(`notdienst_entries Batch ${i}: ${error.message}`);
        ndInserted += batch.length;
      }

      setImportResult(`✅ Erfolgreich importiert: ${teInserted} Tage, ${ndInserted} Notdienst-Einträge.`);
      setImportPreview(null);
      if (importFileRef.current) importFileRef.current.value = "";
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function load() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { data } = await supabase
      .from("profiles")
      .select("vorname,nachname,personal_nr,eintrittsdatum,abteilung,vorgesetzter,email,company_name,logo_data,bundesland,signature_data")
      .eq("user_id", session.user.id)
      .single();
    if (data) {
      setProfile({
        vorname:        data.vorname        ?? "",
        nachname:       data.nachname       ?? "",
        personal_nr:    data.personal_nr    ?? "",
        eintrittsdatum: data.eintrittsdatum ?? "",
        abteilung:      data.abteilung      ?? "",
        vorgesetzter:   data.vorgesetzter   ?? "",
        email:          data.email          ?? session.user.email ?? "",
        company_name:   data.company_name   ?? "",
        logo_data:      data.logo_data      ?? null,
        bundesland:     data.bundesland     ?? "NI",
        signature_data: data.signature_data ?? null,
      });
      if (data.signature_data) setSigSaved(true);
    } else {
      setProfile(p => ({ ...p, email: session.user?.email ?? "" }));
    }
    setLoading(false);
  }

  function set(key: keyof Profile, val: string | null) {
    setProfile(p => ({ ...p, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: session.user.id, ...profile }, { onConflict: "user_id" });

    setSaving(false);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  }

  function handleSaveSignature() {
    if (!sigRef.current || sigRef.current.isEmpty()) return;
    const dataUrl = sigRef.current.getTrimmedCanvas().toDataURL("image/png");
    setProfile(p => ({ ...p, signature_data: dataUrl }));
    setSigSaved(true);
  }

  function handleClearSignature() {
    sigRef.current?.clear();
    setProfile(p => ({ ...p, signature_data: null }));
    setSigSaved(false);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Resize/compress: max 200KB
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setProfile(p => ({ ...p, logo_data: dataUrl }));
    };
    reader.readAsDataURL(file);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  // ── Vollständiger Backup (internetsiz HTML format) ──
  // Schreibt eine JSON-Datei, die über das Import-Feld oben wieder
  // eingelesen werden kann. Format identisch zur alten Offline-App.
  const [backupBusy, setBackupBusy] = useState(false);
  async function handleBackup() {
    setBackupBusy(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setBackupBusy(false); return; }
      const uid = session.user.id;

      const [{ data: te }, { data: nd }, { data: salary }, { data: vac }, { data: records }] = await Promise.all([
        supabase.from("time_entries").select("date, day_type, start_time, end_time, break_minutes, is_night_shift, note").eq("user_id", uid),
        supabase.from("notdienst_entries").select("date, start_time, end_time, kunde, adresse, problem, ergebnis, note, erledigt").eq("user_id", uid),
        supabase.from("salary_settings").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("vacation_requests").select("*").eq("user_id", uid),
        supabase.from("salary_records").select("*").eq("user_id", uid),
      ]);

      // ── time_entries → internetsiz userData ──
      const userData: Record<string, { status: string; start?: string; end?: string; pause?: string; hours?: string }> = {};
      const userNotes: Record<string, string> = {};
      const statusCap: Record<string, string> = {
        arbeiten: "Arbeiten", urlaub: "Urlaub", krank: "Krank",
        feiertag: "Feiertag", frei: "Frei", notdienst: "Notdienst",
      };
      function minsToHHMM(min: number): string {
        const h = Math.floor(Math.abs(min) / 60);
        const m = Math.abs(min) % 60;
        return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
      }
      function calcNet(start: string, end: string, pauseMin: number): number {
        const [sh, sm] = start.split(":").map(Number);
        const [eh, em] = end.split(":").map(Number);
        const startM = (sh ?? 0) * 60 + (sm ?? 0);
        const endM   = (eh ?? 0) * 60 + (em ?? 0);
        const tot = endM < startM ? (24*60 - startM + endM) : (endM - startM);
        return Math.max(0, tot - pauseMin);
      }

      for (const e of te ?? []) {
        userData[e.date as string] = {
          status: statusCap[e.day_type as string] ?? "Frei",
          start:  (e.start_time as string | null) ?? "",
          end:    (e.end_time   as string | null) ?? "",
          pause:  minsToHHMM(Number(e.break_minutes ?? 0)),
          hours:  e.start_time && e.end_time
            ? minsToHHMM(calcNet(e.start_time as string, e.end_time as string, Number(e.break_minutes ?? 0)))
            : "",
        };
        if (e.note) userNotes[e.date as string] = String(e.note);
      }

      // ── notdienst_entries → internetsiz userNotdienst (Array pro Datum) ──
      interface NdOut { start: string; end: string; hours: string; note: string; erledigt: boolean; kunde?: string; problem?: string; ergebnis?: string }
      const userNotdienst: Record<string, NdOut[]> = {};
      for (const n of nd ?? []) {
        const start = (n.start_time as string | null) ?? "";
        const end   = (n.end_time   as string | null) ?? "";
        const hours = start && end ? minsToHHMM(calcNet(start, end, 0)) : "";
        // note rekonstrukt: "Kunde — Adresse" (em-dash), Fallback Kunde alleine
        const kunde   = (n.kunde   as string | null) ?? "";
        const adresse = (n.adresse as string | null) ?? "";
        const noteCombined = kunde && adresse ? `${kunde} — ${adresse}` : (kunde || adresse || "");
        const entry: NdOut = {
          start, end, hours,
          note: noteCombined || ((n.note as string | null) ?? ""),
          erledigt: Boolean(n.erledigt),
        };
        if (kunde) entry.kunde = kunde;
        const problem  = (n.problem  as string | null) ?? "";
        const ergebnis = (n.ergebnis as string | null) ?? "";
        if (problem)  entry.problem  = problem;
        if (ergebnis) entry.ergebnis = ergebnis;
        const d = n.date as string;
        if (!userNotdienst[d]) userNotdienst[d] = [];
        userNotdienst[d].push(entry);
      }

      const payload = {
        // Internetsiz HTML uyumlu alanlar (Import edilebilir):
        userData,
        userNotdienst,
        userNotes,
        // Ek Stundly verileri (bilgi amaçlı, Import bunları kullanmaz):
        salarySettings: salary ?? null,
        vacationRequests: vac ?? [],
        salaryRecords: records ?? [],
        // Meta
        exportDate: new Date().toISOString(),
        source: "stundly",
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `stundly_backup_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Backup error:", err);
    } finally {
      setBackupBusy(false);
    }
  }

  if (loading) return (
    <div style={{ textAlign: "center", padding: "80px 0", color: "var(--muted)" }}>Laden...</div>
  );

  const field = (label: string, key: keyof Profile, opts?: { placeholder?: string; type?: string }) => (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type={opts?.type ?? "text"}
        placeholder={opts?.placeholder}
        value={profile[key] as string ?? ""}
        onChange={e => set(key, e.target.value)}
      />
    </div>
  );

  return (
    <>
      <div className="page-header">

        <h1 style={{ fontSize: 26, fontWeight: 800, marginTop: 12 }}>Einstellungen</h1>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16, paddingBottom: 40, maxWidth: 960, margin: "0 auto" }}>

        {/* ── Firmendaten ── */}
        <div className="card">
          <div className="label" style={{ marginBottom: 12, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            🏢 Firmendaten
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {field("Firmenname", "company_name", { placeholder: "z.B. Muster GmbH" })}

            {/* Bundesland selector */}
            <div>
              <label className="label">Bundesland (für Feiertage)</label>
              <select
                className="input"
                value={profile.bundesland}
                onChange={e => set("bundesland", e.target.value)}
                style={{ appearance: "none" }}
              >
                {Object.entries(BUNDESLAENDER).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>

            {/* Logo upload */}
            <div>
              <label className="label">Firmenlogo</label>
              {profile.logo_data ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={profile.logo_data}
                    alt="Firmenlogo"
                    style={{ maxHeight: 48, maxWidth: 120, objectFit: "contain", background: "white", padding: 4, borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                  <button
                    type="button"
                    onClick={() => set("logo_data", null)}
                    style={{
                      padding: "6px 10px", borderRadius: 8, border: "1px solid var(--red)",
                      background: "transparent", color: "var(--red)",
                      fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    🗑 Entfernen
                  </button>
                </div>
              ) : (
                <label style={{
                  display: "flex", alignItems: "center", gap: 10,
                  border: "2px dashed var(--border)", borderRadius: 10,
                  padding: "12px 14px", cursor: "pointer",
                }}>
                  <span style={{ fontSize: 20 }}>🏷</span>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>Logo hochladen (PNG / JPG)</span>
                  <input type="file" accept="image/png,image/jpeg,image/svg+xml" style={{ display: "none" }} onChange={handleLogoUpload} />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* ── Mitarbeiter ── */}
        <div className="card">
          <div className="label" style={{ marginBottom: 12, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            👤 Mitarbeiterdaten
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="settings-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {field("Vorname",  "vorname",  { placeholder: "Yusuf" })}
              {field("Nachname", "nachname", { placeholder: "Bektas" })}
            </div>
            <div className="settings-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {field("Personal-Nr.", "personal_nr",    { placeholder: "0034" })}
              {field("Eintrittsdatum", "eintrittsdatum", { placeholder: "19.10.2022" })}
            </div>
            <div className="settings-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {field("Abteilung",    "abteilung",    { placeholder: "Montageteil" })}
              {field("Vorgesetzte/r","vorgesetzter", { placeholder: "Aydin Bektas" })}
            </div>
            {field("E-Mail", "email", { placeholder: "name@example.de", type: "email" })}
          </div>
        </div>

        {/* ── Unterschrift (nur Zeichnen) ── */}
        <div className="card">
          <div className="label" style={{ marginBottom: 12, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            ✍️ Unterschrift
          </div>

          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "white" }}>
            <SignatureCanvas
              ref={sigRef}
              canvasProps={{ width: 340, height: 120, style: { width: "100%", height: 120, cursor: "crosshair", touchAction: "none" } }}
              backgroundColor="white"
            />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={handleClearSignature} style={{
              flex: 1, padding: "8px", borderRadius: 8, border: "1px solid var(--red)",
              background: "transparent", color: "var(--red)",
              fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer",
            }}>🗑 Löschen</button>
            <button onClick={handleSaveSignature} style={{
              flex: 1, padding: "8px", borderRadius: 8, border: "1px solid var(--green)",
              background: "transparent", color: "var(--green)",
              fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer",
            }}>💾 Übernehmen</button>
          </div>

          {sigSaved && profile.signature_data && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: "var(--green)", fontWeight: 700, marginBottom: 4 }}>✅ Unterschrift gespeichert</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={profile.signature_data}
                alt="Unterschrift"
                style={{ maxWidth: 200, maxHeight: 80, border: "1px solid var(--border)", borderRadius: 6, background: "white", padding: 4 }}
              />
            </div>
          )}
        </div>

        {/* Save */}
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ width: "100%", padding: "14px" }}
        >
          {saved ? "✅ Gespeichert!" : saving ? "Speichern..." : "💾 Einstellungen speichern"}
        </button>

        {/* ── Vollständige Sicherung herunterladen ── */}
        <div className="card">
          <div className="label" style={{ marginBottom: 8 }}>💾 Sicherung herunterladen</div>
          <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, marginBottom: 12 }}>
            Lade alle deine Daten als JSON-Datei herunter:
            Arbeitszeiten, Urlaub, Krank, Notdienst (mit Kunde/Adresse), Feiertage, Lohneinstellungen.
            Die Datei kann später wieder über das Import-Feld unten eingelesen werden.
          </p>
          <button
            type="button"
            onClick={() => void handleBackup()}
            disabled={backupBusy}
            className="btn btn-primary"
            style={{ width: "100%", padding: "12px" }}
          >
            {backupBusy ? "Erstelle Sicherung..." : "⬇ stundly_backup_…json herunterladen"}
          </button>
        </div>

        {/* ── Import aus alter App ── */}
        <div className="card">
          <div className="label" style={{ marginBottom: 8 }}>📥 Daten importieren</div>
          <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, marginBottom: 12 }}>
            Übernimm deine Daten aus der alten Offline-App
            (<code style={{ background: "var(--surface2)", padding: "1px 5px", borderRadius: 3, fontSize: 11 }}>arbeitszeit_backup_*.json</code>).
            Tage werden zusammengeführt (existierende Tage bleiben erhalten und werden aktualisiert),
            Notdienst-Einträge werden hinzugefügt.
          </p>

          <label style={{
            display: "flex", alignItems: "center", gap: 10,
            border: "2px dashed var(--border)", borderRadius: 10,
            padding: "12px 14px", cursor: "pointer",
          }}>
            <span style={{ fontSize: 20 }}>📁</span>
            <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>
              JSON-Datei wählen…
            </span>
            <input
              ref={importFileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={handleImportFile}
            />
          </label>

          {importError && (
            <div style={{
              marginTop: 12,
              background: "color-mix(in srgb, var(--red) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)",
              color: "var(--red)",
              borderRadius: 8, padding: "10px 12px", fontSize: 12,
            }}>
              ❌ {importError}
            </div>
          )}

          {importResult && (
            <div style={{
              marginTop: 12,
              background: "color-mix(in srgb, var(--green) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--green) 30%, transparent)",
              color: "var(--green)",
              borderRadius: 8, padding: "10px 12px", fontSize: 12,
            }}>
              {importResult}
            </div>
          )}

          {importPreview && (
            <div style={{
              marginTop: 14,
              background: "var(--surface2)",
              borderRadius: 10,
              padding: 14,
            }}>
              <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                Vorschau
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div style={{ textAlign: "center", background: "var(--surface)", borderRadius: 8, padding: "8px 6px" }}>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 2 }}>TAGE</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 700, color: "var(--accent2)" }}>{importPreview.preview.totalDays}</div>
                </div>
                <div style={{ textAlign: "center", background: "var(--surface)", borderRadius: 8, padding: "8px 6px" }}>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 2 }}>NOTDIENST</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 700, color: "var(--orange)" }}>{importPreview.preview.totalNd}</div>
                </div>
              </div>

              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
                Zeitraum: <strong style={{ color: "var(--text)" }}>{importPreview.preview.earliestDate ?? "—"}</strong> bis <strong style={{ color: "var(--text)" }}>{importPreview.preview.latestDate ?? "—"}</strong>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, marginBottom: 14 }}>
                {(Object.entries(importPreview.preview.byDayType) as [string, number][]).map(([t, count]) => (
                  count > 0 ? (
                    <div key={t} style={{ background: "var(--surface)", borderRadius: 6, padding: "5px 8px", fontSize: 10 }}>
                      <span style={{ color: "var(--muted)" }}>{t}: </span>
                      <strong style={{ color: "var(--text)" }}>{count}</strong>
                    </div>
                  ) : null
                ))}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => { setImportPreview(null); if (importFileRef.current) importFileRef.current.value = ""; }}
                  style={{
                    flex: 1, padding: "10px 12px",
                    background: "transparent", border: "1px solid var(--border)",
                    borderRadius: 8, color: "var(--muted)",
                    fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={() => void handleImportConfirm()}
                  disabled={importing}
                  className="btn btn-primary"
                  style={{ flex: 2, padding: "10px 12px", fontSize: 12 }}
                >
                  {importing ? "Importiere..." : `✓ ${importPreview.preview.totalDays + importPreview.preview.totalNd} Einträge importieren`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Abmelden ── */}
        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            padding: "14px",
            marginTop: 8,
            borderRadius: 12,
            border: "1px solid var(--red)",
            background: "transparent",
            color: "var(--red)",
            fontFamily: "'Syne',sans-serif",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: "0.05em",
          }}
        >
          🚪 Abmelden
        </button>

      </div>
    </>
  );
}
