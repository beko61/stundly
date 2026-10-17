"use client";

import { useState } from "react";
import Link from "next/link";
import { BUNDESLAENDER } from "@/lib/utils/feiertage";
import { buildStundenzettelXlsx, excelFileName } from "@/lib/excel/stundenzettelXlsx";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Formular für /stundenzettel-excel-vorlage. Die Datei entsteht synchron im Klick
 * (iOS Safari blockiert Downloads nach einem await).
 */
export function StundenzettelExcelForm() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [bundesland, setBundesland] = useState("");
  const [name, setName] = useState("");
  const [firma, setFirma] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function download() {
    setError(null);
    try {
      const input = { year, name, firma, bundesland: bundesland || null };
      const blob = new Blob([buildStundenzettelXlsx(input)], { type: XLSX_MIME });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = excelFileName(input);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setDone(true);
    } catch {
      setError("Excel-Datei konnte nicht erstellt werden — bitte erneut versuchen.");
    }
  }

  const years = [now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="card" style={{ padding: "clamp(14px, 3vw, 22px)" }}>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginBottom: 12 }}>
        <div>
          <label className="label" htmlFor="sx-jahr">Jahr</label>
          <select id="sx-jahr" className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="sx-land">Feiertage (Bundesland)</label>
          <select id="sx-land" className="input" value={bundesland} onChange={(e) => setBundesland(e.target.value)}>
            <option value="">keine eintragen</option>
            {Object.entries(BUNDESLAENDER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 16 }}>
        <div>
          <label className="label" htmlFor="sx-name">Name (optional)</label>
          <input id="sx-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="leer = zum Ausfüllen" autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="sx-firma">Firma (optional)</label>
          <input id="sx-firma" className="input" value={firma} onChange={(e) => setFirma(e.target.value)} placeholder="leer = zum Ausfüllen" autoComplete="organization" />
        </div>
      </div>

      <button type="button" className="btn btn-primary" onClick={download} style={{ width: "100%", padding: 14, fontSize: 15 }}>
        📊 Excel-Vorlage {year} herunterladen
      </button>
      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, textAlign: "center" }}>
        Kostenlos, ohne Anmeldung · .xlsx mit 12 Monaten + Jahresübersicht · Deine Eingaben bleiben auf deinem Gerät
      </p>
      {error && <p role="alert" style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>⚠️ {error}</p>}

      {done && (
        <div role="status" style={{ marginTop: 14, padding: "14px 16px", borderRadius: 12, background: "var(--surface2)", display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, flex: "1 1 240px" }}>
            ✓ Heruntergeladen. Am Handy ist Excel mühsam — mit <strong style={{ color: "var(--text)" }}>Stundly</strong> trägst
            du Beginn und Ende in Sekunden ein, Überstunden und Monats-PDF entstehen automatisch.
          </span>
          <Link href="/register" className="btn btn-primary" style={{ textDecoration: "none" }}>Kostenlos testen →</Link>
        </div>
      )}
    </div>
  );
}
