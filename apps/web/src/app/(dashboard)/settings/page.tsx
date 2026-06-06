"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import SignatureCanvas from "react-signature-canvas";
import { BUNDESLAENDER } from "@/lib/utils/feiertage";

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


      </div>
    </>
  );
}
