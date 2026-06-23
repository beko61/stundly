"use client";

import Link from "next/link";
import type { DemoStats, DemoState } from "./state";
import { fmtEUR } from "./state";

interface Props {
  stats: DemoStats;
  state: DemoState;
}

export function LohnTab({ stats, state }: Props) {
  const lohnsteuer = stats.brutto * 0.112;
  const rv = stats.brutto * 0.093;
  const av = stats.brutto * 0.013;
  const kv = stats.brutto * 0.0815;
  const pv = stats.brutto * 0.0235;
  const totalAbzug = stats.brutto - stats.netto;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>💰 Juni 2026 — Live</h1>
        <p style={{ fontSize: 13, color: "var(--muted)" }}>
          Brutto → Netto auf Basis deiner Zeit-Einträge. Stundenlohn:
          <strong style={{ color: "var(--text)" }}> €{state.settings.hourly_rate}/h</strong>
          {" · "}Steuerklasse I, keine Kirche, ohne Kinder.
        </p>
      </div>

      {/* HERO: Brutto → Netto (live) */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr auto 1fr",
        gap: 12, alignItems: "center",
        padding: 18, background: "var(--surface)",
        border: "1px solid var(--border)", borderRadius: 16,
      }}>
        <div style={{
          textAlign: "center",
          background: "color-mix(in srgb, var(--green) 14%, transparent)",
          borderRadius: 12, padding: "16px 8px",
        }}>
          <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Brutto</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 700, color: "var(--green)" }}>
            € {fmtEUR(stats.brutto)}
          </div>
        </div>
        <div style={{ fontSize: 20, color: "var(--muted)" }}>→</div>
        <div style={{
          textAlign: "center",
          background: "color-mix(in srgb, var(--accent2) 14%, transparent)",
          borderRadius: 12, padding: "16px 8px",
        }}>
          <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Netto</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 700, color: "var(--accent2)" }}>
            € {fmtEUR(stats.netto)}
          </div>
        </div>
      </div>

      {/* Abzüge (live) */}
      <div style={{
        background: "color-mix(in srgb, var(--red) 6%, var(--surface))",
        border: "1px solid color-mix(in srgb, var(--red) 25%, transparent)",
        borderRadius: 12, padding: 16,
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--red)", textTransform: "uppercase", marginBottom: 10, letterSpacing: "0.08em" }}>
          🧾 Abzüge (geschätzt)
        </div>
        {[
          { label: "Lohnsteuer (St-Kl. I, ~11,2%)", value: lohnsteuer },
          { label: "Rentenversicherung (9,3%)",     value: rv },
          { label: "Krankenvers. (8,15%)",          value: kv },
          { label: "Arbeitslosenvers. (1,3%)",      value: av },
          { label: "Pflegevers. (2,35%)",           value: pv },
        ].map((a) => (
          <div key={a.label} style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            padding: "6px 0", borderBottom: "1px solid color-mix(in srgb, var(--red) 12%, transparent)",
            fontSize: 13,
          }}>
            <span style={{ color: "var(--text)" }}>{a.label}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", color: "var(--red)", fontWeight: 600 }}>
              −€ {a.value.toFixed(2).replace(".", ",")}
            </span>
          </div>
        ))}
        <div style={{
          display: "flex", justifyContent: "space-between",
          marginTop: 10, paddingTop: 10, borderTop: "2px solid color-mix(in srgb, var(--red) 30%, transparent)",
          fontSize: 14, fontWeight: 800,
        }}>
          <span>Gesamt</span>
          <span style={{ fontFamily: "'DM Mono', monospace", color: "var(--red)" }}>
            −€ {totalAbzug.toFixed(2).replace(".", ",")}
          </span>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", lineHeight: 1.6 }}>
        💡 Schätzung — in der echten App nutzt Stundly EStG §32a + reale SV-Beiträge,
        deinen Stundenlohn, deine Steuerklasse, Kinder, Kirchensteuer.
        <br/>
        <Link href="/register" style={{ color: "var(--accent2)", fontWeight: 700 }}>
          Konto erstellen für exakte Abrechnung →
        </Link>
      </div>
    </div>
  );
}
