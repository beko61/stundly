"use client";

import type { SalarySettings, Steuerklasse, KirchensteuerRate } from "@workly/shared";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

const STEUERKLASSEN: { value: Steuerklasse; label: string; hint: string }[] = [
  { value: "I",   label: "I",   hint: "Ledig" },
  { value: "II",  label: "II",  hint: "Alleinerz." },
  { value: "III", label: "III", hint: "Verh. (höher)" },
  { value: "IV",  label: "IV",  hint: "Verh. (gleich)" },
  { value: "V",   label: "V",   hint: "Verh. (niedr.)" },
  { value: "VI",  label: "VI",  hint: "2. Job" },
];

const KIRCHENSTEUER_OPTIONS: { value: KirchensteuerRate; label: string }[] = [
  { value: 0,    label: "Keine" },
  { value: 0.08, label: "8% (BW, BY)" },
  { value: 0.09, label: "9% (übrige)" },
];

type Props = {
  settings: SalarySettings;
  onChange: (updater: (s: SalarySettings) => SalarySettings) => void;
};

export function TaxSettingsCard({ settings, onChange }: Props) {
  return (
    <div className="card">
      <div className="label" style={{ marginBottom: 12 }}>🇩🇪 Steuer & Abzüge</div>

      {/* Steuerklasse — visual buttons */}
      <div style={{ marginBottom: 14 }}>
        <label className="label" style={{ marginBottom: 6, display: "inline-flex", alignItems: "center" }}>
          Steuerklasse
          <InfoTooltip title="Lohnsteuerklasse">
            Deine Steuerklasse laut Lohnsteuerkarte (I–VI).{"\n\n"}
            • I = Ledig / dauernd getrennt{"\n"}
            • II = Alleinerziehend{"\n"}
            • III = Verheiratet, höher verdienend{"\n"}
            • IV = Verheiratet, etwa gleich{"\n"}
            • V = Verheiratet, niedriger verdienend{"\n"}
            • VI = Zweitjob (höchste Steuer)
          </InfoTooltip>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
          {STEUERKLASSEN.map(({ value, label, hint }) => {
            const active = (settings.steuerklasse ?? "I") === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onChange(s => ({ ...s, steuerklasse: value }))}
                title={hint}
                style={{
                  padding: "10px 4px",
                  background: active ? "var(--accent)" : "var(--surface2)",
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 8,
                  color: active ? "white" : "var(--muted)",
                  fontFamily: "'Syne',sans-serif",
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: "pointer",
                  lineHeight: 1.1,
                }}
              >
                <div>{label}</div>
                <div style={{ fontSize: 8, fontWeight: 600, opacity: 0.8, marginTop: 2 }}>{hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 2: Kirchensteuer + Kind */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label className="label" style={{ display: "inline-flex", alignItems: "center" }}>
            Kirchensteuer
            <InfoTooltip title="Kirchensteuer">
              Wird auf die Lohnsteuer aufgeschlagen, wenn du Mitglied einer Kirche bist.{"\n\n"}
              • 9 % in den meisten Bundesländern{"\n"}
              • 8 % in Bayern und Baden-Württemberg{"\n"}
              • Keine, wenn nicht in der Kirche
            </InfoTooltip>
          </label>
          <select
            className="input"
            value={String(settings.kirchensteuer ?? 0)}
            onChange={(e) => onChange(s => ({ ...s, kirchensteuer: Number(e.target.value) as KirchensteuerRate }))}
            style={{ appearance: "none" }}
          >
            {KIRCHENSTEUER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" style={{ display: "inline-flex", alignItems: "center" }}>
            Kind im Haushalt
            <InfoTooltip title="Kinder & Pflegeversicherung">
              Beeinflusst nur die Pflegeversicherung (PV):{"\n\n"}
              • Mit Kind: 1,7 % PV{"\n"}
              • Ohne Kind (ab 23 Jahre): 2,35 % PV (Kinderlosenzuschlag 0,6 %){"\n\n"}
              Hat KEINEN Einfluss auf die Lohnsteuer.
            </InfoTooltip>
          </label>
          <button
            type="button"
            onClick={() => onChange(s => ({ ...s, hat_kinder: !s.hat_kinder }))}
            style={{
              width: "100%",
              padding: "10px 14px",
              background: settings.hat_kinder ? "var(--green)" : "var(--surface2)",
              border: `1px solid ${settings.hat_kinder ? "var(--green)" : "var(--border)"}`,
              borderRadius: 10,
              color: settings.hat_kinder ? "white" : "var(--muted)",
              fontFamily: "'Syne',sans-serif",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            {settings.hat_kinder ? "✓ Ja (PV 1,7%)" : "Nein (PV 2,35%)"}
          </button>
        </div>
      </div>

      {/* Manual mode */}
      <div style={{ background: "var(--surface2)", borderRadius: 10, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: settings.tax_mode === "manual" ? 10 : 0 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", display: "inline-flex", alignItems: "center" }}>
              Manueller Modus
              <InfoTooltip title="Manueller Abzugs-Modus">
                Wenn die automatische Berechnung stark von deiner echten Abrechnung abweicht, kannst du einen festen Gesamt-Abzugssatz eingeben.{"\n\n"}
                Beispiel: Echte Abrechnung zeigt 32 % Abzug → trage 32 ein.{"\n\n"}
                Stundly nutzt dann diesen Prozentsatz statt EStG-Berechnung + SV-Beiträge.
              </InfoTooltip>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Fester % statt echte Berechnung</div>
          </div>
          <button
            type="button"
            onClick={() => onChange(s => ({ ...s, tax_mode: s.tax_mode === "manual" ? "auto" : "manual" }))}
            style={{
              padding: "6px 14px",
              background: settings.tax_mode === "manual" ? "var(--accent)" : "var(--surface)",
              border: `1px solid ${settings.tax_mode === "manual" ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 999,
              color: settings.tax_mode === "manual" ? "white" : "var(--muted)",
              fontFamily: "'Syne',sans-serif",
              fontWeight: 700,
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {settings.tax_mode === "manual" ? "AN" : "AUS"}
          </button>
        </div>
        {settings.tax_mode === "manual" && (
          <div>
            <label className="label">Abzug in %</label>
            <input
              className="input"
              type="number" step="0.1" min="0" max="100"
              value={settings.manuell_abzug ?? 0}
              onChange={(e) => onChange(s => ({ ...s, manuell_abzug: parseFloat(e.target.value) || 0 }))}
            />
          </div>
        )}
      </div>

      {/* §3b EStG SFN-Zuschläge */}
      <div style={{ background: "var(--surface2)", borderRadius: 10, padding: 12, marginTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", display: "inline-flex", alignItems: "center" }}>
              §3b Zuschlag (SFN)
              <InfoTooltip title="Sonntag/Feiertag/Nacht-Zuschläge">
                §3b EStG: Zuschläge für Arbeit an Sonntagen, Feiertagen und in der Nacht
                (20-06 Uhr) sind steuer- und teilweise sv-frei.{"\n\n"}
                • Nacht 20-06 Uhr: 25 %{"\n"}
                • Sonntag: 50 %{"\n"}
                • Feiertag: 125 %{"\n"}
                • Überschneidung: additiv (z.B. Sonntag+Nacht = 75 %){"\n\n"}
                Grundlohn-Cap: 50 €/h steuerfrei, 25 €/h sv-frei.{"\n\n"}
                Wenn aktiv: automatisch aus deinen Arbeitszeiten berechnet und
                zum Brutto addiert. Netto wird höher (weniger Lohnsteuer + SV).{"\n\n"}
                Vereinfacht — exakte Payroll nur mit Steuerberater.
              </InfoTooltip>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Steuerfreie Zuschläge automatisch berechnen</div>
          </div>
          <button
            type="button"
            onClick={() => onChange(s => ({ ...s, sfn_enabled: !s.sfn_enabled }))}
            style={{
              padding: "6px 14px",
              background: settings.sfn_enabled ? "var(--accent)" : "var(--surface)",
              border: `1px solid ${settings.sfn_enabled ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 999,
              color: settings.sfn_enabled ? "white" : "var(--muted)",
              fontFamily: "'Syne',sans-serif",
              fontWeight: 700,
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {settings.sfn_enabled ? "AN" : "AUS"}
          </button>
        </div>
      </div>

      <div style={{
        marginTop: 12,
        padding: "10px 12px",
        background: "color-mix(in srgb, var(--yellow) 8%, transparent)",
        border: "1px solid color-mix(in srgb, var(--yellow) 25%, transparent)",
        borderRadius: 8,
        fontSize: 11,
        color: "var(--muted)",
        lineHeight: 1.55,
      }}>
        ⚠️ <strong style={{ color: "var(--text)" }}>Wichtig:</strong> Alle Brutto/Netto-Werte sind <strong style={{ color: "var(--yellow)" }}>Schätzungen</strong>.
        Die echte Lohnabrechnung kann abweichen — Krankenkassen-Zusatzbeitrag (kassenspezifisch),
        geldwerte Vorteile, Pauschalsteuer und Freibeträge werden nicht berücksichtigt.
        Für exakte Werte bitte deine echte Gehaltsabrechnung verwenden.
      </div>
    </div>
  );
}
