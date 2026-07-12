"use client";

import type { SalarySettings } from "@workly/shared";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { MINDESTLOHN_CURRENT, formatMindestlohn } from "@/lib/mindestlohn";

const MONTHS = [
  "Januar","Februar","März","April","Mai","Juni",
  "Juli","August","September","Oktober","November","Dezember",
];

const INPUT_ROWS: { key: keyof SalarySettings; label: string; tipTitle: string; tipBody: string }[] = [
  {
    key: "hourly_rate", label: "Stundenlohn (€)",
    tipTitle: "Stundenlohn",
    tipBody: "Dein Brutto-Stundenlohn. Grundlage für alle Berechnungen — Grundgehalt, Überstunden und Bonusbeträge.\n\nStandard für Handwerk: 15 €/h.\nGesetzlicher Mindestlohn 2026: 13,90 €/h.",
  },
  {
    key: "monthly_target_hours", label: "Sollstunden/Monat",
    tipTitle: "Sollstunden / Monat",
    tipBody: "Deine vertragliche Monatsarbeitszeit.\n\nVerwendung:\n• Lohnberechnung (Festgehalt = Sollstunden × Stundenlohn)\n• Tracker-Differenz (Über-/Unterstunden)\n\nTypisch 160-174h für Vollzeit.",
  },
  {
    key: "overtime_rate_multiplier", label: "Überstunden ×",
    tipTitle: "Überstunden-Multiplikator",
    tipBody: "Aufschlag für Stunden über deiner Sollzeit.\n\n• 1,00 = kein Extra (Überstunden wie normale Stunden)\n• 1,25 = 25 % Aufschlag (üblich)\n• 1,50 = 50 % Aufschlag (Wochenende/Nacht)",
  },
  {
    key: "night_shift_bonus", label: "Nachtzuschlag €/h",
    tipTitle: "Nachtzuschlag",
    tipBody: "Zusätzlicher Bonus pro Stunde für als 'Nachtschicht' markierte Einträge.\n\nWird auf den Stundenlohn aufgeschlagen, NICHT mit dem Überstundensatz multipliziert.",
  },
  {
    key: "notdienst_bonus", label: "Notdienst €/Tag",
    tipTitle: "Notdienst-Bonus",
    tipBody: "Pauschal pro Einsatz (unabhängig von der Dauer).\n\n⏱ Auszahlungs-Zeitpunkt:\nNotdienst aus Vormonat wird im aktuellen Monat ausgezahlt. Beispiel: Januar-Notdienst → Februar-Brutto.",
  },
  {
    key: "urlaub_anspruch", label: "Urlaubsanspruch / Jahr",
    tipTitle: "Urlaubsanspruch",
    tipBody: "Deine jährlichen Urlaubstage laut Vertrag.\n\n• 24 Tage = BUrlG-Minimum (6-Tage-Woche)\n• 20 Tage = BUrlG-Minimum (5-Tage-Woche)\n• 30 Tage = übliche Regelung im Handwerk\n\nWird im Tracker für 'Urlaub übrig' verwendet.",
  },
];

type Props = {
  settings:        SalarySettings;
  onChange:        (updater: (s: SalarySettings) => SalarySettings) => void;
  loading:         boolean;
  settingsSaved:   boolean;
  month:           number;
  entriesCount:    number;
  totalGross:      number;
  netto:           number;
  fmtEur:          (n: number) => string;
  whatIfNettoDelta: number;
};

