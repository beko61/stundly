"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { jsPDF as JsPDF } from "jspdf";
import { BUNDESLAENDER } from "@/lib/utils/feiertage";
import { MONATE, buildStundenzettelVorlage, vorlageFileName } from "@/lib/pdf/stundenzettelVorlagePdf";

/**
 * Formular für /stundenzettel-vorlage. jsPDF wird beim Öffnen vorgeladen, damit der
 * Download synchron im Klick passiert (iOS Safari blockiert Downloads nach einem await).
 */
export function StundenzettelVorlageForm() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [bundesland, setBundesland] = useState("");
  const [name, setName] = useState("");
  const [firma, setFirma] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const pdfCtor = useRef<typeof JsPDF | null>(null);

  useEffect(() => {
    import("jspdf")
      .then((m) => { pdfCtor.current = m.jsPDF; setReady(true); })
      .catch(() => setError("PDF-Erstellung konnte nicht geladen werden — bitte Seite neu laden."));
  }, []);

  function download() {
    if (!pdfCtor.current) return;
    setError(null);
    try {
      const input = { year, month, name, firma, bundesland: bundesland || null };
      buildStundenzettelVorlage(pdfCtor.current, input).save(vorlageFileName(input));
      setDone(true);
    } catch {
      setError("PDF konnte nicht erstellt werden — bitte erneut versuchen.");
    }
  }

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="card" style={{ padding: "clamp(14px, 3vw, 22px)" }}>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginBottom: 12 }}>
        <div>
          <label className="label" htmlFor="sz-monat">Monat</label>
          <select id="sz-monat" className="input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONATE.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="sz-jahr">Jahr</label>
          <select id="sz-jahr" className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="label" htmlFor="sz-land">Feiertage (Bundesland)</label>
          <select id="sz-land" className="input" value={bundesland} onChange={(e) => setBundesland(e.target.value)}>
            <option value="">keine eintragen</option>
            {Object.entries(BUNDESLAENDER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 16 }}>
        <div>
          <label className="label" htmlFor="sz-name">Name (optional)</label>
          <input id="sz-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="leer = zum Ausfüllen" autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="sz-firma">Firma (optional)</label>
          <input id="sz-firma" className="input" value={firma} onChange={(e) => setFirma(e.target.value)} placeholder="leer = zum Ausfüllen" autoComplete="organization" />
        </div>
      </div>

      <button type="button" className="btn btn-primary" onClick={download} disabled={!ready} style={{ width: "100%", padding: 14, fontSize: 15 }}>
        {ready ? `📄 Stundenzettel ${MONATE[month - 1]} ${year} herunterladen` : "Wird vorbereitet…"}
      </button>
      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, textAlign: "center" }}>
        Kostenlos, ohne Anmeldung · A4 zum Ausdrucken · Deine Eingaben bleiben auf deinem Gerät
      </p>
      {error && <p role="alert" style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>⚠️ {error}</p>}

      {done && (
        <div role="status" style={{ marginTop: 14, padding: "14px 16px", borderRadius: 12, background: "var(--surface2)", display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, flex: "1 1 240px" }}>
            ✓ Heruntergeladen. Keine Lust auf Zettel und Nachrechnen? Mit <strong style={{ color: "var(--text)" }}>Stundly</strong> trägst
            du deine Zeiten am Handy ein — Stunden, Überstunden und das PDF entstehen automatisch.
          </span>
          <Link href="/register" className="btn btn-primary" style={{ textDecoration: "none" }}>Kostenlos testen →</Link>
        </div>
      )}
    </div>
  );
}
