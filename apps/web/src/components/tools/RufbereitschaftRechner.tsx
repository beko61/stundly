"use client";

import { useMemo, useState } from "react";
import { calcRufbereitschaft, type RufModell } from "@/lib/tools/rufbereitschaft";
import { MINDESTLOHN_CURRENT, formatMindestlohn } from "@/lib/mindestlohn";

const euro = (v: number) => v.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const num = (v: string) => Number(v.replace(",", "."));

export function RufbereitschaftRechner() {
  const [lohn, setLohn]       = useState("20");
  const [modell, setModell]   = useState<RufModell>("stunden");
  const [tageW, setTageW]     = useState("5");
  const [tageWE, setTageWE]   = useState("2");
  const [faktorW, setFaktorW] = useState("2");
  const [faktorWE, setFaktorWE] = useState("4");
  const [euroW, setEuroW]     = useState("30");
  const [euroWE, setEuroWE]   = useState("60");
  const [einsatz, setEinsatz] = useState("6");

  const lohnNum = num(lohn);
  const r = useMemo(() => calcRufbereitschaft({
    stundenlohn: lohnNum, modell,
    tageWerktag: num(tageW), tageWochenende: num(tageWE),
    faktorWerktag: num(faktorW), faktorWochenende: num(faktorWE),
    euroWerktag: num(euroW), euroWochenende: num(euroWE),
    einsatzMinuten: num(einsatz) * 60,
  }), [lohnNum, modell, tageW, tageWE, faktorW, faktorWE, euroW, euroWE, einsatz]);

  const field = { display: "flex", flexDirection: "column", gap: 4 } as const;
  // alignItems end: zweizeilige Labels verschieben die Eingabefelder nicht
  const grid = { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", alignItems: "end", marginBottom: 14 } as const;
  return (
    <div className="card" style={{ padding: "clamp(12px, 3vw, 20px)" }}>
      <div style={grid}>
        <label style={field}><span className="label">Stundenlohn (€)</span>
          <input className="input" inputMode="decimal" value={lohn} onChange={(e) => setLohn(e.target.value)} />
        </label>
        <label style={field}><span className="label">Bezahlung der Bereitschaft</span>
          <select className="input" value={modell} onChange={(e) => setModell(e.target.value as RufModell)} style={{ appearance: "none" }}>
            <option value="stunden">In Stundenlöhnen</option>
            <option value="pauschale">Fester Betrag (€)</option>
          </select>
        </label>
        <label style={field}><span className="label">Tage Mo–Fr</span>
          <input className="input" inputMode="numeric" value={tageW} onChange={(e) => setTageW(e.target.value)} />
        </label>
        <label style={field}><span className="label">Tage Sa, So, Feiertag</span>
          <input className="input" inputMode="numeric" value={tageWE} onChange={(e) => setTageWE(e.target.value)} />
        </label>
        {modell === "stunden" ? (
          <>
            <label style={field}><span className="label">Stundenlöhne je Tag Mo–Fr</span>
              <input className="input" inputMode="decimal" value={faktorW} onChange={(e) => setFaktorW(e.target.value)} />
            </label>
            <label style={field}><span className="label">Stundenlöhne je Tag Sa/So/Ft</span>
              <input className="input" inputMode="decimal" value={faktorWE} onChange={(e) => setFaktorWE(e.target.value)} />
            </label>
          </>
        ) : (
          <>
            <label style={field}><span className="label">€ pro Tag Mo–Fr</span>
              <input className="input" inputMode="decimal" value={euroW} onChange={(e) => setEuroW(e.target.value)} />
            </label>
            <label style={field}><span className="label">€ pro Tag Sa/So/Ft</span>
              <input className="input" inputMode="decimal" value={euroWE} onChange={(e) => setEuroWE(e.target.value)} />
            </label>
          </>
        )}
        <label style={field}><span className="label">Einsätze (Stunden)</span>
          <input className="input" inputMode="decimal" value={einsatz} onChange={(e) => setEinsatz(e.target.value)} />
        </label>
      </div>
      {modell === "stunden" && (
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14, lineHeight: 1.6 }}>
          Vorbelegt wie im TVöD (§ 8 Abs. 3): 2 Stundenlöhne pro Tag Mo–Fr, 4 an Samstagen, Sonntagen und Feiertagen.
          Im Handwerk regelt das dein Arbeits- oder Tarifvertrag — trag deine Werte ein.
        </p>
      )}

      <div aria-live="polite" style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: "color-mix(in srgb, var(--green) 12%, var(--surface))" }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Gesamt brutto</div>
          <div style={{ fontSize: "clamp(20px, 6vw, 26px)", fontWeight: 800, fontFamily: "'DM Mono',monospace", color: "var(--green)", whiteSpace: "nowrap" }}>{euro(r.gesamtEuro)}</div>
        </div>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--surface2)" }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>für die Bereitschaft</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'DM Mono',monospace" }}>{euro(r.bereitschaftEuro)}</div>
        </div>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--surface2)" }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>für die Einsätze</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'DM Mono',monospace" }}>{euro(r.einsatzEuro)}</div>
        </div>
      </div>
      {lohnNum > 0 && lohnNum < MINDESTLOHN_CURRENT && (
        <p role="alert" style={{ fontSize: 12, color: "var(--red)", marginTop: 10 }}>
          Unter dem gesetzlichen Mindestlohn ({formatMindestlohn()} pro Stunde) — Einsätze sind Arbeitszeit und mindestens so zu bezahlen.
        </p>
      )}
    </div>
  );
}
