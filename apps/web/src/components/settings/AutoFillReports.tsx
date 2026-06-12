"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getFeiertage } from "@/lib/utils/feiertage";
import { generateMonthlyReportPDF } from "@/lib/pdf/monthlyReportPdf";
import type { NotdienstEntry, ProfileInfo } from "@/lib/pdf/monthlyReportPdf";
import type { TimeEntry } from "@workly/shared";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const STD_TIMES = { start: "07:45", endLong: "17:00", endShort: "14:30", pauseLong: 60, pauseShort: 30 };

/**
 * Settings'te "Monatsbefüllung & Berichte" kartı.
 * 1) Yıl seç → "Jahr komplett befüllen" — Mo-Fr boş günler standart saatlerle dolar.
 *    Buton, yıl tamamen dolduysa pasifleşir; reset sonrası aktif olur.
 * 2) Yıl + Ay seç → "Monatsbericht PDF" indirir.
 */
export function AutoFillReports() {
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth() + 1);

  const [bundesland, setBundesland] = useState("NI");
  const [yearEntries, setYearEntries] = useState<TimeEntry[]>([]);
  const [loadingYear, setLoadingYear] = useState(true);

  const [yearFilling, setYearFilling] = useState(false);
  const [yearFillResult, setYearFillResult] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      `${year}: alle leeren Mo-Fr-Werktage werden mit Standardzeiten ausgefüllt (Mo–Do 07:45–17:00, Fr 07:45–14:30). Bestehende Einträge bleiben unverändert. Fortfahren?`
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
            start_time: STD_TIMES.start,
            end_time: isFriday ? STD_TIMES.endShort : STD_TIMES.endLong,
            break_minutes: isFriday ? STD_TIMES.pauseShort : STD_TIMES.pauseLong,
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

  /** Seçili yıl+ay için Monatsbericht PDF üret. */
  async function handlePdf() {
    setPdfLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setError("Nicht angemeldet."); setPdfLoading(false); return; }
      const userId = session.user.id;

      const startDate = `${year}-${String(month).padStart(2,"0")}-01`;
      const daysInMonth = new Date(year, month, 0).getDate();
      const endDate   = `${year}-${String(month).padStart(2,"0")}-${String(daysInMonth).padStart(2,"0")}`;

      const [{ data: te }, { data: nd }, { data: prof }] = await Promise.all([
        supabase.from("time_entries").select("*")
          .eq("user_id", userId).gte("date", startDate).lte("date", endDate),
        supabase.from("notdienst_entries")
          .select("date, start_time, end_time, erledigt, kunde, note")
          .eq("user_id", userId).gte("date", startDate).lte("date", endDate),
        supabase.from("profiles")
          .select("vorname, nachname, personal_nr, company_name, logo_data")
          .eq("user_id", userId).maybeSingle(),
      ]);

      const entries = (te ?? []) as TimeEntry[];
      const notdienst: NotdienstEntry[] = (nd ?? []).map((n) => ({
        date:       n.date as string,
        start_time: n.start_time as string,
        end_time:   n.end_time as string,
        erledigt:   Boolean((n as { erledigt?: boolean }).erledigt),
        kunde:      (n as { kunde?: string | null }).kunde ?? null,
        note:       (n as { note?: string | null }).note ?? null,
      }));
      const profile: ProfileInfo = {
        company_name: (prof?.company_name as string | null) ?? "Stundly",
        logo_data:    (prof?.logo_data as string | null) ?? null,
      };
      if (prof?.vorname)     profile.vorname     = prof.vorname as string;
      if (prof?.nachname)    profile.nachname    = prof.nachname as string;
      if (prof?.personal_nr) profile.personal_nr = prof.personal_nr as string;

      const feiertage = getFeiertage(year, bundesland);
      await generateMonthlyReportPDF({ year, month, entries, notdienst, feiertage, profile });
    } catch (err) {
      console.error("PDF Error:", err);
      setError("PDF konnte nicht erstellt werden: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setPdfLoading(false);
    }
  }

  const yearOptions: number[] = [];
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) yearOptions.push(y);

  return (
    <div className="card">
      <div className="label" style={{ marginBottom: 6, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", display: "inline-flex", alignItems: "center" }}>
        📅 Monatsbefüllung & Berichte
        <InfoTooltip title="Was macht dieser Bereich?">
          <strong>Komplett befüllen:</strong> trägt alle leeren Werktage
          (Mo–Fr ohne Feiertage) mit Standardzeiten ein, damit du nicht jeden
          Tag einzeln klicken musst.
          {"\n\n"}
          <strong>Monatsbericht PDF:</strong> erzeugt eine druckreife
          Zusammenfassung für den gewählten Monat — mit Tagesübersicht,
          Notdienst-Details und Briefkopf aus den Firmendaten.
        </InfoTooltip>
      </div>
      <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 }}>
        Schnelles Massenbefüllen + PDF-Reports — alles an einer Stelle.
      </p>

      {/* Jahr selector */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div>
          <label className="label">Jahr</label>
          <select className="input" value={year} onChange={e => setYear(parseInt(e.target.value, 10))} style={{ appearance: "none" }}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Monat (für PDF)</label>
          <select className="input" value={month} onChange={e => setMonth(parseInt(e.target.value, 10))} style={{ appearance: "none" }}>
            {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
        </div>
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
          marginBottom: 10, padding: "10px 12px",
          background: "color-mix(in srgb, var(--green) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--green) 30%, transparent)",
          color: "var(--green)", borderRadius: 8, fontSize: 12,
        }}>
          {yearFillResult}
        </div>
      )}

      {/* PDF */}
      <button
        type="button"
        onClick={() => void handlePdf()}
        disabled={pdfLoading}
        className="btn btn-primary"
        style={{ width: "100%", padding: "13px", fontSize: 13 }}
      >
        {pdfLoading ? "📄 PDF wird erstellt..." : `📄 Monatsbericht ${MONTHS[month - 1]} ${year} als PDF`}
      </button>

      {error && (
        <div style={{
          marginTop: 12, padding: "10px 12px",
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
