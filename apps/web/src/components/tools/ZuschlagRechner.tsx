"use client";

import { useEffect, useMemo, useState } from "react";
import { calcZuschlaege } from "@/lib/tools/zuschlaege";
import { BUNDESLAENDER } from "@/lib/utils/feiertage";
import { formatDur } from "@/lib/utils/formatDur";

const euro = (v: number) => v.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

/** Nächster Sonntag (lokal) als Beispiel — Notdienst am Wochenende ist der typische Fall */
function nextSunday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ZuschlagRechner() {
  const [date, setDate] = useState("");
  const [start, setStart] = useState("21:00");
  const [end, setEnd] = useState("01:30");
  const [bl, setBl] = useState("NI");
  const [lohn, setLohn] = useState("20");

  // Datum erst im Browser setzen (sonst Server/Client-Abweichung um Mitternacht)
  useEffect(() => { setDate(nextSunday()); }, []);

  const lohnNum = Number(lohn.replace(",", "."));
  const r = useMemo(
    () => (date && Number.isFinite(lohnNum) ? calcZuschlaege({ date, start, end, bundesland: bl, stundenlohn: lohnNum }) : null),
    [date, start, end, bl, lohnNum],
  );

  const field = { display: "flex", flexDirection: "column", gap: 4 } as const;
  return (
    <div className="card" style={{ padding: "clamp(12px, 3vw, 20px)" }}>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", marginBottom: 18 }}>
        <label style={field}><span className="label">Datum (Beginn)</span>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label style={field}><span className="label">Beginn</span>
          <input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label style={field}><span className="label">Ende</span>
          <input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <label style={field}><span className="label">Stundenlohn (€)</span>
          <input className="input" inputMode="decimal" value={lohn} onChange={(e) => setLohn(e.target.value)} />
        </label>
        <label style={field}><span className="label">Bundesland</span>
          <select className="input" value={bl} onChange={(e) => setBl(e.target.value)} style={{ appearance: "none" }}>
            {Object.entries(BUNDESLAENDER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>

      {!r ? (
        <p style={{ fontSize: 13, color: "var(--muted)" }}>Bitte Datum, Uhrzeiten und Stundenlohn eingeben.</p>
      ) : (
        <div aria-live="polite">
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginBottom: 14 }}>
            <div style={{ padding: "14px 16px", borderRadius: 12, background: "color-mix(in srgb, var(--green) 12%, var(--surface))" }}>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Steuerfreie Zuschläge</div>
              <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "'DM Mono',monospace", color: "var(--green)" }}>{euro(r.steuerfreiEuro)}</div>
            </div>
            <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--surface2)" }}>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>davon sozialversicherungsfrei</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'DM Mono',monospace" }}>{euro(r.svFreiEuro)}</div>
            </div>
            <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--surface2)" }}>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Grundlohn für {formatDur(r.totalMin)}</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'DM Mono',monospace" }}>{euro(r.grundEuro)}</div>
            </div>
          </div>

          {r.rows.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              In dieser Zeit fallen keine steuerfreien Zuschläge an (kein Nacht-, Sonntags- oder Feiertagsanteil).
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>
                    <th style={{ textAlign: "left", padding: "6px 4px" }}>Zuschlag</th>
                    <th style={{ textAlign: "right", padding: "6px 4px" }}>Zeit</th>
                    <th style={{ textAlign: "right", padding: "6px 4px" }}>steuerfrei</th>
                  </tr>
                </thead>
                <tbody>
                  {r.rows.map((row) => (
                    <tr key={row.art} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "8px 4px" }}>
                        {row.label}
                        <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>{row.pct} % vom Grundlohn</span>
                      </td>
                      <td style={{ padding: "8px 4px", textAlign: "right", fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap" }}>{formatDur(row.minutes)}</td>
                      <td style={{ padding: "8px 4px", textAlign: "right", fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap" }}>{euro(row.steuerfreiEuro)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {lohnNum > 50 && (
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
              Gerechnet mit höchstens 50 €/h Grundlohn (Steuer) bzw. 25 €/h (Sozialversicherung).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
