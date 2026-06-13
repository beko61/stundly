"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import SignatureCanvas from "react-signature-canvas";
import { BUNDESLAENDER } from "@/lib/utils/feiertage";
import { parseInternetsizExport } from "@/lib/import/internetsizImport";
import type { ImportPayload } from "@/lib/import/internetsizImport";
import { AutoFillReports } from "@/components/settings/AutoFillReports";

interface Profile {
  vorname:        string;
  nachname:       string;
  personal_nr:    string;
  eintrittsdatum: string;
  abteilung:      string;
  vorgesetzter:   string;
  email:          string;
  company_name:   string;
  firma_strasse:  string;
  firma_plz:      string;
  firma_ort:      string;
  firma_telefon:  string;
  logo_data:      string | null;
  bundesland:     string;
  signature_data: string | null;
}

const EMPTY: Profile = {
  vorname: "", nachname: "", personal_nr: "", eintrittsdatum: "",
  abteilung: "", vorgesetzter: "", email: "",
  company_name: "",
  firma_strasse: "", firma_plz: "", firma_ort: "", firma_telefon: "",
  logo_data: null, bundesland: "NI",
  signature_data: null,
};

export default function SettingsPage() {
  const [profile,    setProfile]    = useState<Profile>(EMPTY);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const [sigSaved,   setSigSaved]   = useState(false);
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
      .select("vorname,nachname,personal_nr,eintrittsdatum,abteilung,vorgesetzter,email,company_name,firma_strasse,firma_plz,firma_ort,firma_telefon,logo_data,bundesland,signature_data")
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
        firma_strasse:  data.firma_strasse  ?? "",
        firma_plz:      data.firma_plz      ?? "",
        firma_ort:      data.firma_ort      ?? "",
        firma_telefon:  data.firma_telefon  ?? "",
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
    setSaveError(null);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setSaving(false); setSaveError("Nicht angemeldet."); return; }

    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: session.user.id, ...profile }, { onConflict: "user_id" });

    setSaving(false);
    if (error) {
      console.error("Profile save error:", error);
      setSaveError(error.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
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

  // ── Daten zurücksetzen (alle Zeiteinträge / Notdienst / Urlaub / Lohnaufzeichnungen) ──
  const [resetOpen, setResetOpen]     = useState(false);
  const [resetText, setResetText]     = useState("");
  const [resetBusy, setResetBusy]     = useState(false);
  const [resetError, setResetError]   = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<string | null>(null);

  async function handleResetData() {
    setResetBusy(true);
    setResetError(null);
    try {
      const res = await fetch("/api/account/reset-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: resetText }),
      });
      const data = await res.json() as {
        success?: boolean;
        deleted?: Record<string, number>;
        total?: number;
        error?: string;
      };
      if (!res.ok || !data.success) {
        setResetError(data.error ?? "Unbekannter Fehler");
        setResetBusy(false);
        return;
      }
      setResetResult(
        `✅ ${data.total} Datensätze gelöscht (Zeiteinträge: ${data.deleted?.time_entries ?? 0}, ` +
        `Notdienst: ${data.deleted?.notdienst_entries ?? 0}, ` +
        `Urlaub: ${data.deleted?.vacation_requests ?? 0}, ` +
        `Lohnaufzeichnungen: ${data.deleted?.salary_records ?? 0}).`
      );
      setResetOpen(false);
      setResetText("");
      // 2 sn sonra sayfa yenilensin ki Tracker / Dashboard taze veriyle çalışsın
      setTimeout(() => window.location.reload(), 2500);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setResetBusy(false);
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
          <div className="label" style={{ marginBottom: 6, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            🏢 Firmendaten
          </div>
          <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 }}>
            Diese Angaben erscheinen im Briefkopf deiner Urlaubsanträge und Monatsberichte (PDF).
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {field("Firmenname", "company_name", { placeholder: "z.B. Mustermann Sanitär GmbH" })}

            {/* Adresse — 3 Felder in einer Zeile (Straße, PLZ, Ort) */}
            <div>
              <label className="label">Firmenadresse</label>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr", gap: 8 }}>
                <input
                  className="input"
                  placeholder="Musterstraße 1"
                  value={profile.firma_strasse}
                  onChange={e => set("firma_strasse", e.target.value)}
                />
                <input
                  className="input"
                  placeholder="10115"
                  value={profile.firma_plz}
                  onChange={e => set("firma_plz", e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Berlin"
                  value={profile.firma_ort}
                  onChange={e => set("firma_ort", e.target.value)}
                />
              </div>
            </div>

            {field("Firma Telefon (optional)", "firma_telefon", { placeholder: "z.B. 030 12345678" })}

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
              {field("Vorname",  "vorname",  { placeholder: "z.B. Max" })}
              {field("Nachname", "nachname", { placeholder: "z.B. Mustermann" })}
            </div>
            <div className="settings-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {field("Personal-Nr.", "personal_nr",    { placeholder: "z.B. 12345" })}
              {field("Eintrittsdatum", "eintrittsdatum", { placeholder: "TT.MM.JJJJ" })}
            </div>
            <div className="settings-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {field("Abteilung",    "abteilung",    { placeholder: "z.B. Installation" })}
              {field("Vorgesetzte/r","vorgesetzter", { placeholder: "z.B. Erika Mustermann" })}
            </div>
            {field("E-Mail", "email", { placeholder: "name@firma.de", type: "email" })}
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
        {saveError && (
          <div style={{
            padding: "10px 14px",
            background: "color-mix(in srgb, var(--red) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)",
            color: "var(--red)",
            borderRadius: 8,
            fontSize: 12,
            lineHeight: 1.6,
          }}>
            ❌ <strong>Speichern fehlgeschlagen:</strong> {saveError}
            {/column.*does not exist|firma_/.test(saveError) && (
              <>
                <br />
                <small style={{ color: "var(--muted)" }}>
                  Hinweis: Es fehlt die Datenbank-Migration <code>014_firma_adresse.sql</code> in Supabase.
                  Bitte den SQL-Inhalt im Supabase SQL-Editor ausführen.
                </small>
              </>
            )}
          </div>
        )}

        {/* ── Monatsbefüllung & Berichte ── */}
        <AutoFillReports />

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

        {/* ── Daten zurücksetzen ── */}
        <div className="card" style={{ borderColor: "color-mix(in srgb, var(--red) 30%, transparent)" }}>
          <div className="label" style={{ marginBottom: 8, color: "var(--red)" }}>🗑 Daten zurücksetzen</div>
          <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, marginBottom: 12 }}>
            Löscht <strong style={{ color: "var(--text)" }}>alle</strong> deine Zeiteinträge,
            Notdienst-Einträge, Urlaubsanträge und Lohnaufzeichnungen. Profil, Lohn-Einstellungen
            und dein Konto bleiben erhalten.
            <br />
            <strong style={{ color: "var(--red)" }}>Diese Aktion kann nicht rückgängig gemacht werden.</strong>
          </p>
          {resetResult && (
            <div style={{
              marginBottom: 12, padding: "10px 12px",
              background: "color-mix(in srgb, var(--green) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--green) 30%, transparent)",
              color: "var(--green)", borderRadius: 8, fontSize: 12,
            }}>
              {resetResult}
            </div>
          )}
          <button
            type="button"
            onClick={() => { setResetOpen(true); setResetError(null); setResetText(""); }}
            style={{
              width: "100%", padding: "12px",
              background: "transparent",
              border: "1px solid var(--red)",
              color: "var(--red)",
              borderRadius: 10,
              fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Alle Daten zurücksetzen…
          </button>
        </div>

        {/* Modal: Bestätigung */}
        {resetOpen && (
          <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !resetBusy) setResetOpen(false); }}>
            <div className="modal-sheet" style={{ maxWidth: 480 }}>
              <div style={{ fontSize: 36, textAlign: "center", marginBottom: 12 }}>⚠️</div>
              <h2 style={{ fontSize: 18, fontWeight: 800, textAlign: "center", marginBottom: 12 }}>
                Wirklich alle Daten löschen?
              </h2>
              <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.7, marginBottom: 18, textAlign: "center" }}>
                Alle Zeiteinträge, Notdienst-Einträge, Urlaubsanträge und Lohnaufzeichnungen
                werden <strong style={{ color: "var(--red)" }}>unwiderruflich</strong> gelöscht.
                <br />
                Dein Profil, Lohn-Einstellungen und dein Konto bleiben bestehen.
              </p>
              <p style={{ fontSize: 12, color: "var(--text)", fontWeight: 700, marginBottom: 6 }}>
                Tippe <code style={{ background: "var(--surface2)", padding: "2px 8px", borderRadius: 4, color: "var(--red)" }}>LÖSCHEN</code> ein, um fortzufahren:
              </p>
              <input
                className="input"
                value={resetText}
                onChange={(e) => setResetText(e.target.value)}
                placeholder="LÖSCHEN"
                autoComplete="off"
                spellCheck={false}
                style={{ marginBottom: 12 }}
              />
              {resetError && (
                <div style={{
                  marginBottom: 12, padding: "10px 12px",
                  background: "color-mix(in srgb, var(--red) 12%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)",
                  color: "var(--red)", borderRadius: 8, fontSize: 12,
                }}>
                  ❌ {resetError}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setResetOpen(false)}
                  disabled={resetBusy}
                  style={{
                    flex: 1, padding: "12px",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--muted)",
                    borderRadius: 10,
                    fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
                    cursor: resetBusy ? "not-allowed" : "pointer",
                  }}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={() => void handleResetData()}
                  disabled={resetBusy || resetText !== "LÖSCHEN"}
                  style={{
                    flex: 1, padding: "12px",
                    background: resetText === "LÖSCHEN" ? "var(--red)" : "color-mix(in srgb, var(--red) 30%, transparent)",
                    border: "1px solid var(--red)",
                    color: "white",
                    borderRadius: 10,
                    fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
                    cursor: (resetBusy || resetText !== "LÖSCHEN") ? "not-allowed" : "pointer",
                    opacity: (resetBusy || resetText !== "LÖSCHEN") ? 0.6 : 1,
                  }}
                >
                  {resetBusy ? "Löscht..." : "Endgültig löschen"}
                </button>
              </div>
            </div>
          </div>
        )}

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
