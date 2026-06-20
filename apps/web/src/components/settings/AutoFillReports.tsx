"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getFeiertage } from "@/lib/utils/feiertage";
import type { TimeEntry } from "@workly/shared";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  DEFAULT_STANDARD_TIMES,
  getStandardTimes,
  setStandardTimes,
  STANDARD_TIMES_LS_KEY,
  type StandardTimes,
} from "@/lib/utils/standardTimes";

/**
 * Settings → "Jahres-Befüllung" kartı.
 * Yıl seç → "Jahr komplett befüllen" — Mo-Fr boş günler standart saatlerle dolar.
 * Buton, yıl tamamen dolduysa pasifleşir; reset sonrası aktif olur.
 * (PDF Monatsbericht artık /reports sayfasında.)
 */
export function AutoFillReports() {
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());

  const [bundesland, setBundesland] = useState("NI");
  const [yearEntries, setYearEntries] = useState<TimeEntry[]>([]);
  const [loadingYear, setLoadingYear] = useState(true);

  const [yearFilling, setYearFilling] = useState(false);
  const [yearFillResult, setYearFillResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Standardzeiten — kullanıcı ayarlanabilir
  const [std, setStd] = useState<StandardTimes>(DEFAULT_STANDARD_TIMES);
  const [stdSaved, setStdSaved] = useState(false);
  useEffect(() => {
    setStd(getStandardTimes());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STANDARD_TIMES_LS_KEY) setStd(getStandardTimes());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  function updateStd<K extends keyof StandardTimes>(key: K, value: StandardTimes[K]) {
    const next = { ...std, [key]: value };
    setStd(next);
    setStandardTimes(next);
    setStdSaved(true);
    setTimeout(() => setStdSaved(false), 1200);
  }

  // Profil + tüm yılın entries'ini yükle (Werktage hesabı + buton pasiflik kontrolü için)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingYear(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { if (!cancelled) setLoadingYear(false); return; }
      const [{ data: prof }, { data: yearTE }] = await Promise.all([
        supabase.from("profiles").select("bundesland").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("time_entries").select("*")
          .eq("user_id", session.user.id)
          .gte("date", `${year}-01-01`)
          .lte("date", `${year}-12-31`),
      ]);
      if (cancelled) return;
      if (prof?.bundesland) setBundesland(prof.bundesland as string);
      setYearEntries((yearTE ?? []) as TimeEntry[]);
      setLoadingYear(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [year, yearFillResult]); // refresh after auto-fill

  // Boş Mo-Fr Werktage sayısı (Feiertag + mevcut entry hariç)
  function computeRemainingWorkdays(): number {
    const feiertage = getFeiertage(year, bundesland);
    const existingDates = new Set(yearEntries.map(e => e.date));
    let remaining = 0;
    for (let m = 1; m <= 12; m++) {
      const daysInMonth = new Date(year, m, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        const dow = new Date(year, m - 1, d).getDay();
        if (dow === 0 || dow === 6) continue;
        if (feiertage[dateStr]) continue;
        if (existingDates.has(dateStr)) continue;
        remaining++;
      }
    }
    return remaining;
  }

  const remaining = loadingYear ? null : computeRemainingWorkdays();
  const fullyFilled = remaining === 0;

  /** Tüm yılın boş Mo-Fr günlerini standart saatlerle doldur. */
  async function handleYearFill() {
    if (fullyFilled || yearFilling) return;
    const confirmed = window.confirm(
      `${year}: alle leeren Mo-Fr-Werktage werden ausgefüllt — Mo–Do ${std.monThuStart}–${std.monThuEnd} (${std.monThuPause}min Pause), Fr ${std.friStart}–${std.friEnd} (${std.friPause}min Pause). Bestehende Einträge bleiben unverändert. Fortfahren?`
    );
    if (!confirmed) return;

    setYearFilling(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setError("Nicht angemeldet."); setYearFilling(false); return; }
      const userId = session.user.id;
      const feiertage = getFeiertage(year, bundesland);
      const existingDates = new Set(yearEntries.map(e => e.date));

      const toInsert: Array<{
        user_id: string; date: string; day_type: string;
        start_time: string; end_time: string; break_minutes: number;
        is_night_shift: boolean; note: string | null; tags: string[];
      }> = [];
      for (let m = 1; m <= 12; m++) {
        const daysInMonth = new Date(year, m, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${year}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
          const dow = new Date(year, m - 1, d).getDay();
          if (dow === 0 || dow === 6) continue;
          if (feiertage[dateStr]) continue;
          if (existingDates.has(dateStr)) continue;
          const isFriday = dow === 5;
          toInsert.push({
            user_id: userId,
            date: dateStr,
            day_type: "arbeiten",
            start_time:    isFriday ? std.friStart : std.monThuStart,
            end_time:      isFriday ? std.friEnd   : std.monThuEnd,
            break_minutes: isFriday ? std.friPause : std.monThuPause,
            is_night_shift: false,
            note: null,
            tags: [],
          });
        }
      }

      // Batch insert (300'lük gruplar)
      let inserted = 0;
      for (let i = 0; i < toInsert.length; i += 300) {
        const batch = toInsert.slice(i, i + 300);
        const { error: err } = await supabase
          .from("time_entries")
          .upsert(batch, { onConflict: "user_id,date" });
        if (err) throw new Error(err.message);
        inserted += batch.length;
      }
      setYearFillResult(`✅ ${inserted} Tage in ${year} ausgefüllt.`);
      setTimeout(() => setYearFillResult(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Befüllen");
    } finally {
      setYearFilling(false);
    }
  }

  const yearOptions: number[] = [];
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) yearOptions.push(y);

  return (
    <div className="card">
      <div className="label" style={{ marginBottom: 6, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", display: "inline-flex", alignItems: "center" }}>
        ⚡ Jahres-Befüllung
        <InfoTooltip title="Was macht dieser Knopf?">
          Trägt alle leeren Mo–Fr-Werktage (ohne Feiertage) im
          ausgewählten Jahr mit deinen Standardzeiten ein.
          Bestehende Einträge werden nicht überschrieben.
          {"\n\n"}
          Sobald alle Werktage befüllt sind, wird der Knopf grün
          und deaktiviert. Nach „Daten zurücksetzen“ oder einer
          Reset-Aktion wird er wieder aktiv.
          {"\n\n"}
          PDF-Monatsberichte findest du in der App unter
          <strong> Berichte</strong> (Sidebar).
        </InfoTooltip>
      </div>
      <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 }}>
        Fülle ein ganzes Jahr Werktage in einem Schritt mit deinen
        Standardzeiten. PDF-Reports findest du unter{" "}
        <Link href="/reports" style={{ color: "var(--accent2)", fontWeight: 700 }}>Berichte</Link>.
      </p>

      {/* Standardzeiten config */}
      <div style={{
        background: "var(--surface2)",
        borderRadius: 10,
        padding: "12px 14px",
        marginBottom: 14,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            🕐 Standardzeiten
          </span>
          {stdSaved && <span style={{ fontSize: 10, color: "var(--green)", fontWeight: 700 }}>✓ Gespeichert</span>}
        </div>
        <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5, marginBottom: 12 }}>
          Diese Zeiten werden beim <strong>Auto-Befüllen</strong> und für neue <strong>Arbeiten</strong>-Einträge im Tracker verwendet.
        </p>

        {/* Mo-Do block */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "var(--accent2)", fontWeight: 700, marginBottom: 6 }}>Montag – Donnerstag</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div>
              <label className="label" style={{ fontSize: 10 }}>Beginn</label>
              <input className="input" type="time" value={std.monThuStart}
                onChange={e => updateStd("monThuStart", e.target.value)} />
            </div>
            <div>
              <label className="label" style={{ fontSize: 10 }}>Ende</label>
              <input className="input" type="time" value={std.monThuEnd}
                onChange={e => updateStd("monThuEnd", e.target.value)} />
            </div>
            <div>
              <label className="label" style={{ fontSize: 10 }}>Pause (min)</label>
              <input className="input" type="number" min={0} max={240}
                value={std.monThuPause}
                onChange={e => updateStd("monThuPause", parseInt(e.target.value, 10) || 0)} />
            </div>
          </div>
        </div>

        {/* Fr block */}
        <div>
          <div style={{ fontSize: 11, color: "var(--accent2)", fontWeight: 700, marginBottom: 6 }}>Freitag</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div>
              <label className="label" style={{ fontSize: 10 }}>Beginn</label>
              <input className="input" type="time" value={std.friStart}
                onChange={e => updateStd("friStart", e.target.value)} />
            </div>
            <div>
              <label className="label" style={{ fontSize: 10 }}>Ende</label>
              <input className="input" type="time" value={std.friEnd}
                onChange={e => updateStd("friEnd", e.target.value)} />
            </div>
            <div>
              <label className="label" style={{ fontSize: 10 }}>Pause (min)</label>
              <input className="input" type="number" min={0} max={240}
                value={std.friPause}
                onChange={e => updateStd("friPause", parseInt(e.target.value, 10) || 0)} />
            </div>
          </div>
        </div>
      </div>

      {/* Jahr selector */}
      <div style={{ marginBottom: 14 }}>
        <label className="label">Jahr</label>
        <select className="input" value={year} onChange={e => setYear(parseInt(e.target.value, 10))} style={{ appearance: "none" }}>
          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Year auto-fill */}
      <button
        type="button"
        onClick={() => void handleYearFill()}
        disabled={loadingYear || yearFilling || fullyFilled}
        style={{
          width: "100%",
          padding: "13px",
          background: fullyFilled
            ? "color-mix(in srgb, var(--green) 12%, transparent)"
            : "color-mix(in srgb, var(--accent) 15%, transparent)",
          border: `1px solid ${fullyFilled ? "var(--green)" : "var(--accent)"}`,
          color: fullyFilled ? "var(--green)" : "var(--accent2)",
          borderRadius: 10,
          fontFamily: "'Syne', sans-serif",
          fontSize: 13,
          fontWeight: 800,
          cursor: (loadingYear || yearFilling || fullyFilled) ? "not-allowed" : "pointer",
          marginBottom: 10,
        }}
      >
        {loadingYear
          ? "Prüfe Werktage..."
          : yearFilling
            ? "Wird ausgefüllt..."
            : fullyFilled
              ? `✓ ${year} ist komplett befüllt`
              : `⚡ ${year} komplett befüllen${remaining !== null ? ` · ${remaining} Werktage offen` : ""}`}
      </button>
      {yearFillResult && (
        <div style={{
          padding: "10px 12px",
          background: "color-mix(in srgb, var(--green) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--green) 30%, transparent)",
          color: "var(--green)", borderRadius: 8, fontSize: 12,
        }}>
          {yearFillResult}
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 10, padding: "10px 12px",
          background: "color-mix(in srgb, var(--red) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)",
          color: "var(--red)", borderRadius: 8, fontSize: 12,
        }}>
          ❌ {error}
        </div>
      )}
    </div>
  );
}
