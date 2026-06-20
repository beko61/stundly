"use client";

import { useState } from "react";
import { generateMonthlyReportPDF } from "@/lib/pdf/monthlyReportPdf";
import { buildCsvDetail, buildCsvSummary, csvDownload } from "@/lib/export/csvExport";
import type { TimeEntry } from "@workly/shared";

interface EmployeeData {
  profile:   Record<string, unknown>;
  entries:   TimeEntry[];
  notdienst: Array<{
    date: string; start_time: string | null; end_time: string | null;
    erledigt?: boolean | null; kunde?: string | null; note?: string | null;
  }>;
}
interface DataPayload {
  year: number;
  month: number;
  bundesland: string;
  companyName: string | null;
  feiertage: Record<string, string>;
  employees: EmployeeData[];
}

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

async function fetchData(year: number, month: number, userId?: string): Promise<DataPayload> {
  const params = new URLSearchParams({ year: String(year), month: String(month) });
  if (userId) params.set("userId", userId);
  const res = await fetch(`/api/company/reports/data?${params}`);
  if (!res.ok) throw new Error("Daten konnten nicht geladen werden");
  return res.json();
}

function fmtFilename(part: string, year: number, month: number): string {
  return `${part}_${MONTHS[month - 1]}_${year}`.replace(/[^a-zA-Z0-9_äöüÄÖÜß]/g, "_");
}

// ── Tek Mitarbeiter: PDF veya CSV detail ────────────────────────────
export function EmployeeExportButtons({
  userId, fullName, year, month,
}: {
  userId: string; fullName: string; year: number; month: number;
}) {
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);
  const [err,  setErr]  = useState<string | null>(null);

  async function download(format: "pdf" | "csv") {
    setBusy(format); setErr(null);
    try {
      const data = await fetchData(year, month, userId);
      const emp  = data.employees[0];
      if (!emp) { setErr("Mitarbeiter nicht gefunden"); setBusy(null); return; }

      if (format === "pdf") {
        await generateMonthlyReportPDF({
          year: data.year, month: data.month,
          entries:   emp.entries,
          notdienst: emp.notdienst.map(n => {
            const out: {
              date: string; start_time: string; end_time: string;
              erledigt?: boolean; kunde?: string | null; note?: string | null;
            } = {
              date: n.date,
              start_time: n.start_time ?? "",
              end_time:   n.end_time   ?? "",
            };
            if (n.erledigt != null) out.erledigt = !!n.erledigt;
            if (n.kunde    != null) out.kunde    = n.kunde;
            if (n.note     != null) out.note     = n.note;
            return out;
          }),
          feiertage: data.feiertage,
          profile: emp.profile as Parameters<typeof generateMonthlyReportPDF>[0]["profile"],
        });
      } else {
        const p = emp.profile as { full_name?: string; email?: string; personal_nr?: string };
        const csv = buildCsvDetail({
          year: data.year, month: data.month,
          row: {
            full_name:   p.full_name ?? fullName,
            email:       p.email ?? null,
            personal_nr: p.personal_nr ?? null,
            entries:     emp.entries,
            notdienst:   emp.notdienst,
          },
        });
        csvDownload(csv, `${fmtFilename(fullName, year, month)}.csv`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <button
        onClick={() => download("pdf")} disabled={busy !== null}
        style={btnStyle("var(--accent2)")}
        title="Monatsbericht als PDF"
      >
        {busy === "pdf" ? "..." : "PDF"}
      </button>
      <button
        onClick={() => download("csv")} disabled={busy !== null}
        style={btnStyle("var(--blue)")}
        title="Detail-CSV (Tagesübersicht)"
      >
        {busy === "csv" ? "..." : "CSV"}
      </button>
      {err && <span style={{ fontSize: 10, color: "var(--red)" }}>{err}</span>}
    </div>
  );
}

// ── Bulk: tüm çalışanlar tek CSV ─────────────────────────────────────
export function BulkCsvButton({ year, month }: { year: number; month: number }) {
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState<string | null>(null);

  async function downloadAll() {
    setBusy(true); setErr(null);
    try {
      const data = await fetchData(year, month);
      const rows = data.employees.map(emp => {
        const p = emp.profile as { full_name?: string; email?: string; personal_nr?: string };
        return {
          full_name:   p.full_name ?? "Unbekannt",
          email:       p.email ?? null,
          personal_nr: p.personal_nr ?? null,
          entries:     emp.entries,
          notdienst:   emp.notdienst,
        };
      });
      const csv = buildCsvSummary({ year: data.year, month: data.month, rows });
      csvDownload(csv, `${fmtFilename("Monatsuebersicht", year, month)}.csv`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button
        onClick={downloadAll} disabled={busy}
        style={{
          padding: "9px 16px", borderRadius: 999,
          background: "var(--accent2)", color: "#1a1a2e", border: "none",
          fontWeight: 800, fontSize: 12, cursor: busy ? "wait" : "pointer",
          fontFamily: "'Syne',sans-serif",
          boxShadow: "0 4px 16px color-mix(in srgb, var(--accent2) 30%, transparent)",
        }}
      >
        {busy ? "Wird erstellt..." : "Alle als CSV"}
      </button>
      {err && <span style={{ fontSize: 11, color: "var(--red)" }}>{err}</span>}
    </div>
  );
}

function btnStyle(color: string): React.CSSProperties {
  return {
    padding: "6px 12px", borderRadius: 8,
    background: `color-mix(in srgb, ${color} 14%, transparent)`,
    color, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
    fontWeight: 800, fontSize: 11, cursor: "pointer",
    fontFamily: "'Syne',sans-serif",
  };
}
