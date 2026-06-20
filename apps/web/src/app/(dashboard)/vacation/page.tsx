"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import SignatureCanvas from "react-signature-canvas";
import type { VacationRequest, UrlaubArt } from "@workly/shared";
import { URLAUB_ARTEN } from "@workly/shared";
import { computeOvertime, type OvertimeEntry } from "@/lib/vacation/overtime";
import { getFeiertage } from "@/lib/utils/feiertage";
import { STUNDLY_VERSION_LABEL } from "@/lib/version";

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
  signature_data: string | null; bundesland: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return isoOf(d);
}
function isWeekendISO(iso: string): boolean {
  const d = new Date(iso).getDay();
  return d === 0 || d === 6;
}

/** Mo-Fr arası iş günleri; Feiertage düşülür (varsa). */
function calcWorkdays(start: string, end: string, holidays?: Record<string, string>): number {
  if (!start || !end) return 0;
  let count = 0;
  const cur = new Date(start);
  const endD = new Date(end);
  while (cur <= endD) {
    const d = cur.getDay();
    const iso = isoOf(cur);
    if (d !== 0 && d !== 6 && !(holidays && holidays[iso])) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/** Date range içindeki Mo-Fr ISO date listesi (Feiertage dahil, tracker urlaub için). */
function workdayDates(start: string, end: string): string[] {
  if (!start || !end) return [];
  const out: string[] = [];
  const cur = new Date(start);
  const endD = new Date(end);
  while (cur <= endD) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) out.push(isoOf(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** [s1,e1] ∩ [s2,e2] var mı? */
function rangesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 <= e2 && s2 <= e1;
}

/** Sonraki Brückentag (köprü günü): hafta içi tek gün, bir yanı Feiertag bir yanı hafta sonu/Feiertag. */
function nextBruckentag(fromISO: string, holidays: Record<string, string>): string | null {
  let cur = fromISO;
  for (let i = 0; i < 365; i++) {
    cur = addDays(cur, 1);
    if (isWeekendISO(cur) || holidays[cur]) continue;
    const prev = addDays(cur, -1);
    const next = addDays(cur, 1);
    const prevBlocked = isWeekendISO(prev) || !!holidays[prev];
    const nextBlocked = isWeekendISO(next) || !!holidays[next];
    if (prevBlocked && nextBlocked) return cur;
  }
  return null;
}

// ── Donut chart ─────────────────────────────────────────────────────────────
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

// ── Mini Jahres-Kalender (heatmap) ────────────────────────────────────────
const MONTH_NAMES = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

function YearHeatmap({
  year, urlaubDates, pendingDates, holidays, todayISO,
}: {
  year: number;
  urlaubDates: Set<string>;
  pendingDates: Set<string>;
  holidays: Record<string, string>;
  todayISO: string;
}) {
  // Jeder Monat eine Spalte (12), jede Zeile 1-31. Tek SVG; küçük rounded kareler.
  const cell = 11;
  const gap = 2;
  const headerH = 16;
  const W = 12 * (cell + gap) + 30; // +30 left labels
  const H = 31 * (cell + gap) + headerH + 4;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {/* Month headers */}
      {MONTH_NAMES.map((mn, m) => (
        <text
          key={mn}
          x={30 + m * (cell + gap) + cell / 2}
          y={11}
          fontSize="8"
          fill="var(--muted)"
          textAnchor="middle"
          fontWeight={700}
        >{mn}</text>
      ))}
      {/* Day labels (every 5th) */}
      {[1, 5, 10, 15, 20, 25, 30].map(day => (
        <text
          key={day}
          x={24}
          y={headerH + (day - 1) * (cell + gap) + cell / 2 + 3}
          fontSize="7"
          fill="var(--muted)"
          textAnchor="end"
          fontWeight={600}
        >{day}</text>
      ))}
      {/* Cells */}
      {Array.from({ length: 12 }, (_, m) => {
        const daysInMonth = new Date(year, m + 1, 0).getDate();
        return Array.from({ length: 31 }, (_, d) => {
          const x = 30 + m * (cell + gap);
          const y = headerH + d * (cell + gap);
          if (d >= daysInMonth) return null;
          const iso = `${year}-${String(m + 1).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`;
          const dow = new Date(iso).getDay();
          const isWE = dow === 0 || dow === 6;
          const isHoliday = !!holidays[iso];
          const isUrlaub = urlaubDates.has(iso);
          const isPending = pendingDates.has(iso);
          const isToday = iso === todayISO;

          let fill = "var(--surface2)";
          let stroke = "transparent";
          let opacity = 1;
          if (isUrlaub) fill = "var(--blue)";
          else if (isPending) fill = "var(--yellow)";
          else if (isHoliday) fill = "color-mix(in srgb, var(--yellow) 35%, transparent)";
          else if (isWE) { fill = "var(--surface2)"; opacity = 0.45; }
          if (isToday) stroke = "var(--accent2)";

          const tip = isUrlaub ? `${fmtDate(iso)} — Urlaub`
                    : isPending ? `${fmtDate(iso)} — Antrag ausstehend`
                    : isHoliday ? `${fmtDate(iso)} — ${holidays[iso]}`
                    : isWE ? `${fmtDate(iso)} — Wochenende`
                    : fmtDate(iso);
          return (
            <rect
              key={`${m}-${d}`}
              x={x} y={y}
              width={cell} height={cell}
              rx={2}
              fill={fill}
              fillOpacity={opacity}
              stroke={stroke}
              strokeWidth={isToday ? 1.5 : 0}
            >
              <title>{tip}</title>
            </rect>
          );
        });
      })}
    </svg>
  );
}

// ── Status Timeline ─────────────────────────────────────────────────────────
function StatusTimeline({ req }: { req: VacationRequest }) {
  const items: { label: string; date: string | null; color: string; done: boolean }[] = [
    { label: "Beantragt", date: req.created_at, color: "var(--accent2)", done: true },
  ];
  if (req.status === "approved") {
    items.push({ label: "Genehmigt", date: req.approved_at ?? req.created_at, color: "var(--green)", done: true });
  } else if (req.status === "rejected") {
    items.push({ label: "Abgelehnt", date: req.rejected_at ?? req.created_at, color: "var(--red)", done: true });
  } else {
    const daysOpen = req.created_at
      ? Math.floor((Date.now() - new Date(req.created_at).getTime()) / 86400000)
      : 0;
    items.push({ label: `Wartet seit ${daysOpen}T`, date: null, color: "var(--yellow)", done: false });
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%", background: it.color,
            opacity: it.done ? 1 : 0.4,
          }} />
          <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>
            {it.label}
            {it.date && <span style={{ marginLeft: 4, color: it.color }}>· {fmtDateTime(it.date)}</span>}
          </span>
          {i < items.length - 1 && (
            <span style={{ width: 14, height: 1, background: "var(--border)" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function VacationPage() {
  const [requests,  setRequests]  = useState<VacationRequest[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [profile,   setProfile]   = useState<Profile | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);

  // Form state
  const [startDate,  setStartDate]  = useState("");
  const [endDate,    setEndDate]    = useState("");
  const [urlaubArt,  setUrlaubArt]  = useState<UrlaubArt>("Erholungsurlaub");
  const [vertretung, setVertretung] = useState("");
  const [bemerkung,  setBemerkung]  = useState("");
  const [mailTo,        setMailTo]        = useState("");
  const [saving,        setSaving]        = useState(false);
  const [yearUsedDays,  setYearUsedDays]  = useState(0);
  const [overtimeMin,   setOvertimeMin]   = useState(0);
  const [vacTotal,      setVacTotal]      = useState(30);
  const [allUrlaubDates, setAllUrlaubDates] = useState<Set<string>>(new Set());
  const VAC_TOTAL = vacTotal;

  // Signature (draw only)
  const [sigData, setSigData] = useState<string | null>(null);
  const sigRef = useRef<SignatureCanvas>(null);

  const year = new Date().getFullYear();
  const todayISO = new Date().toISOString().slice(0, 10);
  const holidays = useMemo(
    () => getFeiertage(year, profile?.bundesland ?? "NI"),
    [year, profile?.bundesland]
  );

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) { setLoading(false); return; }

    const [{ data: reqs }, { data: prof }, { data: salary }] = await Promise.all([
      supabase.from("vacation_requests").select("*").eq("user_id", user.id).order("start_date", { ascending: false }),
      supabase.from("profiles").select("vorname,nachname,personal_nr,eintrittsdatum,abteilung,vorgesetzter,email,company_name,logo_data,signature_data,bundesland").eq("user_id", user.id).single(),
      supabase.from("salary_settings").select("urlaub_anspruch").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (salary?.urlaub_anspruch) setVacTotal(Number(salary.urlaub_anspruch));
    if (reqs) setRequests(reqs as VacationRequest[]);

    // Urlaub + overtime
    const yearStartISO = `${year}-01-01`;
    const { data: timeData } = await supabase
      .from("time_entries")
      .select("date, start_time, end_time, break_minutes, day_type")
      .eq("user_id", user.id)
      .gte("date", yearStartISO)
      .lte("date", `${year}-12-31`);

    if (timeData) {
      const { urlaubDays, overtimeMin } = computeOvertime(
        timeData as OvertimeEntry[],
        yearStartISO,
        todayISO,
      );
      setYearUsedDays(urlaubDays);
      setOvertimeMin(overtimeMin);
      // Heatmap için tüm urlaub ISO setleri
      const s = new Set<string>();
      for (const e of timeData as { date: string; day_type: string | null }[]) {
        if (e.day_type === "urlaub") s.add(e.date);
      }
      setAllUrlaubDates(s);
    }
    if (prof) {
      setProfile(prof as Profile);
      if (prof.signature_data) setSigData(prof.signature_data);
      if (prof.email) setMailTo(prof.email);
    }
    setLoading(false);
  }

  // ── Validation ─────────────────────────────────────────────────────────
  interface Validation {
    kind: "ok" | "warn" | "error";
    rawWorkdays: number;
    netWorkdays: number;
    feiertageInRange: string[];
    overlaps: VacationRequest[];
    inPast: boolean;
    insufficient: boolean;
    totalAvailable: number;
    msg: string;
  }
  const validation = useMemo<Validation | null>(() => {
    if (!startDate || !endDate) return null;
    const base: Validation = {
      kind: "ok", rawWorkdays: 0, netWorkdays: 0,
      feiertageInRange: [], overlaps: [], inPast: false,
      insufficient: false, totalAvailable: 0, msg: "",
    };
    if (endDate < startDate) {
      return { ...base, kind: "error", msg: "Endedatum liegt vor Startdatum." };
    }

    const rawWorkdays = calcWorkdays(startDate, endDate);
    const netWorkdays = calcWorkdays(startDate, endDate, holidays);
    const feiertageInRange: string[] = [];
    const cur = new Date(startDate);
    const endD = new Date(endDate);
    while (cur <= endD) {
      const iso = isoOf(cur);
      if (holidays[iso] && !isWeekendISO(iso)) feiertageInRange.push(`${holidays[iso]} (${fmtDate(iso)})`);
      cur.setDate(cur.getDate() + 1);
    }

    const overlaps = requests.filter(r =>
      r.status !== "rejected" && rangesOverlap(startDate, endDate, r.start_date, r.end_date)
    );

    const inPast = startDate < todayISO;

    const remaining = VAC_TOTAL - yearUsedDays;
    const overtimeDays = Math.floor(overtimeMin / 60 / 8);
    const totalAvailable = urlaubArt === "Überstundenabbau" ? overtimeDays : remaining;
    const insufficient = urlaubArt !== "Unbezahlter Urlaub"
      && urlaubArt !== "Elternzeit"
      && urlaubArt !== "Sonderurlaub"
      && netWorkdays > totalAvailable;

    const kind: Validation["kind"] = (overlaps.length > 0 || insufficient) ? "error"
                : (feiertageInRange.length > 0 || inPast) ? "warn"
                : "ok";
    return { kind, rawWorkdays, netWorkdays, feiertageInRange, overlaps, inPast, insufficient, totalAvailable, msg: "" };
  }, [startDate, endDate, requests, holidays, yearUsedDays, overtimeMin, urlaubArt, todayISO, VAC_TOTAL]);

  const days = validation && validation.kind !== "error"
    ? validation.netWorkdays
    : calcWorkdays(startDate, endDate, holidays);

  // ── Quick presets ──────────────────────────────────────────────────────
  function applyPreset(kind: "today" | "tomorrow" | "1w" | "2w" | "bruecke") {
    if (kind === "today") {
      setStartDate(todayISO);
      setEndDate(todayISO);
    } else if (kind === "tomorrow") {
      const t = addDays(todayISO, 1);
      setStartDate(t);
      setEndDate(t);
    } else if (kind === "1w") {
      const s = addDays(todayISO, 1);
      setStartDate(s);
      setEndDate(addDays(s, 6));
    } else if (kind === "2w") {
      const s = addDays(todayISO, 1);
      setStartDate(s);
      setEndDate(addDays(s, 13));
    } else if (kind === "bruecke") {
      const b = nextBruckentag(todayISO, holidays);
      if (b) {
        setStartDate(b);
        setEndDate(b);
      } else {
        alert("Kein Brückentag in den nächsten 12 Monaten gefunden.");
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validation?.kind === "error") {
      const proceed = confirm("Es gibt Warnungen. Trotzdem einreichen?");
      if (!proceed) return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setSaving(false); return; }
    const userId = session.user.id;

    await supabase.from("vacation_requests").insert({
      user_id:    userId,
      start_date: startDate,
      end_date:   endDate,
      days_count: days,
      reason:     bemerkung || null,
      urlaub_art: urlaubArt,
      vertretung: vertretung || null,
      status:     "pending",
    });

    // time_entries sync
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
    setStartDate(""); setEndDate(""); setBemerkung(""); setVertretung("");
    void load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Antrag wirklich löschen?")) return;
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    const toDelete = requests.find(r => r.id === id);
    await supabase.from("vacation_requests").delete().eq("id", id);
    if (toDelete && userId) {
      const dates = workdayDates(toDelete.start_date, toDelete.end_date);
      if (dates.length > 0) {
        await supabase
          .from("time_entries").delete()
          .eq("user_id", userId).eq("day_type", "urlaub").in("date", dates);
      }
    }
    void load();
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

    doc.setFillColor(26, 26, 46);
    doc.rect(0, 0, 210, 38, "F");
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

    doc.setFillColor(240, 240, 245);
    doc.rect(15, y - 6, 180, 59, "F");
    doc.setFontSize(8);
    doc.setTextColor(107, 107, 128);
    doc.text("URLAUBSDATEN", 20, y);
    y += 6;
    pdfRow(doc, "Von:",          fmtDate(startDate),         y); y += 7;
    pdfRow(doc, "Bis:",          fmtDate(endDate),           y); y += 7;
    pdfRow(doc, "Arbeitstage:",  `${days} Tage`,             y); y += 7;
    pdfRow(doc, "Urlaubsart:",   urlaubArt,                   y); y += 7;
    pdfRow(doc, "Vertretung:",   vertretung || "—",           y); y += 7;
    pdfRow(doc, "Bemerkungen:",  bemerkung || "—",            y); y += 7;
    y += 10;

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

    doc.setFontSize(8);
    doc.setTextColor(107, 107, 128);
    doc.text(`Erstellt am ${heute} · ${STUNDLY_VERSION_LABEL}`, 20, 285);

    const fname = `${p?.nachname ?? "Urlaub"}_${startDate}_${endDate}`.replace(/\s/g, "_");
    doc.save(`Urlaubsantrag_${fname}.pdf`);

    if (mailTo) {
      const subject = encodeURIComponent(`Urlaubsantrag ${p?.vorname ?? ""} ${p?.nachname ?? ""} — ${fmtDate(startDate)} bis ${fmtDate(endDate)}`);
      const body = encodeURIComponent(
        `Sehr geehrte/r Damen und Herren,\n\nhiermit beantrage ich Urlaub vom ${fmtDate(startDate)} bis ${fmtDate(endDate)} (${days} Arbeitstage).\nUrlaubsart: ${urlaubArt}${vertretung ? "\nVertretung: " + vertretung : ""}${bemerkung ? "\nBemerkung: " + bemerkung : ""}\n\nMit freundlichen Grüßen\n${p?.vorname ?? ""} ${p?.nachname ?? ""}`
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

  // Pending dates set for heatmap
  const pendingDates = useMemo(() => {
    const s = new Set<string>();
    for (const r of requests) {
      if (r.status !== "pending") continue;
      const dates = workdayDates(r.start_date, r.end_date);
      for (const d of dates) s.add(d);
    }
    return s;
  }, [requests]);

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
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 14 }}>
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
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 14 }}>
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

        {/* ── Mini Jahres-Kalender (Heatmap) ── */}
        <div style={{
          marginTop: 12, background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 16, padding: 14,
        }}>
          <button
            onClick={() => setShowHeatmap(v => !v)}
            style={{
              all: "unset", cursor: "pointer", width: "100%",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: showHeatmap ? 10 : 0,
            }}
          >
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Jahresübersicht {year}
            </div>
            <span style={{ fontSize: 14, color: "var(--muted)" }}>{showHeatmap ? "▾" : "▸"}</span>
          </button>
          {showHeatmap && (
            <>
              <YearHeatmap
                year={year}
                urlaubDates={allUrlaubDates}
                pendingDates={pendingDates}
                holidays={holidays}
                todayISO={todayISO}
              />
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 12, fontSize: 10, color: "var(--muted)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--blue)" }} /> Urlaub genommen
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--yellow)" }} /> Antrag ausstehend
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "color-mix(in srgb, var(--yellow) 35%, transparent)" }} /> Feiertag
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--surface2)", opacity: 0.5 }} /> Wochenende
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ padding: "14px 16px", paddingBottom: 40, maxWidth: 960, margin: "0 auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: "40px 0" }}>Laden...</div>
        ) : requests.length === 0 ? (
          <div style={{
            background: "linear-gradient(135deg, color-mix(in srgb, var(--blue) 12%, var(--surface)) 0%, color-mix(in srgb, var(--accent2) 8%, var(--surface)) 100%)",
            border: "1px solid color-mix(in srgb, var(--blue) 25%, transparent)",
            borderRadius: 16, padding: "28px 22px", textAlign: "center",
          }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🏖</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
              Noch keine Urlaubsanträge
            </div>
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 18, maxWidth: 420, margin: "0 auto 18px" }}>
              Erstelle deinen ersten Urlaubsantrag. Stundly generiert das PDF mit deiner Unterschrift und füllt automatisch die Tracker-Tage als <strong style={{ color: "var(--blue)" }}>Urlaub</strong>.
            </p>
            <button
              onClick={() => setShowForm(true)}
              style={{
                padding: "12px 24px", background: "var(--blue)", color: "white",
                border: "none", borderRadius: 10, fontFamily: "'Syne',sans-serif",
                fontSize: 13, fontWeight: 800, cursor: "pointer",
              }}
            >
              ➕ Ersten Antrag erstellen
            </button>
          </div>
        ) : (
          requests.map((r) => (
            <div key={r.id} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    {fmtDate(r.start_date)} – {fmtDate(r.end_date)}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>
                    {r.days_count} Tage
                    {r.urlaub_art && r.urlaub_art !== "Erholungsurlaub" && (
                      <span style={{
                        marginLeft: 8,
                        background: "color-mix(in srgb, var(--accent2) 15%, transparent)",
                        color: "var(--accent2)", padding: "2px 8px", borderRadius: 10,
                        fontSize: 10, fontWeight: 700,
                      }}>
                        {r.urlaub_art}
                      </span>
                    )}
                  </div>
                  {r.vertretung && (
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                      <span style={{ fontWeight: 700 }}>Vertretung:</span> {r.vertretung}
                    </div>
                  )}
                  {r.reason && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{r.reason}</div>}
                  <StatusTimeline req={r} />
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
              {/* Quick presets */}
              <div>
                <div className="label" style={{ marginBottom: 6 }}>Schnellauswahl</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {[
                    { k: "today" as const,    label: "Heute" },
                    { k: "tomorrow" as const, label: "Morgen" },
                    { k: "1w" as const,       label: "1 Woche" },
                    { k: "2w" as const,       label: "2 Wochen" },
                    { k: "bruecke" as const,  label: "Brückentag" },
                  ].map(p => (
                    <button
                      key={p.k}
                      type="button"
                      onClick={() => applyPreset(p.k)}
                      style={{
                        padding: "6px 12px", borderRadius: 18,
                        background: "var(--surface2)", border: "1px solid var(--border)",
                        color: "var(--text)", fontSize: 11, fontWeight: 700, cursor: "pointer",
                        fontFamily: "'Syne',sans-serif",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

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

              {/* Validation banner */}
              {validation && (
                <div style={{
                  background: validation.kind === "error"
                    ? "color-mix(in srgb, var(--red) 10%, transparent)"
                    : validation.kind === "warn"
                    ? "color-mix(in srgb, var(--yellow) 10%, transparent)"
                    : "color-mix(in srgb, var(--green) 10%, transparent)",
                  border: `1px solid color-mix(in srgb, ${
                    validation.kind === "error" ? "var(--red)"
                    : validation.kind === "warn" ? "var(--yellow)"
                    : "var(--green)"
                  } 30%, transparent)`,
                  borderRadius: 10, padding: "10px 14px",
                  display: "flex", flexDirection: "column", gap: 4,
                }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    color: validation.kind === "error" ? "var(--red)"
                         : validation.kind === "warn" ? "var(--yellow)"
                         : "var(--green)",
                  }}>
                    {validation.kind === "ok" && `✅ ${validation.netWorkdays} Arbeitstage`}
                    {validation.kind === "warn" && `⚠ ${validation.netWorkdays} Arbeitstage (${validation.rawWorkdays - validation.netWorkdays > 0 ? validation.rawWorkdays + " roh − " + (validation.rawWorkdays - validation.netWorkdays) + " Feiertage" : "kein Verlust"})`}
                    {validation.kind === "error" && `❌ Bitte Eingaben prüfen`}
                  </div>
                  {validation.feiertageInRange.length > 0 && (
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      Im Zeitraum: {validation.feiertageInRange.join(", ")}
                    </div>
                  )}
                  {validation.inPast && (
                    <div style={{ fontSize: 11, color: "var(--yellow)" }}>
                      ℹ Startdatum liegt in der Vergangenheit
                    </div>
                  )}
                  {validation.overlaps.length > 0 && (
                    <div style={{ fontSize: 11, color: "var(--red)" }}>
                      ⚠ Überlappt mit {validation.overlaps.length} Antrag/Anträgen ({validation.overlaps.map(o => fmtDate(o.start_date)).join(", ")})
                    </div>
                  )}
                  {validation.insufficient && (
                    <div style={{ fontSize: 11, color: "var(--red)" }}>
                      ⚠ Guthaben reicht nicht: {validation.totalAvailable} verfügbar, {validation.netWorkdays} angefragt
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="label">Urlaubsart</label>
                <select
                  className="input"
                  value={urlaubArt}
                  onChange={e => setUrlaubArt(e.target.value as UrlaubArt)}
                >
                  {URLAUB_ARTEN.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Vertretung (optional)</label>
                <input
                  className="input" type="text" value={vertretung}
                  onChange={e => setVertretung(e.target.value)}
                  placeholder="z.B. Max Mustermann"
                />
              </div>

              <div>
                <label className="label">Bemerkungen (optional)</label>
                <input className="input" type="text" value={bemerkung} onChange={e => setBemerkung(e.target.value)} placeholder="Optional..." />
              </div>

              <div>
                <label className="label">📧 Mail-Empfänger</label>
                <input className="input" type="email" value={mailTo} onChange={e => setMailTo(e.target.value)} />
              </div>

              {/* Signature */}
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

              <button className="btn btn-primary" type="submit" disabled={saving || !startDate || !endDate} style={{ width: "100%" }}>
                {saving ? "Senden..." : "💾 Antrag speichern"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
