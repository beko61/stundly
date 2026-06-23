"use client";

import type { DemoStats } from "./state";
import { fmtMins, fmtEUR } from "./state";

interface Props {
  stats:    DemoStats;
  hasEdits: boolean;
}

export function UebersichtTab({ stats, hasEdits }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
          Guten Morgen, Max 👋
        </h1>
        <p style={{ fontSize: 13, color: "var(--muted)" }}>
          {hasEdits
            ? "Deine Daten — live berechnet."
            : "So sieht dein Monat aus."
          }
        </p>
      </div>

      {/* HERO: 2 big KPIs (live) */}
      <div className="demo-hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        <KpiHero
          label="Stundensaldo"
          value={fmtMins(stats.diffMin)}
          sub={stats.diffMin >= 0 ? "Überstunden im Juni" : "Untertstunden im Juni"}
          color={stats.diffMin >= 0 ? "var(--green)" : "var(--red)"}
        />
        <KpiHero
          label="Brutto-Lohn (Schätzung)"
          value={`€ ${fmtEUR(stats.brutto)}`}
          sub="Juni 2026 · live"
          color="var(--accent2)"
        />
      </div>

      {/* 4 KPIs */}
      <div className="demo-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
        <KpiSmall
          icon="⏱"
          label="Gearbeitet"
          value={`${Math.floor(stats.workedMin / 60)}h ${stats.workedMin % 60}`}
          sub={`von ${stats.sollMin / 60}h Soll`}
        />
        <KpiSmall
          icon="✓"
          label="Arbeitstage"
          value={String(stats.arbeitenCnt)}
          sub="erfasst"
        />
        <KpiSmall
          icon="🏖"
          label="Urlaub"
          value={String(stats.urlaubCnt)}
          sub="Tage"
        />
        <KpiSmall
          icon="🤒"
          label="Krank"
          value={String(stats.krankCnt)}
          sub="Tage"
        />
      </div>

      <div style={{
        background: hasEdits
          ? "color-mix(in srgb, var(--accent2) 8%, var(--surface))"
          : "var(--surface)",
        border: `1px solid ${hasEdits ? "color-mix(in srgb, var(--accent2) 35%, transparent)" : "var(--border)"}`,
        borderRadius: 12, padding: 16,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
          {hasEdits ? "🎯 So funktioniert dein Stundly" : "💡 Probier es aus"}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
          Geh auf <strong style={{ color: "var(--text)" }}>Zeit</strong>, tippe einen Tag und setze deine Zeiten.
          Stundensaldo und Brutto rechnen sich automatisch.
          {hasEdits && " Genau so funktioniert die echte App — nur dass deine Daten in der Cloud bleiben."}
        </div>
      </div>
    </div>
  );
}

function KpiHero({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 16, padding: 22,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'DM Mono', monospace", fontSize: 38, fontWeight: 700,
        lineHeight: 1.1, letterSpacing: "-0.02em", color, marginTop: 4,
      }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function KpiSmall({ icon, label, value, sub }: { icon: string; label: string; value: string; sub: string }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 12, padding: 14,
    }}>
      <div style={{ fontSize: 18, marginBottom: 2 }}>{icon}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 700, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{sub}</div>
    </div>
  );
}
