"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Steuerklasse, KirchensteuerRate } from "@workly/shared";
import { calcNotdienstNetto } from "@/lib/tools/notdienstNetto";

/** Herkunft im Super-Admin-Kokpit: "tool · notdienstpauschale" */
export const NOTDIENST_REGISTER_HREF = "/register?utm_source=tool&utm_campaign=notdienstpauschale";

const euro = (v: number) => v.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const num = (v: string) => Number(v.replace(",", "."));
const KLASSEN: Steuerklasse[] = ["I", "II", "III", "IV", "V", "VI"];

export function NotdienstNettoRechner() {
  const [gehalt, setGehalt]       = useState("3200");
  const [pauschale, setPauschale] = useState("150");
  const [wochen, setWochen]       = useState("1");
  const [klasse, setKlasse]       = useState<Steuerklasse>("I");
  const [kirche, setKirche]       = useState<KirchensteuerRate>(0);
  const [kinder, setKinder]       = useState(false);

  const r = useMemo(() => calcNotdienstNetto({
    grundBrutto: num(gehalt), pauschaleProWoche: num(pauschale), wochen: num(wochen),
    steuerklasse: klasse, kirchensteuer: kirche, hatKinder: kinder, year: new Date().getFullYear(),
  }), [gehalt, pauschale, wochen, klasse, kirche, kinder]);

  const field = { display: "flex", flexDirection: "column", gap: 4 } as const;
  const grid = { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", alignItems: "end", marginBottom: 14 } as const;
  return (
    <div className="card" style={{ padding: "clamp(12px, 3vw, 20px)" }}>
      <div style={grid}>
        <label style={field}><span className="label">Monatsgehalt brutto (€)</span>
          <input className="input" inputMode="decimal" value={gehalt} onChange={(e) => setGehalt(e.target.value)} />
        </label>
        <label style={field}><span className="label">Pauschale pro Woche (€)</span>
          <input className="input" inputMode="decimal" value={pauschale} onChange={(e) => setPauschale(e.target.value)} />
        </label>
        <label style={field}><span className="label">Notdienst-Wochen im Monat</span>
          <input className="input" inputMode="numeric" value={wochen} onChange={(e) => setWochen(e.target.value)} />
        </label>
        <label style={field}><span className="label">Steuerklasse</span>
          <select className="input" value={klasse} onChange={(e) => setKlasse(e.target.value as Steuerklasse)} style={{ appearance: "none" }}>
            {KLASSEN.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <label style={field}><span className="label">Kirchensteuer</span>
          <select className="input" value={kirche} onChange={(e) => setKirche(Number(e.target.value) as KirchensteuerRate)} style={{ appearance: "none" }}>
            <option value={0}>keine</option>
            <option value={0.09}>9 %</option>
            <option value={0.08}>8 % (BY, BW)</option>
          </select>
        </label>
        <label style={field}><span className="label">Kinder</span>
          <select className="input" value={kinder ? "ja" : "nein"} onChange={(e) => setKinder(e.target.value === "ja")} style={{ appearance: "none" }}>
            <option value="nein">keine</option>
            <option value="ja">ja</option>
          </select>
        </label>
      </div>

      <div aria-live="polite" style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: "color-mix(in srgb, var(--green) 12%, var(--surface))" }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Davon bleiben netto</div>
          <div style={{ fontSize: "clamp(20px, 6vw, 26px)", fontWeight: 800, fontFamily: "var(--font-dm-mono),monospace", color: "var(--green)", whiteSpace: "nowrap" }}>{euro(r.notdienstNetto)}</div>
        </div>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--surface2)" }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Notdienst brutto</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-dm-mono),monospace" }}>{euro(r.notdienstBrutto)}</div>
        </div>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--surface2)" }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Steuer + Sozialabgaben</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-dm-mono),monospace" }}>
            {euro(r.abzug)} <span style={{ fontSize: 13, color: "var(--muted)" }}>({r.abzugProzent} %)</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, padding: "14px 16px", borderRadius: 12, background: "var(--surface2)", display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, flex: "1 1 240px" }}>
          In <strong style={{ color: "var(--text)" }}>Stundly</strong> trägst du deine Notdienst-Wochen am Handy ein —
          die Pauschale fließt automatisch in deine Brutto→Netto-Berechnung für den Monat.
        </span>
        <Link href={NOTDIENST_REGISTER_HREF} className="btn btn-primary" style={{ textDecoration: "none" }}>Kostenlos starten →</Link>
      </div>
    </div>
  );
}
