"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { calculateMonthlySalary, formatDuration } from "@workly/shared";
import type { TimeEntry, SalarySettings } from "@workly/shared";

const MONTHS     = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const MONTHS_S   = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
const LS_KEY     = "workly_salary_settings_v2";

interface MonthRecord {
  id:        string;
  user_id:   string;
  year:      number;
  month:     number;
  brutto:    number;
  netto:     number;
  note:      string | null;
}

const DEFAULT_SETTINGS: SalarySettings = {
  id: "local", user_id: "local", valid_from: "",
  hourly_rate:              15,
  overtime_rate_multiplier: 1.25,
  night_shift_bonus:        3,
  notdienst_bonus:          50,
  monthly_target_hours:     174,
};

function loadLocalSettings(): SalarySettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) as Partial<SalarySettings> };
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

export default function SalaryPage() {
  const now = new Date();
  const [year,     setYear]     = useState(now.getFullYear());
  const [month,    setMonth]    = useState(now.getMonth() + 1);
  const [entries,  setEntries]  = useState<TimeEntry[]>([]);
  const [records,  setRecords]  = useState<MonthRecord[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [settings, setSettings] = useState<SalarySettings>(DEFAULT_SETTINGS);
  const [settingsSaved,  setSettingsSaved]  = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  // Supabase row id for current settings record (for updates)
  const settingsRowId = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal state
  const [recordModal, setRecordModal] = useState(false);
  const [mBrutto, setMBrutto] = useState("");
  const [mNetto,  setMNetto]  = useState("");
  const [mNote,   setMNote]   = useState("");
  const [mSaving, setMSaving] = useState(false);

  // Load settings: Supabase first, fallback to localStorage
  useEffect(() => {
    async function loadSettings() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setSettings(loadLocalSettings());
        setSettingsLoaded(true);
        return;
      }
      const { data } = await supabase
        .from("salary_settings")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        settingsRowId.current = data.id as string;
        const loaded: SalarySettings = {
          id:                       data.id as string,
          user_id:                  data.user_id as string,
          valid_from:               data.valid_from as string,
          hourly_rate:              Number(data.hourly_rate),
          overtime_rate_multiplier: Number(data.overtime_rate_multiplier),
          night_shift_bonus:        Number(data.night_shift_bonus),
          notdienst_bonus:          Number(data.notdienst_bonus),
          monthly_target_hours:     Number(data.monthly_target_hours),
        };
        setSettings(loaded);
        localStorage.setItem(LS_KEY, JSON.stringify(loaded));
      } else {
        setSettings(loadLocalSettings());
      }
      setSettingsLoaded(true);
    }
    void loadSettings();
  }, []);

  // Auto-save settings: localStorage + Supabase (debounced)
  useEffect(() => {
    if (!settingsLoaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      localStorage.setItem(LS_KEY, JSON.stringify(settings));

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const payload = {
          hourly_rate:              settings.hourly_rate,
          overtime_rate_multiplier: settings.overtime_rate_multiplier,
          night_shift_bonus:        settings.night_shift_bonus,
          notdienst_bonus:          settings.notdienst_bonus,
          monthly_target_hours:     settings.monthly_target_hours,
        };
        if (settingsRowId.current) {
          await supabase.from("salary_settings").update(payload).eq("id", settingsRowId.current);
        } else {
          const { data: inserted } = await supabase
            .from("salary_settings")
            .insert({ ...payload, user_id: session.user.id, valid_from: new Date().toISOString().split("T")[0] })
            .select("id")
            .single();
          if (inserted) settingsRowId.current = inserted.id as string;
        }
      }

      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 1500);
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [settings, settingsLoaded]);

  // Load time entries + monthly records
  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }

      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate   = new Date(year, month, 0).toISOString().split("T")[0]!;

      const [{ data: te }, { data: rec }] = await Promise.all([
        supabase.from("time_entries").select("*")
          .eq("user_id", user.id).gte("date", startDate).lte("date", endDate),
        supabase.from("salary_records").select("*")
          .eq("user_id", user.id).eq("year", year).order("month"),
      ]);

      if (te)  setEntries(te as TimeEntry[]);
      if (rec) setRecords(rec as MonthRecord[]);
      setLoading(false);
    }
    void load();
  }, [year, month]);

  const breakdown = useMemo(() => calculateMonthlySalary(entries, settings), [entries, settings]);
  const fmtEur    = (n: number) => `€ ${n.toFixed(2)}`;

  // Yearly totals from records
  const yearlyBrutto = records.reduce((s, r) => s + r.brutto, 0);
  const yearlyNetto  = records.reduce((s, r) => s + r.netto,  0);
  const yearlyMax    = Math.max(...records.map(r => r.brutto), 1);

  // Current month record
  const curRecord = records.find(r => r.month === month);

  function prevMonth() { if (month === 1) { setYear(y => y-1); setMonth(12); } else setMonth(m => m-1); }
  function nextMonth() { if (month === 12) { setYear(y => y+1); setMonth(1); } else setMonth(m => m+1); }

  function openRecordModal() {
    setMBrutto(curRecord ? String(curRecord.brutto) : String(breakdown.total_gross.toFixed(2)));
    setMNetto(curRecord ? String(curRecord.netto) : "");
    setMNote(curRecord?.note ?? "");
    setRecordModal(true);
  }

  async function saveRecord() {
    setMSaving(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setMSaving(false); return; }

    const payload = {
      user_id: session.user.id,
      year,
      month,
      brutto:  parseFloat(mBrutto) || 0,
      netto:   parseFloat(mNetto)  || 0,
      note:    mNote || null,
    };

    if (curRecord) {
      await supabase.from("salary_records").update(payload).eq("id", curRecord.id);
      setRecords(prev => prev.map(r => r.month === month ? { ...r, ...payload } : r));
    } else {
      const { data } = await supabase.from("salary_records").insert(payload).select().single();
      if (data) setRecords(prev => [...prev, data as MonthRecord].sort((a,b) => a.month - b.month));
    }

    setMSaving(false);
    setRecordModal(false);
  }

  async function deleteRecord() {
    if (!curRecord) return;
    const supabase = createClient();
    await supabase.from("salary_records").delete().eq("id", curRecord.id);
    setRecords(prev => prev.filter(r => r.month !== month));
    setRecordModal(false);
  }

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Gehaltsübersicht</h1>
          <div style={{ display: "flex", gap: 5 }}>
            {[2025,2026,2027,2028].map(y => (
              <button key={y} onClick={() => setYear(y)} style={{
                background: y===year ? "var(--accent)" : "var(--surface2)",
                border: `1px solid ${y===year ? "var(--accent)" : "var(--border)"}`,
                color: y===year ? "white" : "var(--muted)",
                padding: "5px 8px", borderRadius: 8, cursor: "pointer",
                fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 700,
              }}>{y}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={prevMonth} style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", width: 38, height: 38, borderRadius: 10, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
          <h1 style={{ fontSize: 26, fontWeight: 800, flex: 1, textAlign: "center" }}>{MONTHS[month - 1]}</h1>
          <button onClick={nextMonth} style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", width: 38, height: 38, borderRadius: 10, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
        </div>
      </div>

      <div style={{ padding: "20px 16px 40px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 960, margin: "0 auto" }}>

        {/* ── Settings ── */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span className="label">⚙️ Einstellungen</span>
            {settingsSaved && <span style={{ fontSize: 10, color: "var(--green)", fontWeight: 700 }}>✓ Gespeichert</span>}
          </div>
          <div className="settings-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {([
              { key: "hourly_rate",              label: "Stundenlohn (€)" },
              { key: "monthly_target_hours",     label: "Sollstunden/Monat" },
              { key: "overtime_rate_multiplier", label: "Überstunden ×" },
              { key: "night_shift_bonus",        label: "Nachtzuschlag €/h" },
              { key: "notdienst_bonus",          label: "Notdienst €/Tag" },
            ] as { key: keyof SalarySettings; label: string }[]).map(({ key, label }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input
                  className="input" type="number" step="0.01"
                  value={settings[key] as number}
                  onChange={(e) => setSettings(s => ({ ...s, [key]: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Monatsberechnung ── */}
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: "20px 0" }}>Laden...</div>
        ) : (
          <>
            <div className="card purple">
              <div className="label" style={{ marginBottom: 12 }}>💰 Gehaltsberechnung — {MONTHS[month-1]}</div>
              {[
                { label: "Gearbeitete Stunden",   value: formatDuration(Math.round(breakdown.worked_hours * 60)) },
                { label: "Grundgehalt",           value: fmtEur(breakdown.base_pay) },
                { label: "Überstundenvergütung",  value: fmtEur(breakdown.overtime_pay) },
                { label: "Nachtzuschlag",         value: fmtEur(breakdown.night_shift_bonus) },
                { label: "Notdienst-Bonus",       value: fmtEur(breakdown.notdienst_bonus) },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>{label}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13 }}>{value}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, alignItems: "center" }}>
                <span style={{ fontWeight: 700 }}>Brutto Gesamt (berechnet)</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 500, color: "var(--accent2)" }}>
                  {fmtEur(breakdown.total_gross)}
                </span>
              </div>
            </div>

            {/* ── Monatsabrechnung eintragen ── */}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span className="label">🧾 Abrechnung {MONTHS[month-1]}</span>
                <button
                  onClick={openRecordModal}
                  style={{
                    background: "var(--accent)", border: "none", color: "white",
                    padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                    fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 700,
                  }}
                >
                  {curRecord ? "✏️ Bearbeiten" : "+ Eintragen"}
                </button>
              </div>

              {curRecord ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>BRUTTO</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500, color: "var(--green)" }}>€ {curRecord.brutto.toFixed(2)}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>NETTO</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500, color: "var(--blue)" }}>€ {curRecord.netto.toFixed(2)}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>STEUER</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500, color: "var(--red)" }}>€ {(curRecord.brutto - curRecord.netto).toFixed(2)}</div>
                  </div>
                  {curRecord.note && (
                    <div style={{ gridColumn: "1/-1", fontSize: 12, color: "var(--muted)", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                      📝 {curRecord.note}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "16px 0", color: "var(--muted)", fontSize: 13 }}>
                  Noch keine Abrechnung eingetragen.
                </div>
              )}
            </div>

            {/* ── Jahresübersicht ── */}
            <div className="card">
              <div className="label" style={{ marginBottom: 6 }}>📊 Jahresübersicht {year}</div>

              {/* Totals */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                {[
                  { label: "Brutto",  val: `€ ${yearlyBrutto.toFixed(0)}`, color: "var(--green)" },
                  { label: "Netto",   val: `€ ${yearlyNetto.toFixed(0)}`,  color: "var(--blue)"  },
                  { label: "Steuer",  val: `€ ${(yearlyBrutto - yearlyNetto).toFixed(0)}`, color: "var(--red)" },
                ].map(c => (
                  <div key={c.label} style={{ textAlign: "center", background: "var(--surface2)", borderRadius: 10, padding: "10px 6px" }}>
                    <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 500, color: c.color }}>{c.val}</div>
                  </div>
                ))}
              </div>

              {/* Monthly bars */}
              {records.length === 0 ? (
                <div style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", padding: "12px 0" }}>
                  Noch keine Einträge für {year}.
                </div>
              ) : (
                Array.from({ length: 12 }, (_, i) => {
                  const m   = i + 1;
                  const rec = records.find(r => r.month === m);
                  const bPct = rec ? Math.round((rec.brutto / yearlyMax) * 100) : 0;
                  const nPct = rec ? Math.round((rec.netto  / yearlyMax) * 100) : 0;
                  return (
                    <div key={m} style={{ marginBottom: 7, opacity: rec ? 1 : 0.35 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                        <span style={{ color: m === month ? "var(--accent2)" : "var(--muted)", fontWeight: 700, width: 28 }}>{MONTHS_S[i]}</span>
                        {rec ? (
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--muted)" }}>
                            B: €{rec.brutto.toFixed(0)} · N: €{rec.netto.toFixed(0)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, color: "var(--muted)" }}>—</span>
                        )}
                      </div>
                      <div style={{ position: "relative", height: 8, background: "var(--surface2)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${bPct}%`, background: "var(--green)", borderRadius: 4, transition: "width 0.4s" }} />
                        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${nPct}%`, background: "var(--blue)", borderRadius: 4, opacity: 0.6, transition: "width 0.4s" }} />
                      </div>
                    </div>
                  );
                })
              )}

              {/* Legend */}
              {records.length > 0 && (
                <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
                  {[["var(--green)","Brutto"],["var(--blue)","Netto"]].map(([c,l]) => (
                    <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 8, height: 8, background: c, borderRadius: 2 }} />
                      <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>{l}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Record modal */}
      {recordModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setRecordModal(false)}>
          <div className="modal-sheet">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>🧾 {MONTHS[month-1]} {year}</h2>
              <button className="btn btn-ghost" onClick={() => setRecordModal(false)} style={{ padding: "6px 10px" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="label">Brutto erhalten (€)</label>
                  <input className="input" type="number" step="0.01" value={mBrutto}
                    onChange={e => setMBrutto(e.target.value)} placeholder="z.B. 2500.00" />
                </div>
                <div>
                  <label className="label">Netto erhalten (€)</label>
                  <input className="input" type="number" step="0.01" value={mNetto}
                    onChange={e => setMNetto(e.target.value)} placeholder="z.B. 1800.00" />
                </div>
              </div>

              {mBrutto && mNetto && (
                <div style={{
                  background: "color-mix(in srgb, var(--red) 10%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)",
                  borderRadius: 10, padding: "10px 14px",
                  display: "flex", justifyContent: "space-between",
                }}>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>Steuer / Abzüge</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: "var(--red)" }}>
                    € {(parseFloat(mBrutto||"0") - parseFloat(mNetto||"0")).toFixed(2)}
                  </span>
                </div>
              )}

              <div>
                <label className="label">Notiz (optional)</label>
                <input className="input" type="text" value={mNote}
                  onChange={e => setMNote(e.target.value)} placeholder="z.B. Bonus, Sonderzahlung..." />
              </div>

              <button className="btn btn-primary" onClick={() => void saveRecord()} disabled={mSaving || !mBrutto} style={{ width: "100%" }}>
                {mSaving ? "Speichern..." : "💾 Speichern"}
              </button>

              {curRecord && (
                <button onClick={() => void deleteRecord()} style={{
                  width: "100%", padding: 12, background: "transparent",
                  border: "1px solid var(--red)", borderRadius: 12, color: "var(--red)",
                  fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>
                  🗑 Eintrag löschen
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
