"use client";

import { useMemo, useState } from "react";
import type React from "react";
import Link from "next/link";
import {
  ARBZG_DAY_MAX_MIN, ARBZG_WEEK_AVG_MAX_MIN,
  calcUeberstunden, dayMinutes, parseHours, type Zeitraum,
} from "@/lib/tools/ueberstunden";
import { formatDur } from "@/lib/utils/formatDur";

const TAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

interface Day { start: string; end: string; pause: string }
// Beispielwoche: Mo–Fr 07:00–16:30, 1 h Pause → 42,5 h, bei 40-h-Vertrag sofort sichtbar +2h 30m
const EMPTY_WEEK: Day[] = TAGE.map((_, i) => (i < 5 ? { start: "07:00", end: "16:30", pause: "60" } : { start: "", end: "", pause: "" }));

const euro = (v: number) => v.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export function UeberstundenRechner() {
  const [modus, setModus] = useState<"tage" | "summe">("tage");
  const [week, setWeek] = useState<Day[]>(EMPTY_WEEK);
  const [summe, setSumme] = useState("180");
  const [zeitraum, setZeitraum] = useState<Zeitraum>("monat");
  const [wochenStunden, setWochenStunden] = useState("40");
  const [lohn, setLohn] = useState("");
  const [zuschlag, setZuschlag] = useState("0");

  const dayMins = week.map((d) => dayMinutes(d.start, d.end, Number(d.pause) || 0));
  const effZeitraum: Zeitraum = modus === "tage" ? "woche" : zeitraum;
  const istMin = modus === "tage" ? dayMins.reduce((a, b) => a + b, 0) : parseHours(summe);
  const woche = parseHours(wochenStunden);

  const result = useMemo(() => {
    if (istMin === null || woche === null) return null;
    return calcUeberstunden({
      istMin,
      wochenStunden: woche / 60,
      zeitraum: effZeitraum,
      stundenlohn: lohn ? Number(lohn.replace(",", ".")) : null,
      zuschlagPct: Number(zuschlag) || 0,
    });
  }, [istMin, woche, effZeitraum, lohn, zuschlag]);

  const longDays = modus === "tage" ? TAGE.filter((_, i) => dayMins[i]! > ARBZG_DAY_MAX_MIN) : [];
  const overWeek = modus === "tage" && (istMin ?? 0) > ARBZG_WEEK_AVG_MAX_MIN;

  const setDay = (i: number, k: keyof Day, v: string) =>
    setWeek((w) => w.map((d, j) => (j === i ? { ...d, [k]: v } : d)));

  const seg = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "10px 12px", minHeight: 44, borderRadius: 9, border: "none", cursor: "pointer",
    background: active ? "var(--accent)" : "transparent", color: active ? "white" : "var(--muted)",
    fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
  });

  return (
    <div className="card" style={{ padding: "clamp(12px, 3vw, 20px)" }}>
      <div role="tablist" aria-label="Eingabeart" style={{ display: "flex", gap: 4, padding: 4, background: "var(--surface2)", borderRadius: 12, marginBottom: 18 }}>
        <button role="tab" aria-selected={modus === "tage"} style={seg(modus === "tage")} onClick={() => setModus("tage")}>Pro Tag</button>
        <button role="tab" aria-selected={modus === "summe"} style={seg(modus === "summe")} onClick={() => setModus("summe")}>Stunden gesamt</button>
      </div>

      {modus === "tage" ? (
        <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
          <p className="uer-mobile-hint" aria-hidden="true">Je Tag: Beginn · Ende · Pause in Minuten</p>
          <div className="uer-row uer-head" aria-hidden="true">
            <span>Tag</span><span>Beginn</span><span>Ende</span><span>Pause (min)</span><span style={{ textAlign: "right" }}>Netto</span>
          </div>
          {week.map((d, i) => (
            <div key={TAGE[i]} className="uer-row">
              <span style={{ fontWeight: 700, fontSize: 13 }}>{TAGE[i]}</span>
              <input className="input" type="time" aria-label={`${TAGE[i]} Beginn`} value={d.start} onChange={(e) => setDay(i, "start", e.target.value)} />
              <input className="input" type="time" aria-label={`${TAGE[i]} Ende`} value={d.end} onChange={(e) => setDay(i, "end", e.target.value)} />
              <input className="input" type="number" min={0} max={240} inputMode="numeric" aria-label={`${TAGE[i]} Pause in Minuten`} value={d.pause} onChange={(e) => setDay(i, "pause", e.target.value)} />
              <span style={{ fontFamily: "'DM Mono',monospace", textAlign: "right", color: dayMins[i]! > ARBZG_DAY_MAX_MIN ? "var(--red)" : "var(--text)" }}>
                {dayMins[i] ? formatDur(dayMins[i]!) : "–"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 18 }}>
          <div>
            <label className="label" htmlFor="uer-summe">Gearbeitete Stunden</label>
            <input id="uer-summe" className="input" inputMode="decimal" value={summe} onChange={(e) => setSumme(e.target.value)} placeholder="z. B. 180 oder 180:30" />
          </div>
          <div>
            <label className="label" htmlFor="uer-zeitraum">Zeitraum</label>
            <select id="uer-zeitraum" className="input" value={zeitraum} onChange={(e) => setZeitraum(e.target.value as Zeitraum)}>
              <option value="monat">Ein Monat</option>
              <option value="woche">Eine Woche</option>
            </select>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginBottom: 18 }}>
        <div>
          <label className="label" htmlFor="uer-woche">Vertrag: Stunden / Woche</label>
          <input id="uer-woche" className="input" inputMode="decimal" value={wochenStunden} onChange={(e) => setWochenStunden(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="uer-lohn">Stundenlohn € (optional)</label>
          <input id="uer-lohn" className="input" inputMode="decimal" value={lohn} onChange={(e) => setLohn(e.target.value)} placeholder="z. B. 18,50" />
        </div>
        <div>
          <label className="label" htmlFor="uer-zuschlag">Überstunden-Zuschlag</label>
          <select id="uer-zuschlag" className="input" value={zuschlag} onChange={(e) => setZuschlag(e.target.value)}>
            <option value="0">kein Zuschlag</option>
            <option value="10">10 %</option>
            <option value="25">25 %</option>
            <option value="50">50 %</option>
          </select>
        </div>
      </div>

      {result === null ? (
        <p role="alert" style={{ color: "var(--red)", fontSize: 13 }}>Bitte Stunden als Zahl eingeben, z. B. 40 oder 38,5.</p>
      ) : (
        <div aria-live="polite" style={{
          padding: 18, borderRadius: 12,
          background: `color-mix(in srgb, ${result.diffMin >= 0 ? "var(--green)" : "var(--red)"} 10%, var(--surface))`,
          border: `1px solid color-mix(in srgb, ${result.diffMin >= 0 ? "var(--green)" : "var(--red)"} 35%, transparent)`,
        }}>
          <div className="label" style={{ marginBottom: 4 }}>{result.diffMin >= 0 ? "Deine Überstunden" : "Deine Minusstunden"}</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 34, fontWeight: 500, color: result.diffMin >= 0 ? "var(--green)" : "var(--red)" }}>
            {formatDur(result.diffMin, true)}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6, lineHeight: 1.6 }}>
            Gearbeitet {formatDur(istMin ?? 0)} · Soll {formatDur(result.sollMin)} {effZeitraum === "woche" ? "pro Woche" : "pro Monat (Ø 4,33 Wochen)"}
            {" · "}≈ {Math.abs(result.tage).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Arbeitstage
            {result.wertEuro !== null && <><br />Wert: <strong style={{ color: "var(--text)" }}>{euro(result.wertEuro)}</strong> brutto{Number(zuschlag) ? ` inkl. ${zuschlag} % Zuschlag` : ""}</>}
          </div>
        </div>
      )}

      {(longDays.length > 0 || overWeek) && (
        <div role="alert" style={{
          marginTop: 12, padding: "10px 12px", borderRadius: 10, fontSize: 12, lineHeight: 1.5,
          background: "color-mix(in srgb, var(--orange) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--orange) 35%, transparent)", color: "var(--orange)",
        }}>
          ⚠️ Arbeitszeitgesetz (§3 ArbZG):{" "}
          {longDays.length > 0 && <>mehr als 10 Stunden am {longDays.join(", ")}. </>}
          {overWeek && <>Über 48 Stunden in der Woche sind nur zulässig, wenn der Durchschnitt über 6 Monate 8 Stunden pro Werktag nicht übersteigt.</>}
        </div>
      )}

      <div style={{ marginTop: 18, padding: "14px 16px", borderRadius: 12, background: "var(--surface2)", display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, flex: "1 1 240px" }}>
          Keine Lust, jede Woche nachzurechnen? <strong style={{ color: "var(--text)" }}>Stundly</strong> zählt deine Überstunden automatisch mit — jeden Tag, auf dem Handy.
        </span>
        <Link href="/register" className="btn btn-primary" style={{ textDecoration: "none" }}>Kostenlos starten →</Link>
      </div>
    </div>
  );
}