export function SettingsCard({
  settings, onChange, loading, settingsSaved, month,
  entriesCount, totalGross, netto, fmtEur, whatIfNettoDelta,
}: Props) {
  return (
    <>
      {/* ── Settings ── */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span className="label">⚙️ Einstellungen</span>
          {settingsSaved && <span style={{ fontSize: 10, color: "var(--green)", fontWeight: 700 }}>✓ Gespeichert</span>}
        </div>

        {/* Live preview — Settings değişince anında güncellenir */}
        {!loading && entriesCount > 0 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 10, marginBottom: 14,
            padding: "10px 14px",
            background: "color-mix(in srgb, var(--accent2) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent2) 25%, transparent)",
            borderRadius: 10,
            fontFamily: "'DM Mono',monospace",
            fontSize: 12,
          }}>
            <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "'Syne',sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              ⚡ Live {MONTHS[month-1]}
            </span>
            <span style={{ color: "var(--green)" }}>{fmtEur(totalGross)} <span style={{ fontSize: 9, color: "var(--muted)" }}>Brutto</span></span>
            <span style={{ color: "var(--muted)" }}>→</span>
            <span style={{ color: "var(--accent2)" }}>{fmtEur(netto)} <span style={{ fontSize: 9, color: "var(--muted)" }}>Netto</span></span>
          </div>
        )}
        <div className="settings-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {INPUT_ROWS.map(({ key, label, tipTitle, tipBody }) => {
            const isHourly = key === "hourly_rate";
            const rate = settings.hourly_rate ?? 0;
            const belowMindestlohn = isHourly && rate > 0 && rate < MINDESTLOHN_CURRENT;
            return (
              <div key={key}>
                <label className="label" style={{ display: "inline-flex", alignItems: "center" }}>
                  {label}
                  <InfoTooltip title={tipTitle}>{tipBody}</InfoTooltip>
                </label>
                <input
                  className="input" type="number" step="0.01"
                  value={settings[key] as number}
                  onChange={(e) => onChange(s => ({ ...s, [key]: parseFloat(e.target.value) || 0 }))}
                  style={isHourly && belowMindestlohn ? { borderColor: "var(--red)" } : undefined}
                />
                {isHourly && (
                  <div style={{ fontSize: 10, marginTop: 4, lineHeight: 1.5 }}>
                    <div style={{ color: belowMindestlohn ? "var(--red)" : "var(--muted)" }}>
                      {belowMindestlohn ? (
                        <>⚠️ Unter dem gesetzlichen Mindestlohn ({formatMindestlohn()}/h) — bitte prüfen.</>
                      ) : (
                        <>💶 Gesetzlicher Mindestlohn {new Date().getFullYear()}: <strong style={{ color: "var(--text)" }}>{formatMindestlohn()}/h</strong></>
                      )}
                    </div>
                    {entriesCount > 0 && whatIfNettoDelta > 0 && (
                      <div style={{ color: "var(--green)", marginTop: 2 }}>
                        💡 <strong>+1 €/h</strong> ≈ +{fmtEur(whatIfNettoDelta)} / Monat Netto
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Beschäftigung & Urlaub (BUrlG) ── */}
      <div className="card">
        <div className="label" style={{ marginBottom: 12 }}>💼 Beschäftigung & Urlaub</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          <div>
            <label className="label" style={{ display: "inline-flex", alignItems: "center" }}>
              Beschäftigt seit
              <InfoTooltip title="§5 BUrlG Zwölftelung">
                Datum, an dem dein Arbeitsverhältnis begonnen hat.{"\n\n"}
                Wenn im laufenden Jahr, wird der Urlaubsanspruch anteilig
                gekürzt (1/12 pro fehlendem Kalendermonat).{"\n\n"}
                Nach 6 Monaten Wartezeit (§4 BUrlG) besteht der volle Anspruch.
              </InfoTooltip>
            </label>
            <input
              className="input" type="date"
              value={settings.employment_start_date ?? ""}
              onChange={(e) => onChange(s => ({ ...s, employment_start_date: e.target.value || null }))}
            />
          </div>
          <div>
            <label className="label" style={{ display: "inline-flex", alignItems: "center" }}>
              Beschäftigt bis (optional)
              <InfoTooltip title="Beschäftigungsende">
                Datum, an dem dein Arbeitsverhältnis endet (letzter Arbeitstag).
                Nur ausfüllen wenn befristet oder Kündigung ausgesprochen.
                Leer = weiterhin aktiv.
              </InfoTooltip>
            </label>
            <input
              className="input" type="date"
              value={settings.employment_end_date ?? ""}
              onChange={(e) => onChange(s => ({ ...s, employment_end_date: e.target.value || null }))}
            />
          </div>
          <div>
            <label className="label" style={{ display: "inline-flex", alignItems: "center" }}>
              Übertrag Vorjahr (Tage)
              <InfoTooltip title="§7 III BUrlG Übertrag">
                Übertragene Urlaubstage aus dem Vorjahr, die noch nicht
                genommen wurden.{"\n\n"}
                Diese Tage verfallen am 31.03. des laufenden Jahres, wenn
                sie bis dahin nicht genommen wurden (§7 III S. 2 BUrlG).{"\n\n"}
                Übertragung ist nur bei dringenden betrieblichen oder
                persönlichen Gründen zulässig — Abstimmung mit AG.
              </InfoTooltip>
            </label>
            <input
              className="input" type="number" step="0.5" min={0} max={60}
              value={settings.urlaub_carry_over ?? 0}
              onChange={(e) => onChange(s => ({ ...s, urlaub_carry_over: parseFloat(e.target.value) || 0 }))}
            />
          </div>
        </div>
      </div>
    </>
  );
}
