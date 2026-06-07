"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import SignatureCanvas from "react-signature-canvas";
import type { VacationRequest } from "@workly/shared";
import { calculateWorkDuration, DAY_TYPES } from "@workly/shared";

const STATUS_LABELS: Record<VacationRequest["status"], string> = {
  pending:  "Ausstehend",
  approved: "Genehmigt",
  rejected: "Abgelehnt",
};
const STATUS_COLORS: Record<VacationRequest["status"], string> = {
  pending:  "var(--yellow)",
  approved: "var(--green)",
  rejected: "var(--red)",
};

interface Profile {
  vorname: string; nachname: string; personal_nr: string;
  eintrittsdatum: string; abteilung: string; vorgesetzter: string;
  email: string; company_name: string | null; logo_data: string | null;
  signature_data: string | null;
}

// ── Donut chart ────────────────────────────────────────────────────────────
interface Slice { value: number; color: string; label: string; }

function DonutChart({ slices, cx = 52, cy = 52, r = 40, stroke = 13 }: {
  slices: Slice[]; cx?: number; cy?: number; r?: number; stroke?: number;
}) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return (
    <svg width={cx * 2} height={cy * 2}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface2)" strokeWidth={stroke} />
    </svg>
  );
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={cx * 2} height={cy * 2} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface2)" strokeWidth={stroke} />
      {slices.filter(sl => sl.value > 0).map((sl, i) => {
        const dash = (sl.value / total) * circ;
        const gap  = circ - dash;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={sl.color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

function calcWorkdays(start: string, end: string): number {
  if (!start || !end) return 0;
  let count = 0;
  const cur = new Date(start);
  const endD = new Date(end);
  while (cur <= endD) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/** Date range içindeki hafta içi günlerin ISO date listesi (YYYY-MM-DD). */
function workdayDates(start: string, end: string): string[] {
  if (!start || !end) return [];
  const out: string[] = [];
  const cur = new Date(start);
  const endD = new Date(end);
  while (cur <= endD) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) {
      const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
      out.push(iso);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default function VacationPage() {
  const [requests,  setRequests]  = useState<VacationRequest[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [profile,   setProfile]   = useState<Profile | null>(null);

  // Form state
  const [startDate,  setStartDate]  = useState("");
  const [endDate,    setEndDate]    = useState("");
  const [urlaubArt,  setUrlaubArt]  = useState("Erholungsurlaub");
  const [bemerkung,  setBemerkung]  = useState("");
  const [mailTo,        setMailTo]        = useState("");
  const [saving,        setSaving]        = useState(false);
  const [yearUsedDays,  setYearUsedDays]  = useState(0);
  const [overtimeMin,   setOvertimeMin]   = useState(0);
  const VAC_TOTAL = 30;

  // Signature (draw only)
  const [sigData, setSigData] = useState<string | null>(null);
  const sigRef = useRef<SignatureCanvas>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) { setLoading(false); return; }

    const year = new Date().getFullYear();
    const [{ data: reqs }, { data: prof }] = await Promise.all([
      supabase.from("vacation_requests").select("*").eq("user_id", user.id).order("start_date", { ascending: false }),
      supabase.from("profiles").select("vorname,nachname,personal_nr,eintrittsdatum,abteilung,vorgesetzter,email,company_name,logo_data,signature_data").eq("user_id", user.id).single(),
    ]);

    if (reqs) {
      setRequests(reqs as VacationRequest[]);
      // Count used days from approved + pending requests in current year
      const usedDays = (reqs as VacationRequest[])
        .filter(r => {
          if (r.status === "rejected") return false;
          const reqYear = new Date(r.start_date).getFullYear();
          return reqYear === year;
        })
        .reduce((sum, r) => sum + r.days_count, 0);
      setYearUsedDays(usedDays);
    }

    // Calculate year-to-date overtime from time_entries
    const monthsElapsed = new Date().getMonth() + 1;
    const { data: timeData } = await supabase
      .from("time_entries")
      .select("start_time, end_time, break_minutes, day_type")
      .eq("user_id", user.id)
      .gte("date", `${year}-01-01`)
      .lte("date", `${year}-12-31`);
    if (timeData) {
      let workedMin = 0;
      for (const e of timeData) {
        if (e.day_type === DAY_TYPES.ARBEITEN && e.start_time && e.end_time) {
          workedMin += calculateWorkDuration(e.start_time, e.end_time, e.break_minutes as number).net_minutes;
        }
      }
      const targetMin = 174 * 60 * monthsElapsed;
      setOvertimeMin(Math.max(0, workedMin - targetMin));
    }
    if (prof) {
      setProfile(prof as Profile);
      if (prof.signature_data) setSigData(prof.signature_data);
      // Pre-fill mail recipient from profile email if available
      if (prof.email) setMailTo(prof.email);
    }
    setLoading(false);
  }

  const days = calcWorkdays(startDate, endDate);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const userId = session.user.id;

    // 1) Antrag in vacation_requests speichern
    await supabase.from("vacation_requests").insert({
      user_id:    userId,
      start_date: startDate,
      end_date:   endDate,
      days_count: days,
      reason:     bemerkung || null,
      status:     "pending",
    });

    // 2) Sync to time_entries: jeden Werktag als Urlaub markieren
    //    (Wochenenden ausgenommen, Feiertage werden bei Bedarf später überschrieben)
    const dates = workdayDates(startDate, endDate);
    if (dates.length > 0) {
      const rows = dates.map(date => ({
        user_id:        userId,
        date,
        day_type:       "urlaub" as const,
        start_time:     null,
        end_time:       null,
        break_minutes:  0,
        is_night_shift: false,
        note:           bemerkung || null,
        tags:           [] as string[],
      }));
      await supabase.from("time_entries").upsert(rows, { onConflict: "user_id,date" });
    }

    setSaving(false);
    setShowForm(false);
    void load();
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    // Find the request before deletion to know which dates to clean up
    const toDelete = requests.find(r => r.id === id);

    await supabase.from("vacation_requests").delete().eq("id", id);

    // Sync: time_entries'teki Urlaub markierungen löschen
    if (toDelete && userId) {
      const dates = workdayDates(toDelete.start_date, toDelete.end_date);
      if (dates.length > 0) {
        await supabase
          .from("time_entries")
          .delete()
          .eq("user_id", userId)
          .eq("day_type", "urlaub")
          .in("date", dates);
      }
    }

    setRequests(prev => {
      const updated = prev.filter(r => r.id !== id);
      const year = new Date().getFullYear();
      const usedDays = updated
        .filter(r => r.status !== "rejected" && new Date(r.start_date).getFullYear() === year)
        .reduce((sum, r) => sum + r.days_count, 0);
      setYearUsedDays(usedDays);
      return updated;
    });
  }

  function handleSaveSignature() {
    if (!sigRef.current || sigRef.current.isEmpty()) return;
    const data = sigRef.current.getTrimmedCanvas().toDataURL("image/png");
    setSigData(data);
  }

  function pdfRow(doc: import("jspdf").jsPDF, label: string, val: string, y: number) {
    doc.setFontSize(9);
    doc.setTextColor(107, 107, 128);
    doc.text(label, 20, y);
    doc.setTextColor(30, 30, 40);
    doc.setFontSize(10);
    doc.text(val, 75, y);
  }

  async function generatePDF() {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const p = profile;

    // Header bg
    doc.setFillColor(26, 26, 46);
    doc.rect(0, 0, 210, 38, "F");
    // Company logo (if available)
    if (p?.logo_data) {
      try { doc.addImage(p.logo_data, "PNG", 160, 8, 32, 16); } catch { /* ignore */ }
    }
    doc.setFontSize(10);
    doc.setTextColor(196, 132, 252);
    const companyLine = p?.company_name ? `STUNDLY — ${p.company_name}` : "STUNDLY";
    doc.text(companyLine, 20, 16);
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("Urlaubsantrag", 20, 30);
    doc.setFont("helvetica", "normal");

    let y = 50;

    // Mitarbeiter section
    doc.setFillColor(240, 240, 245);
    doc.rect(15, y - 6, 180, 52, "F");
    doc.setFontSize(8);
    doc.setTextColor(107, 107, 128);
    doc.text("MITARBEITER", 20, y);
    y += 6;

    pdfRow(doc, "Name, Vorname:",  `${p?.nachname ?? ""}, ${p?.vorname ?? ""}`.replace(/^,\s*|,\s*$/, "").trim() || "—", y); y += 7;
    pdfRow(doc, "Personal-Nr.:",   p?.personal_nr    ?? "—", y); y += 7;
    pdfRow(doc, "Eintrittsdatum:", p?.eintrittsdatum ?? "—", y); y += 7;
    pdfRow(doc, "Abteilung:",      p?.abteilung      ?? "—", y); y += 7;
    pdfRow(doc, "Vorgesetzte/r:",  p?.vorgesetzter   ?? "—", y); y += 7;
    y += 6;

    // Urlaubsdaten
    doc.setFillColor(240, 240, 245);
    doc.rect(15, y - 6, 180, 45, "F");
    doc.setFontSize(8);
    doc.setTextColor(107, 107, 128);
    doc.text("URLAUBSDATEN", 20, y);
    y += 6;

    pdfRow(doc, "Von:",          fmtDate(startDate),   y); y += 7;
    pdfRow(doc, "Bis:",          fmtDate(endDate),     y); y += 7;
    pdfRow(doc, "Arbeitstage:",  `${days} Tage`,       y); y += 7;
    pdfRow(doc, "Urlaubsart:",   urlaubArt,             y); y += 7;
    pdfRow(doc, "Bemerkungen:",  bemerkung || "—",      y); y += 7;
    y += 10;

    // Signatures
    doc.setDrawColor(107, 107, 128);
    doc.line(20, y + 20, 90, y + 20);
    doc.line(120, y + 20, 190, y + 20);
    doc.setFontSize(8);
    doc.setTextColor(107, 107, 128);
    doc.text("Datum, Unterschrift Arbeitnehmer", 20, y + 25);
    doc.text("Datum, Unterschrift Arbeitgeber",  120, y + 25);

    if (sigData) {
      try { doc.addImage(sigData, "PNG", 20, y, 60, 18); } catch { /* ignore */ }
    }

    const heute = new Date().toLocaleDateString("de-DE");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 40);
    doc.text(`${heute},`, 20, y + 30);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(107, 107, 128);
    doc.text(`Erstellt am ${heute} · Stundly v0.1.0`, 20, 285);

    const fname = `${p?.nachname ?? "Urlaub"}_${startDate}_${endDate}`.replace(/\s/g, "_");
    doc.save(`Urlaubsantrag_${fname}.pdf`);

    if (mailTo) {
      const subject = encodeURIComponent(`Urlaubsantrag ${p?.vorname ?? ""} ${p?.nachname ?? ""} — ${fmtDate(startDate)} bis ${fmtDate(endDate)}`);
      const body = encodeURIComponent(
        `Sehr geehrte/r Damen und Herren,\n\nhiermit beantrage ich Urlaub vom ${fmtDate(startDate)} bis ${fmtDate(endDate)} (${days} Arbeitstage).\nUrlaubsart: ${urlaubArt}${bemerkung ? "\nBemerkung: " + bemerkung : ""}\n\nMit freundlichen Grüßen\n${p?.vorname ?? ""} ${p?.nachname ?? ""}`
      );
      window.open(`mailto:${mailTo}?subject=${subject}&body=${body}`);
    }
  }

  const remainingDays = VAC_TOTAL - yearUsedDays;
  const overtimeDays  = Math.floor(overtimeMin / 60 / 8);
  const totalDays     = remainingDays + overtimeDays;

  const chart1Slices: Slice[] = [
    { value: yearUsedDays,  color: "var(--accent2)", label: "Genommen" },
    { value: remainingDays, color: "var(--green)",   label: "Verfügbar" },
  ];
  const chart2Slices: Slice[] = [
    { value: yearUsedDays,  color: "var(--accent2)", label: "Genommen" },
    { value: remainingDays, color: "var(--green)",   label: "Urlaub" },
    { value: overtimeDays,  color: "var(--blue)",    label: "Überstunden" },
  ];

  return (
    <>
      <div className="page-header">

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>Urlaubsanträge</h1>
          <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ padding: "8px 14px", fontSize: 12 }}>
            + Antrag
          </button>
        </div>
      </div>

      {/* ── Vacation Charts ── */}
      <div style={{ padding: "16px 16px 0", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

          {/* Chart 1 – Jahresurlaub */}
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 16, padding: 14,
          }}>
            <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
              Jahresurlaub
            </div>
            <div style={{ position: "relative", display: "inline-block" }}>
              <DonutChart slices={chart1Slices} />
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                pointerEvents: "none",
              }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 700, color: "var(--green)", lineHeight: 1 }}>
                  {remainingDays}
                </span>
                <span style={{ fontSize: 8, color: "var(--muted)", fontWeight: 700, marginTop: 2 }}>
                  /{VAC_TOTAL}T
                </span>
              </div>
            </div>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
              {chart1Slices.map(s => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>{s.label}</span>
                  </div>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700, color: s.color }}>
                    {s.value}T
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Chart 2 – Gesamtguthaben */}
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 16, padding: 14,
          }}>
            <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
              Gesamtguthaben
            </div>
            <div style={{ position: "relative", display: "inline-block" }}>
              <DonutChart slices={chart2Slices} />
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                pointerEvents: "none",
              }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 700, color: "var(--blue)", lineHeight: 1 }}>
                  {totalDays}
                </span>
                <span style={{ fontSize: 8, color: "var(--muted)", fontWeight: 700, marginTop: 2 }}>
                  Tage
                </span>
              </div>
            </div>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
              {chart2Slices.filter(s => s.value > 0).map(s => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>{s.label}</span>
                  </div>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700, color: s.color }}>
                    {s.value}T
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Overtime detail */}
        {overtimeDays > 0 && (
          <div style={{
            marginTop: 10,
            background: "color-mix(in srgb, var(--blue) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--blue) 25%, transparent)",
            borderRadius: 12, padding: "10px 14px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--blue)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Überstunden → Urlaubstage
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                {Math.round(overtimeMin / 60 * 10) / 10}h ÷ 8 = {overtimeDays} Zusatztage
              </div>
            </div>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 800, color: "var(--blue)" }}>
              +{overtimeDays}T
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: "14px 16px", paddingBottom: 40, maxWidth: 960, margin: "0 auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: "40px 0" }}>Laden...</div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: "40px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏖</div>
            Noch keine Urlaubsanträge.
          </div>
        ) : (
          requests.map((r) => (
            <div key={r.id} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    {fmtDate(r.start_date)} – {fmtDate(r.end_date)}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>{r.days_count} Tage</div>
                  {r.reason && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{r.reason}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{
                    background: `color-mix(in srgb, ${STATUS_COLORS[r.status]} 15%, transparent)`,
                    color: STATUS_COLORS[r.status],
                    padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                  }}>
                    {STATUS_LABELS[r.status]}
                  </span>
                  <button
                    onClick={() => handleDelete(r.id)}
                    style={{
                      background: "none", border: "none",
                      color: "var(--muted)", fontSize: 18, cursor: "pointer",
                      padding: "2px 4px", lineHeight: 1,
                    }}
                    title="Löschen"
                  >×</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-sheet" style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>🏖 Urlaubsantrag</h2>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)} style={{ padding: "6px 10px" }}>✕</button>
            </div>

            {/* Mitarbeiter preview */}
            {profile && (profile.vorname || profile.nachname) && (
              <div style={{
                background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12,
                padding: "12px 14px", marginBottom: 16,
              }}>
                <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                  Mitarbeiter
                </div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  {profile.vorname} {profile.nachname}
                  {profile.personal_nr && <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>Nr. {profile.personal_nr}</span>}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Dates */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="label">Von (Datum)</label>
                  <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                </div>
                <div>
                  <label className="label">Bis (Datum)</label>
                  <input className="input" type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} required />
                </div>
              </div>

              {days > 0 && (
                <div style={{
                  background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                  borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--accent2)", fontWeight: 700,
                }}>
                  {days} Arbeitstage
                </div>
              )}

              <div>
                <label className="label">Urlaubsart</label>
                <input className="input" type="text" value={urlaubArt} onChange={e => setUrlaubArt(e.target.value)} />
              </div>

              <div>
                <label className="label">Bemerkungen (optional)</label>
                <input className="input" type="text" value={bemerkung} onChange={e => setBemerkung(e.target.value)} placeholder="Optional..." />
              </div>

              <div>
                <label className="label">📧 Mail-Empfänger</label>
                <input className="input" type="email" value={mailTo} onChange={e => setMailTo(e.target.value)} />
              </div>

              {/* Signature — draw only */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <div className="label" style={{ marginBottom: 10 }}>✍️ Unterschrift</div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "white" }}>
                  <SignatureCanvas
                    ref={sigRef}
                    canvasProps={{ width: 340, height: 100, style: { width: "100%", height: 100, cursor: "crosshair", touchAction: "none" } }}
                    backgroundColor="white"
                  />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button type="button" onClick={() => { sigRef.current?.clear(); setSigData(null); }} style={{
                    flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--red)",
                    background: "transparent", color: "var(--red)",
                    fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer",
                  }}>🗑 Löschen</button>
                  <button type="button" onClick={handleSaveSignature} style={{
                    flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--green)",
                    background: "transparent", color: "var(--green)",
                    fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer",
                  }}>💾 Übernehmen</button>
                </div>
                {sigData && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 10, color: "var(--green)", fontWeight: 700, marginBottom: 4 }}>✅ Unterschrift bereit</div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sigData} alt="Unterschrift" style={{ maxWidth: 180, maxHeight: 60, border: "1px solid var(--border)", borderRadius: 6, background: "white", padding: 4 }} />
                  </div>
                )}
              </div>

              {/* Actions */}
              <button
                type="button"
                onClick={generatePDF}
                disabled={!startDate || !endDate}
                style={{
                  width: "100%", padding: 14, background: "var(--blue)", border: "none",
                  borderRadius: 12, color: "white", fontFamily: "'Syne',sans-serif",
                  fontSize: 14, fontWeight: 800, cursor: "pointer",
                }}
              >
                📄 PDF speichern &amp; per Mail senden
              </button>

              <button className="btn btn-primary" type="submit" disabled={saving} style={{ width: "100%" }}>
                {saving ? "Senden..." : "💾 Antrag speichern"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
