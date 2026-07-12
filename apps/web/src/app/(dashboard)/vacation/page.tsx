"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import SignatureCanvas from "react-signature-canvas";
import type { VacationRequest, UrlaubArt } from "@workly/shared";
import { URLAUB_ARTEN } from "@workly/shared";
import { computeOvertime, type OvertimeEntry, type OvertimeNdEntry } from "@/lib/vacation/overtime";
import { getFeiertage } from "@/lib/utils/feiertage";
import { STUNDLY_VERSION_LABEL } from "@/lib/version";
import { Skeleton } from "@/components/ui/Skeleton";

interface Profile {
  vorname: string; nachname: string; personal_nr: string;
  eintrittsdatum: string; abteilung: string; vorgesetzter: string;
  email: string; company_name: string | null; logo_data: string | null;
  signature_data: string | null; bundesland: string;
  firma_strasse:  string | null;
  firma_plz:      string | null;
  firma_ort:      string | null;
  firma_telefon:  string | null;
}

// ── Inline SVG Icons ────────────────────────────────────────────────────────
function Icon({ name, size = 14, color = "currentColor", strokeWidth = 2 }: {
  name: "plus" | "clock" | "calendar" | "user" | "check" | "chevron-right" | "x"
      | "flag" | "hourglass" | "edit" | "trash" | "send" | "moon" | "briefcase"
      | "umbrella" | "alert" | "info";
  size?: number; color?: string; strokeWidth?: number;
}) {
  const paths: Record<string, React.ReactNode> = {
    plus:        <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    clock:       <><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></>,
    calendar:    <><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/></>,
    user:        <><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></>,
    check:       <polyline points="20 6 9 17 4 12"/>,
    "chevron-right": <polyline points="9 6 15 12 9 18"/>,
    x:           <><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></>,
    flag:        <><path d="M5 21v-18"/><path d="M5 4h13l-2.5 4.5L18 13H5"/></>,
    hourglass:   <><path d="M6 3h12"/><path d="M6 21h12"/><path d="M6 3v3a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><path d="M6 21v-3a6 6 0 0 1 6-6 6 6 0 0 1 6 6v3"/></>,
    edit:        <><path d="M11 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/><polygon points="18 2 22 6 12 16 8 16 8 12"/></>,
    trash:       <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></>,
    send:        <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    moon:        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>,
    briefcase:   <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
    umbrella:    <><path d="M12 2v3"/><path d="M2 12a10 10 0 0 1 20 0"/><path d="M12 12v7a3 3 0 0 1-6 0"/></>,
    alert:       <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></>,
    info:        <><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="8"/><line x1="12" y1="12" x2="12" y2="16"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle" }}
    >{paths[name]}</svg>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
function fmtDateShort(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
}
function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "heute";
  if (days === 1) return "gestern";
  if (days < 7) return `vor ${days} Tagen`;
  if (days < 30) return `vor ${Math.floor(days / 7)} Wochen`;
  if (days < 365) return `vor ${Math.floor(days / 30)} Monaten`;
  return fmtDate(iso);
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
function rangesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 <= e2 && s2 <= e1;
}
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

const URLAUB_ART_COLORS: Record<UrlaubArt, string> = {
  "Erholungsurlaub":     "var(--accent2)",
  "Sonderurlaub":        "var(--orange)",
  "Bildungsurlaub":      "var(--blue)",
  "Unbezahlter Urlaub":  "var(--muted)",
  "Elternzeit":          "var(--green)",
  "Überstundenabbau":    "var(--blue)",
};
const URLAUB_ART_SHORT: Record<UrlaubArt, string> = {
  "Erholungsurlaub":     "ERHOLUNG",
  "Sonderurlaub":        "SONDER",
  "Bildungsurlaub":      "BILDUNG",
  "Unbezahlter Urlaub":  "UNBEZAHLT",
  "Elternzeit":          "ELTERN",
  "Überstundenabbau":    "ÜBERSTD.",
};

const STATUS_INFO: Record<VacationRequest["status"], { label: string; color: string; bg: string }> = {
  pending:  { label: "Wartet",    color: "var(--yellow)", bg: "rgba(251,191,36,0.15)" },
  approved: { label: "Genehmigt", color: "var(--green)",  bg: "rgba(52,211,153,0.15)" },
  rejected: { label: "Abgelehnt", color: "var(--red)",    bg: "rgba(248,113,113,0.15)" },
};

// ── Page ────────────────────────────────────────────────────────────────────
export default function VacationPage() {
  const [requests,  setRequests]  = useState<VacationRequest[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [profile,   setProfile]   = useState<Profile | null>(null);

  const [startDate,  setStartDate]  = useState("");
  const [endDate,    setEndDate]    = useState("");
  const [urlaubArt,  setUrlaubArt]  = useState<UrlaubArt>("Erholungsurlaub");
  const [vertretung, setVertretung] = useState("");
  const [bemerkung,  setBemerkung]  = useState("");
  const [mailTo,     setMailTo]     = useState("");
  const [saving,     setSaving]     = useState(false);
  const [yearUsedDays,  setYearUsedDays]  = useState(0);
  const [overtimeMin,   setOvertimeMin]   = useState(0);
  const [vacTotal,      setVacTotal]      = useState(30);
  const [allUrlaubDates, setAllUrlaubDates] = useState<Set<string>>(new Set());
  const VAC_TOTAL = vacTotal;

  const [sigData, setSigData] = useState<string | null>(null);
  const sigRef = useRef<SignatureCanvas>(null);

  const year = new Date().getFullYear();
  const todayISO = new Date().toISOString().slice(0, 10);
  const holidays = useMemo(
    () => getFeiertage(year, profile?.bundesland ?? "NI"),
    [year, profile?.bundesland]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);
  // Body scroll lock when panel open
  useEffect(() => {
    if (showForm) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [showForm]);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) { setLoading(false); return; }

    const yearStartISO = `${year}-01-01`;
    const yearEndISO   = `${year}-12-31`;
    const [{ data: reqs }, { data: prof }, { data: salary }, { data: timeData }, { data: ndData }] = await Promise.all([
      supabase.from("vacation_requests").select("*").eq("user_id", user.id).order("start_date", { ascending: false }),
      supabase.from("profiles").select("vorname,nachname,personal_nr,eintrittsdatum,abteilung,vorgesetzter,email,company_name,logo_data,signature_data,bundesland,firma_strasse,firma_plz,firma_ort,firma_telefon").eq("user_id", user.id).single(),
      supabase.from("salary_settings").select("urlaub_anspruch, monthly_target_hours").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("time_entries")
        .select("date, start_time, end_time, break_minutes, day_type")
        .eq("user_id", user.id).gte("date", yearStartISO).lte("date", yearEndISO),
      supabase.from("notdienst_entries")
        .select("date, start_time, end_time")
        .eq("user_id", user.id).gte("date", yearStartISO).lte("date", yearEndISO),
    ]);

    if (salary?.urlaub_anspruch) setVacTotal(Number(salary.urlaub_anspruch));
    if (reqs) setRequests(reqs as VacationRequest[]);

    // monthly_target_hours → günlük hedef (21.7 ortalama iş günü/ay).
    // Default Almanya tam zamanlı: 173h/ay → ~7.97h/gün ≈ 8h.
    const monthlyHours = salary?.monthly_target_hours ? Number(salary.monthly_target_hours) : 173;
    const hoursPerDay  = monthlyHours / 21.7;

    if (timeData) {
      const { urlaubDays, overtimeMin } = computeOvertime(
        timeData as OvertimeEntry[],
        yearStartISO,
        todayISO,
        {
          ndEntries: (ndData ?? []) as OvertimeNdEntry[],
          hoursPerDay,
        },
      );
      setYearUsedDays(urlaubDays);
      setOvertimeMin(overtimeMin);
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

  // ── Computed ──────────────────────────────────────────────────────────────
  const remainingDays = VAC_TOTAL - yearUsedDays;
  const overtimeDays  = Math.floor(overtimeMin / 60 / 8);
  const overtimeHours = Math.round(overtimeMin / 60 * 10) / 10;
  const totalAvailable = remainingDays + overtimeDays;
  const usedPercent = VAC_TOTAL > 0 ? Math.round((yearUsedDays / VAC_TOTAL) * 100) : 0;
  const remainingPercent = 100 - usedPercent;

  const pendingCount = requests.filter(r => r.status === "pending").length;

  // Ay başına urlaub gün sayısı
  const monthCounts = useMemo(() => {
    const c = new Array(12).fill(0);
    for (const iso of allUrlaubDates) {
      const m = parseInt(iso.slice(5, 7), 10) - 1;
      if (m >= 0 && m < 12) c[m]++;
    }
    return c;
  }, [allUrlaubDates]);

  const maxMonthCount = Math.max(1, ...monthCounts);
  const currentMonth = new Date().getMonth();

  // Sonraki urlaub (bugünden sonra, pending veya approved)
  const nextVacation = useMemo(() => {
    const future = requests
      .filter(r => r.status !== "rejected" && r.start_date >= todayISO)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
    return future[0] ?? null;
  }, [requests, todayISO]);

  const daysUntilNext = nextVacation
    ? Math.ceil((new Date(nextVacation.start_date).getTime() - Date.now()) / 86400000)
    : null;

  // ── Validation ────────────────────────────────────────────────────────────
  interface Validation {
    kind: "ok" | "warn" | "error";
    rawWorkdays: number;
    netWorkdays: number;
    feiertageInRange: string[];
    overlaps: VacationRequest[];
    inPast: boolean;
    insufficient: boolean;
    totalAvailableForArt: number;
  }
  const validation = useMemo<Validation | null>(() => {
    if (!startDate || !endDate) return null;
    if (endDate < startDate) {
      return {
        kind: "error", rawWorkdays: 0, netWorkdays: 0,
        feiertageInRange: [], overlaps: [], inPast: false,
        insufficient: false, totalAvailableForArt: 0,
      };
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
    const totalAvailableForArt = urlaubArt === "Überstundenabbau" ? overtimeDays : remainingDays;
    const insufficient = !["Unbezahlter Urlaub", "Elternzeit", "Sonderurlaub"].includes(urlaubArt)
      && netWorkdays > totalAvailableForArt;
    const kind: Validation["kind"] = (overlaps.length > 0 || insufficient) ? "error"
                : (feiertageInRange.length > 0 || inPast) ? "warn"
                : "ok";
    return { kind, rawWorkdays, netWorkdays, feiertageInRange, overlaps, inPast, insufficient, totalAvailableForArt };
  }, [startDate, endDate, requests, holidays, urlaubArt, todayISO, remainingDays, overtimeDays]);

  const days = validation ? validation.netWorkdays : 0;

  // ── Quick presets ─────────────────────────────────────────────────────────
  function applyPreset(kind: "today" | "tomorrow" | "1w" | "2w" | "bruecke") {
    if (kind === "today") {
      setStartDate(todayISO); setEndDate(todayISO);
    } else if (kind === "tomorrow") {
      const t = addDays(todayISO, 1); setStartDate(t); setEndDate(t);
    } else if (kind === "1w") {
      const s = addDays(todayISO, 1); setStartDate(s); setEndDate(addDays(s, 6));
    } else if (kind === "2w") {
      const s = addDays(todayISO, 1); setStartDate(s); setEndDate(addDays(s, 13));
    } else if (kind === "bruecke") {
      const b = nextBruckentag(todayISO, holidays);
      if (b) { setStartDate(b); setEndDate(b); }
      else alert("Kein Brückentag in den nächsten 12 Monaten gefunden.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validation?.kind === "error") {
      if (!confirm("Es gibt Warnungen. Trotzdem einreichen?")) return;
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
    const dates = workdayDates(startDate, endDate);
    if (dates.length > 0) {
      const rows = dates.map(date => ({
        user_id: userId, date, day_type: "urlaub" as const,
        start_time: null, end_time: null, break_minutes: 0,
        is_night_shift: false, note: bemerkung || null, tags: [] as string[],
      }));
      await supabase.from("time_entries").upsert(rows, { onConflict: "user_id,date" });
    }

    // "Antrag einreichen" için beklenen davranış: kaydet + PDF indir + mail
    // aç. mailTo boşsa sadece kayıt (mail göndermek istemeyen kullanıcı için
    // escape hatch: MAIL-EMPFÄNGER alanını boşalt).
    if (mailTo) {
      await generatePDF();
    }

    setSaving(false); setShowForm(false);
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
        await supabase.from("time_entries").delete()
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

  async function generatePDF() {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const p = profile;

    // Sayfa boyutları — A4: 210×297mm, sol margin 18, sağ margin 192
    const W = 210, L = 18, R = 192, CW = R - L;
    let y = 15;

    // ── LOGO (merkezî, üstte, 16×16) ──────────────────────────────────────
    if (p?.logo_data) {
      try {
        doc.addImage(p.logo_data, "PNG", W / 2 - 8, y, 16, 16);
        y += 19;
      } catch {
        y += 2;
      }
    }

    // ── HEADER — firma adı + adres + separator ────────────────────────────
    doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
    doc.text(p?.company_name || "Stundly", W / 2, y, { align: "center" });
    y += 4.5;

    // Adres satırı: "Straße - PLZ Ort | Tel." (mevcut olanları birleştir)
    const addressParts: string[] = [];
    if (p?.firma_strasse) addressParts.push(p.firma_strasse);
    if (p?.firma_plz || p?.firma_ort) {
      addressParts.push(`${p?.firma_plz ?? ""} ${p?.firma_ort ?? ""}`.trim());
    }
    const addrLine1 = addressParts.join(" - ");
    const addrLine2 = p?.firma_telefon ? `Tel. ${p.firma_telefon}` : "";
    const headerLine = [addrLine1, addrLine2].filter(Boolean).join(" | ");
    if (headerLine) {
      doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
      doc.text(headerLine, W / 2, y, { align: "center" });
      y += 3;
    }
    doc.setDrawColor(80); doc.setLineWidth(0.5); doc.line(L, y, R, y); y += 7;

    // ── TITLE ─────────────────────────────────────────────────────────────
    doc.setFontSize(15); doc.setFont("helvetica", "bold");
    doc.text("URLAUBSANTRAG", W / 2, y, { align: "center" }); y += 9;

    // ── Helpers: gri section bar + label:value row ────────────────────────
    function sec(t: string) {
      doc.setFillColor(235, 235, 235); doc.rect(L, y - 3, CW, 5.5, "F");
      doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.setTextColor(50);
      doc.text(t, L + 3, y + 0.5); doc.setTextColor(0);
      y += 6;
    }
    function rw(lbl: string, val: string) {
      doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text(lbl, L + 2, y);
      doc.setFont("helvetica", "normal");
      doc.text(val || "", L + 40, y);
      doc.setDrawColor(220); doc.setLineWidth(0.1); doc.line(L, y + 1.5, R, y + 1.5);
      y += 4.5;
    }

    // ── MITARBEITER ───────────────────────────────────────────────────────
    sec("MITARBEITER");
    rw("Name:",           p?.nachname       ?? "");
    rw("Vorname:",        p?.vorname        ?? "");
    rw("Personal-Nr.:",   p?.personal_nr    ?? "");
    rw("Eintrittsdatum:", p?.eintrittsdatum ?? "");
    rw("Abteilung:",      p?.abteilung      ?? "");
    rw("Vorgesetzte/r:",  p?.vorgesetzter   ?? "");
    if (vertretung) rw("Vertretung:", vertretung);
    y += 2;

    // ── URLAUBSÜBERSICHT ──────────────────────────────────────────────────
    sec("URLAUBSUEBERSICHT");
    rw("Jahresurlaub:", `${VAC_TOTAL} Tage`);
    rw("Resturlaub:",   `${Math.max(0, remainingDays - days)} Tage`);
    y += 2;

    // ── URLAUBSZEITRAEUME — tablo ─────────────────────────────────────────
    sec("URLAUBSZEITRAEUME");

    // Koyu header row (Von | Bis | Anz. Tage | Urlaubsart)
    doc.setFillColor(55, 55, 55); doc.rect(L, y - 3, CW, 6, "F");
    doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(255);
    doc.text("Von",        L + 3,   y + 0.5);
    doc.text("Bis",        L + 38,  y + 0.5);
    doc.text("Anz. Tage",  L + 78,  y + 0.5);
    doc.text("Urlaubsart", L + 110, y + 0.5);
    doc.setTextColor(0);
    y += 6;

    // Data row
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(fmtDate(startDate), L + 3,   y);
    doc.text(fmtDate(endDate),   L + 38,  y);
    doc.text(String(days),       L + 78,  y);
    doc.text(urlaubArt,          L + 110, y);
    doc.setDrawColor(180); doc.rect(L, y - 3, CW, 6);
    y += 6;

    // Gesamt row
    doc.setFont("helvetica", "bold");
    doc.text("Gesamt:", L + 62, y);
    doc.text(String(days), L + 78, y);
    doc.rect(L, y - 3, CW, 6);
    y += 8;

    // ── BEMERKUNGEN (varsa) ───────────────────────────────────────────────
    if (bemerkung) {
      sec("BEMERKUNGEN");
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      const bl = doc.splitTextToSize(bemerkung, CW - 6);
      doc.text(bl, L + 2, y);
      y += bl.length * 3.5 + 3;
    }

    // ── SIGNATURE — alt kısımda 2 sütun ──────────────────────────────────
    const heuteStr = new Date().toLocaleDateString("de-DE");
    let sigY = Math.max(y + 18, 240);
    if (sigY > 268) sigY = 268;
    doc.setDrawColor(80); doc.setLineWidth(0.3);

    // Sol: Arbeitnehmer (imza + tarih)
    if (sigData) {
      try { doc.addImage(sigData, "PNG", L + 5, sigY - 20, 50, 16); } catch { /* ignore */ }
    }
    doc.line(L, sigY, L + 72, sigY);
    doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.text(`Arbeitnehmer/in  -  ${heuteStr}`, L + 36, sigY + 4, { align: "center" });

    // Sağ: Vorgesetzte/r (boş, arbeitgeber tarafından imzalanacak)
    doc.line(R - 72, sigY, R, sigY);
    doc.text("Vorgesetzte/r  -  Datum", R - 36, sigY + 4, { align: "center" });

    // Version footer
    doc.setFontSize(6); doc.setTextColor(150);
    doc.text(STUNDLY_VERSION_LABEL, W / 2, 290, { align: "center" });

    // ── SAVE + MAIL ───────────────────────────────────────────────────────
    const fname = `${p?.nachname ?? "Urlaub"}_${startDate}_${endDate}`.replace(/\s/g, "_");
    doc.save(`Urlaubsantrag_${fname}.pdf`);

    if (mailTo) {
      const subject = encodeURIComponent(
        `Urlaubsantrag ${p?.vorname ?? ""} ${p?.nachname ?? ""} — ${fmtDate(startDate)} bis ${fmtDate(endDate)}`
      );
      const body = encodeURIComponent(
        `Sehr geehrte Damen und Herren,\n\n` +
        `hiermit beantrage ich Urlaub vom ${fmtDate(startDate)} bis ${fmtDate(endDate)} (${days} Arbeitstage).\n` +
        `Den unterschriebenen Urlaubsantrag finden Sie im Anhang als PDF.\n\n` +
        `Mit freundlichen Grüßen\n${p?.vorname ?? ""} ${p?.nachname ?? ""}`
      );
      // Kaydet+PDF akışında mailto'yu kısa gecikmeyle aç, PDF download çakışmasın
      setTimeout(() => {
        window.open(`mailto:${mailTo}?subject=${subject}&body=${body}`, "_self");
      }, 800);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 60px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, letterSpacing: "0.08em", fontFamily: "'Syne',sans-serif" }}>
              URLAUB · {year}
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 2, fontFamily: "'Syne',sans-serif" }}>
              Deine freie Zeit
            </h1>
          </div>
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: "10px 18px", background: "var(--accent2)", color: "#1a1a2e",
              border: "none", borderRadius: 999, fontWeight: 800, fontSize: 12,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              fontFamily: "'Syne',sans-serif",
              boxShadow: "0 4px 16px color-mix(in srgb, var(--accent2) 35%, transparent)",
            }}
          >
            <Icon name="plus" size={14} color="#1a1a2e" strokeWidth={2.5} />
            Neuer Antrag
          </button>
        </div>

        {/* ── HERO CARD ─────────────────────────────────────────────────── */}
        <div style={{
          background: "linear-gradient(135deg, color-mix(in srgb, var(--accent2) 18%, var(--surface)) 0%, color-mix(in srgb, var(--blue) 12%, var(--surface)) 100%)",
          border: "1px solid color-mix(in srgb, var(--accent2) 25%, transparent)",
          borderRadius: 18, padding: "22px 24px", marginBottom: 14,
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: -40, right: -30, width: 180, height: 180,
            background: "radial-gradient(circle, color-mix(in srgb, var(--accent2) 35%, transparent) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />
          <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 10, color: "color-mix(in srgb, var(--accent2) 75%, white)", fontWeight: 800, letterSpacing: "0.1em", marginBottom: 4 }}>
                VERFÜGBAR
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 64, fontWeight: 500, lineHeight: 1, color: "white" }}>
                {totalAvailable}
                <span style={{ fontSize: 22, color: "color-mix(in srgb, var(--accent2) 75%, white)", marginLeft: 6 }}>Tage</span>
              </div>
              <div style={{ fontSize: 12, color: "color-mix(in srgb, var(--accent2) 70%, white)", marginTop: 8 }}>
                {yearUsedDays} genommen
                {overtimeDays > 0 && (
                  <>
                    <span style={{ margin: "0 6px", opacity: 0.4 }}>·</span>
                    <span style={{ color: "var(--blue)" }}>+{overtimeDays} aus Überstunden</span>
                  </>
                )}
              </div>
            </div>
            <div style={{ position: "relative" }}>
              <svg width="84" height="84" viewBox="0 0 84 84">
                <circle cx="42" cy="42" r="36" fill="none"
                  stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                <circle cx="42" cy="42" r="36" fill="none"
                  stroke="var(--accent2)" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${(remainingPercent / 100) * 2 * Math.PI * 36} ${2 * Math.PI * 36}`}
                  transform="rotate(-90 42 42)"
                />
                <text x="42" y="47" textAnchor="middle" fontSize="14" fill="white"
                  fontWeight="700" fontFamily="'DM Mono', monospace">
                  {remainingPercent}%
                </text>
              </svg>
            </div>
          </div>

          {/* Progress pill bar */}
          <div style={{
            marginTop: 18, height: 6, background: "rgba(255,255,255,0.06)",
            borderRadius: 999, overflow: "hidden", display: "flex",
          }}>
            <div style={{ width: `${usedPercent}%`, background: "var(--accent2)", borderRadius: 999 }} />
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between", marginTop: 6,
            fontSize: 10, color: "var(--muted)", fontWeight: 600,
          }}>
            <span>{yearUsedDays} von {VAC_TOTAL}</span>
            <span>{VAC_TOTAL} Tage Jahresanspruch</span>
          </div>
        </div>

        {/* ── 12-MONTH BAR TIMELINE ────────────────────────────────────── */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 14, padding: "14px 16px", marginBottom: 14,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, letterSpacing: "0.08em" }}>
              JAHR · {year}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>
              {allUrlaubDates.size} Urlaubstage gesamt
            </div>
          </div>
          <div style={{ display: "flex", gap: 3, alignItems: "stretch", height: 56 }}>
            {monthCounts.map((c, m) => {
              const heightPct = c === 0 ? 0 : Math.max(8, (c / maxMonthCount) * 100);
              const isCurrent = m === currentMonth;
              return (
                <div key={m} style={{
                  flex: 1, position: "relative",
                  background: isCurrent ? "color-mix(in srgb, var(--accent2) 18%, transparent)" : "rgba(255,255,255,0.04)",
                  border: isCurrent ? "1px solid var(--accent2)" : "1px solid transparent",
                  borderRadius: 4, display: "flex", flexDirection: "column", justifyContent: "flex-end",
                }} title={`${c} Urlaubstage`}>
                  {c > 0 && (
                    <div style={{
                      height: `${heightPct}%`,
                      background: "var(--blue)",
                      borderRadius: 4,
                      display: "flex", alignItems: "flex-start", justifyContent: "center",
                      paddingTop: heightPct > 30 ? 4 : 0,
                    }}>
                      {heightPct > 30 && (
                        <span style={{ fontSize: 9, color: "#0f0f13", fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{c}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between", marginTop: 6,
            fontSize: 9, color: "var(--muted)", fontWeight: 700,
          }}>
            {["J","F","M","A","M","J","J","A","S","O","N","D"].map((l, i) => (
              <span key={i} style={{ flex: 1, textAlign: "center", color: i === currentMonth ? "var(--accent2)" : "var(--muted)" }}>{l}</span>
            ))}
          </div>
        </div>

        {/* ── 3 KPI CARDS ─────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--muted)", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 6 }}>
              <Icon name="clock" size={11} /> ÜBERSTUNDEN
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 500, color: "var(--blue)" }}>
              {overtimeHours}h
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
              = {overtimeDays} Tag{overtimeDays === 1 ? "" : "e"}
            </div>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--muted)", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 6 }}>
              <Icon name="hourglass" size={11} /> WARTEN
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 500, color: pendingCount > 0 ? "var(--yellow)" : "var(--muted)" }}>
              {pendingCount}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
              {pendingCount === 1 ? "Antrag offen" : "Anträge offen"}
            </div>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--muted)", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 6 }}>
              <Icon name="flag" size={11} /> NÄCHSTER
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 500, color: "var(--text)" }}>
              {nextVacation ? (daysUntilNext === 0 ? "heute" : `in ${daysUntilNext}T`) : "—"}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
              {nextVacation ? fmtDateShort(nextVacation.start_date) : "Keiner geplant"}
            </div>
          </div>
        </div>

        {/* ── ANTRAG LIST ──────────────────────────────────────────────── */}
        <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 10, paddingLeft: 4 }}>
          DEINE ANTRÄGE
        </div>

        {loading ? (
          <div
            role="status"
            aria-label="Urlaubsanträge werden geladen"
            style={{ display: "flex", flexDirection: "column", gap: 10, padding: "6px 0" }}
          >
            <Skeleton fullWidth height={72} radius={12} />
            <Skeleton fullWidth height={72} radius={12} />
            <Skeleton fullWidth height={72} radius={12} />
          </div>
        ) : requests.length === 0 ? (
          <div style={{
            background: "color-mix(in srgb, var(--accent2) 8%, var(--surface))",
            border: "1px dashed color-mix(in srgb, var(--accent2) 30%, transparent)",
            borderRadius: 16, padding: "32px 22px", textAlign: "center",
          }}>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: "50%", background: "color-mix(in srgb, var(--accent2) 15%, transparent)", marginBottom: 14 }}>
              <Icon name="umbrella" size={28} color="var(--accent2)" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Noch keine Anträge</div>
            <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, marginBottom: 18, maxWidth: 360, margin: "0 auto 18px" }}>
              Plane deinen ersten Urlaub. Stundly generiert das PDF und füllt die Tracker-Tage automatisch.
            </p>
            <button
              onClick={() => setShowForm(true)}
              style={{
                padding: "10px 20px", background: "var(--accent2)", color: "#1a1a2e",
                border: "none", borderRadius: 999, fontWeight: 800, fontSize: 12, cursor: "pointer",
                fontFamily: "'Syne',sans-serif",
              }}
            >+ Ersten Antrag</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {requests.map(r => {
              const status = STATUS_INFO[r.status];
              const art = (r.urlaub_art as UrlaubArt) ?? "Erholungsurlaub";
              const startD = new Date(r.start_date);
              const monthLabel = startD.toLocaleString("de-DE", { month: "short" }).toUpperCase();
              const dayNum = String(startD.getDate()).padStart(2, "0");
              const sameMonth = r.start_date.slice(0, 7) === r.end_date.slice(0, 7);
              const rangeLabel = sameMonth
                ? `${startD.getDate()}. — ${new Date(r.end_date).getDate()}. ${startD.toLocaleString("de-DE", { month: "long" })}`
                : `${fmtDateShort(r.start_date)} — ${fmtDateShort(r.end_date)}`;
              const daysOpen = r.status === "pending" && r.created_at
                ? Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000)
                : 0;

              return (
                <div key={r.id} style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderLeft: `3px solid ${status.color}`,
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "flex", alignItems: "center", gap: 14,
                }}>
                  {/* Date block */}
                  <div style={{ flexShrink: 0, textAlign: "center", minWidth: 48 }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 500, lineHeight: 1, color: "white" }}>
                      {dayNum}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, marginTop: 2 }}>
                      {monthLabel}
                    </div>
                  </div>
                  <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />

                  {/* Middle */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                        {rangeLabel}
                      </div>
                      <span style={{
                        fontSize: 9, padding: "2px 8px", borderRadius: 999, fontWeight: 700,
                        background: `color-mix(in srgb, ${URLAUB_ART_COLORS[art]} 15%, transparent)`,
                        color: URLAUB_ART_COLORS[art],
                        letterSpacing: "0.04em",
                      }}>
                        {URLAUB_ART_SHORT[art]}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 14, flexWrap: "wrap" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Icon name="calendar" size={11} /> {r.days_count} Tag{r.days_count === 1 ? "" : "e"}
                      </span>
                      {r.vertretung && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Icon name="user" size={11} /> {r.vertretung}
                        </span>
                      )}
                      {r.reason && !r.vertretung && (
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                          {r.reason}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: status + delete */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 10, padding: "4px 10px", borderRadius: 999, fontWeight: 700,
                      background: status.bg, color: status.color,
                      display: "flex", alignItems: "center", gap: 4,
                    }}>
                      {r.status === "approved" && <Icon name="check" size={10} strokeWidth={2.5} />}
                      {r.status === "pending" ? `Wartet ${daysOpen}T` : status.label}
                    </span>
                    <button
                      onClick={() => handleDelete(r.id)}
                      style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 2, opacity: 0.6 }}
                      title="Löschen"
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SLIDE-IN PANEL ─────────────────────────────────────────────── */}
      {showForm && (
        <>
          <div
            onClick={() => setShowForm(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(4px)", zIndex: 99,
              animation: "fadeIn 180ms ease-out",
            }}
          />
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0,
            width: "min(440px, 100vw)",
            background: "var(--bg)", borderLeft: "1px solid var(--border)",
            zIndex: 100, overflowY: "auto",
            animation: "slideInRight 240ms cubic-bezier(0.16, 1, 0.3, 1)",
            boxShadow: "-12px 0 40px rgba(0,0,0,0.4)",
          }}>
            <div style={{ padding: "20px 22px 60px" }}>
              {/* Panel header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, letterSpacing: "0.1em" }}>NEUER ANTRAG</div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>Urlaub planen</h2>
                </div>
                <button
                  onClick={() => setShowForm(false)}
                  style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "var(--surface)", border: "1px solid var(--border)",
                    color: "var(--text)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Icon name="x" size={16} />
                </button>
              </div>

              {/* Mitarbeiter preview */}
              {profile && (profile.vorname || profile.nachname) && (
                <div style={{
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: 12, padding: "10px 14px", marginBottom: 18,
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "color-mix(in srgb, var(--accent2) 20%, transparent)",
                    color: "var(--accent2)", fontWeight: 800, fontSize: 13,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {(profile.vorname?.[0] ?? "") + (profile.nachname?.[0] ?? "")}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{profile.vorname} {profile.nachname}</div>
                    {profile.personal_nr && (
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>Nr. {profile.personal_nr}</div>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Quick presets */}
                <div>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8 }}>
                    SCHNELLAUSWAHL
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {[
                      { k: "today" as const,    label: "Heute" },
                      { k: "tomorrow" as const, label: "Morgen" },
                      { k: "1w" as const,       label: "1 Woche" },
                      { k: "2w" as const,       label: "2 Wochen" },
                      { k: "bruecke" as const,  label: "Brückentag" },
                    ].map(p => (
                      <button
                        key={p.k} type="button" onClick={() => applyPreset(p.k)}
                        style={{
                          padding: "7px 13px", borderRadius: 999,
                          background: "var(--surface)", border: "1px solid var(--border)",
                          color: "var(--text)", fontSize: 11, fontWeight: 700, cursor: "pointer",
                          fontFamily: "'Syne',sans-serif",
                        }}
                      >{p.label}</button>
                    ))}
                  </div>
                </div>

                {/* Dates */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label className="label" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)" }}>VON</label>
                    <input className="input" type="date" value={startDate}
                      onChange={e => setStartDate(e.target.value)} required />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)" }}>BIS</label>
                    <input className="input" type="date" value={endDate} min={startDate}
                      onChange={e => setEndDate(e.target.value)} required />
                  </div>
                </div>

                {/* Validation banner */}
                {validation && (
                  <div style={{
                    background: validation.kind === "error" ? "color-mix(in srgb, var(--red) 10%, transparent)"
                              : validation.kind === "warn"  ? "color-mix(in srgb, var(--yellow) 10%, transparent)"
                              :                                "color-mix(in srgb, var(--green) 10%, transparent)",
                    border: `1px solid color-mix(in srgb, ${
                      validation.kind === "error" ? "var(--red)"
                      : validation.kind === "warn" ? "var(--yellow)"
                      : "var(--green)"
                    } 30%, transparent)`,
                    borderRadius: 10, padding: "10px 14px",
                    display: "flex", flexDirection: "column", gap: 4,
                  }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                      fontSize: 13, fontWeight: 700,
                      color: validation.kind === "error" ? "var(--red)"
                           : validation.kind === "warn"  ? "var(--yellow)"
                           :                                "var(--green)",
                    }}>
                      {validation.kind === "ok"    && <Icon name="check" size={14} strokeWidth={2.5} />}
                      {validation.kind === "warn"  && <Icon name="alert" size={14} />}
                      {validation.kind === "error" && <Icon name="x"     size={14} strokeWidth={2.5} />}
                      {validation.netWorkdays} Arbeitstag{validation.netWorkdays === 1 ? "" : "e"}
                      {validation.kind === "warn" && validation.rawWorkdays > validation.netWorkdays && (
                        <span style={{ marginLeft: 4, fontWeight: 500 }}>
                          ({validation.rawWorkdays - validation.netWorkdays} Feiertag{validation.rawWorkdays - validation.netWorkdays === 1 ? "" : "e"} entfallen)
                        </span>
                      )}
                    </div>
                    {validation.feiertageInRange.length > 0 && (
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {validation.feiertageInRange.join(" · ")}
                      </div>
                    )}
                    {validation.inPast && (
                      <div style={{ fontSize: 11, color: "var(--yellow)", display: "flex", alignItems: "center", gap: 4 }}>
                        <Icon name="info" size={10} /> Startdatum in der Vergangenheit
                      </div>
                    )}
                    {validation.overlaps.length > 0 && (
                      <div style={{ fontSize: 11, color: "var(--red)" }}>
                        Überlappt mit Antrag vom {validation.overlaps.map(o => fmtDateShort(o.start_date)).join(", ")}
                      </div>
                    )}
                    {validation.insufficient && (
                      <div style={{ fontSize: 11, color: "var(--red)" }}>
                        Nur {validation.totalAvailableForArt} Tag{validation.totalAvailableForArt === 1 ? "" : "e"} verfügbar
                      </div>
                    )}
                  </div>
                )}

                {/* Urlaubsart pills */}
                <div>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8 }}>
                    URLAUBSART
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {URLAUB_ARTEN.map(a => {
                      const active = urlaubArt === a;
                      return (
                        <button
                          key={a} type="button" onClick={() => setUrlaubArt(a)}
                          style={{
                            padding: "9px 12px", borderRadius: 10,
                            background: active ? `color-mix(in srgb, ${URLAUB_ART_COLORS[a]} 18%, var(--surface))` : "var(--surface)",
                            border: `1px solid ${active ? URLAUB_ART_COLORS[a] : "var(--border)"}`,
                            color: active ? URLAUB_ART_COLORS[a] : "var(--text)",
                            fontSize: 11, fontWeight: 700, cursor: "pointer",
                            textAlign: "left", fontFamily: "'Syne',sans-serif",
                          }}
                        >{a}</button>
                      );
                    })}
                  </div>
                </div>

                {/* Vertretung */}
                <div>
                  <label className="label" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)" }}>
                    VERTRETUNG (OPTIONAL)
                  </label>
                  <input className="input" type="text" value={vertretung}
                    onChange={e => setVertretung(e.target.value)}
                    placeholder="z. B. Max Mustermann" />
                </div>

                {/* Bemerkung */}
                <div>
                  <label className="label" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)" }}>
                    BEMERKUNGEN (OPTIONAL)
                  </label>
                  <input className="input" type="text" value={bemerkung}
                    onChange={e => setBemerkung(e.target.value)}
                    placeholder="..." />
                </div>

                {/* Mail */}
                <div>
                  <label className="label" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon name="send" size={10} /> MAIL-EMPFÄNGER
                  </label>
                  <input className="input" type="email" value={mailTo}
                    onChange={e => setMailTo(e.target.value)} />
                </div>

                {/* Signature */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8 }}>
                    UNTERSCHRIFT
                  </div>
                  <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "white" }}>
                    <SignatureCanvas
                      ref={sigRef}
                      canvasProps={{ width: 380, height: 100, style: { width: "100%", height: 100, cursor: "crosshair", touchAction: "none" } }}
                      backgroundColor="white"
                    />
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button type="button" onClick={() => { sigRef.current?.clear(); setSigData(null); }} style={{
                      flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--border)",
                      background: "var(--surface)", color: "var(--muted)",
                      fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                    }}><Icon name="trash" size={12} /> Löschen</button>
                    <button type="button" onClick={handleSaveSignature} style={{
                      flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--green)",
                      background: "color-mix(in srgb, var(--green) 12%, transparent)", color: "var(--green)",
                      fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                    }}><Icon name="check" size={12} strokeWidth={2.5} /> Übernehmen</button>
                  </div>
                  {sigData && (
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      <Icon name="check" size={12} color="var(--green)" strokeWidth={2.5} />
                      <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 700 }}>Unterschrift bereit</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sigData} alt="Unterschrift" style={{ maxWidth: 80, maxHeight: 28, marginLeft: "auto", border: "1px solid var(--border)", borderRadius: 4, background: "white", padding: 2 }} />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                  <button
                    type="button" onClick={generatePDF}
                    disabled={!startDate || !endDate}
                    style={{
                      width: "100%", padding: 12, background: "var(--surface)",
                      border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)",
                      fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}
                  >
                    <Icon name="send" size={14} /> Nur PDF-Vorschau (ohne Speichern)
                  </button>
                  <button
                    type="submit" disabled={saving || !startDate || !endDate}
                    style={{
                      width: "100%", padding: 14, background: "var(--accent2)",
                      border: "none", borderRadius: 12, color: "#1a1a2e",
                      fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 800, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      boxShadow: "0 4px 16px color-mix(in srgb, var(--accent2) 35%, transparent)",
                    }}
                  >
                    {saving ? "Wird gespeichert..." : (
                      <><Icon name="check" size={16} color="#1a1a2e" strokeWidth={2.5} />
                        Speichern {mailTo ? "+ PDF & Mail senden" : ""}</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <style jsx global>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideInRight {
              from { transform: translateX(100%); opacity: 0; }
              to   { transform: translateX(0); opacity: 1; }
            }
          `}</style>
        </>
      )}
    </>
  );
}
