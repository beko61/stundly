"use client";

/**
 * Aylık maaş detay bloğu — sadece o ayda entry varsa render edilir
 * (parent'ta empty-state kontrolü). İçindekiler:
 *   1. HERO card — Brutto → Netto hero grid
 *   2. Urlaubskonto card (koşullu) — §5 + §7 BUrlG
 *   3. Krankheit alert (koşullu) — §3 EntgFG > 6 hafta
 *   4. Verdienst-Aufschlüsselung — brutto row-by-row
 *   5. Abzüge im Detail (koşullu) — auto mode + brutto > 0
 *   6. Monatsabrechnung eintragen card — kullanıcının gerçek abrechnung entry'si
 */

import type {
  SalarySettings,
  KrankheitEpisode,
  SalaryBreakdown,
  NettoBreakdown,
} from "@workly/shared";
import { formatDuration } from "@workly/shared";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

const MONTHS = [
  "Januar","Februar","März","April","Mai","Juni",
  "Juli","August","September","Oktober","November","Dezember",
];

type Urlaubskonto = {
  entitlement: {
    anspruch:              number;
    isProrated:            boolean;
    fullMonths:            number;
    waitingPeriodActive:   boolean;
  };
  usedThisYear: number;
  konto: {
    carryOverAvailable:  number;
    verfallWarning:      boolean;
    verfallDate:         string;
    daysUntilVerfall:    number;
    remaining:           number;
  };
};

type MonthRecord = {
  id:      string;
  user_id: string;
  year:    number;
  month:   number;
  brutto:  number;
  netto:   number;
  note:    string | null;
};

type Props = {
  year:                      number;
  month:                     number;
  settings:                  SalarySettings;
  breakdown:                 SalaryBreakdown;
  nettoCalc:                 NettoBreakdown;
  urlaubskonto:              Urlaubskonto;
  krankheitOverLimit:        KrankheitEpisode[];
  currentMonthNotdienstDays: number;
  curRecord:                 MonthRecord | undefined;
  fmtEur:                    (n: number) => string;
  onOpenRecordModal:         () => void;
  onJumpToPrevMonthTracker:  () => void;
};

export function MonthBreakdown({
  year, month, settings, breakdown, nettoCalc, urlaubskonto,
  krankheitOverLimit, currentMonthNotdienstDays, curRecord,
  fmtEur, onOpenRecordModal, onJumpToPrevMonthTracker,
}: Props) {
  return (
    <>
      {/* HERO — Brutto → Netto */}
      <div className="card purple">
        <div className="label" style={{ marginBottom: 12, display: "inline-flex", alignItems: "center" }}>
          💰 {MONTHS[month-1]} — Schätzung
          <InfoTooltip title="Warum nur eine Schätzung?" color="var(--yellow)" icon="⚠️">
            Die echte Lohnabrechnung kann abweichen, weil:{"\n\n"}
            • <strong>Krankenkassen-Zusatzbeitrag</strong> variiert je Kasse (0,9 – 2,5 %){"\n"}
            • <strong>Geldwerte Vorteile</strong> (Dienstwagen, Job-Ticket, Essensgutscheine){"\n"}
            • <strong>Pauschalsteuer</strong> bei Minijobs oder Bonuszahlungen{"\n"}
            • <strong>Vermögenswirksame Leistungen</strong>, betriebliche Altersvorsorge{"\n"}
            • <strong>Freibeträge</strong> auf deiner Steuerkarte (Werbungskosten, Kinderfreibetrag){"\n\n"}
            Stundly nutzt EStG §32a 2024 + Standard-SV-Sätze. Genauigkeit ±5 % bei mittlerem Brutto.{"\n\n"}
            Für exakte Werte → echte Gehaltsabrechnung verwenden.
          </InfoTooltip>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <div style={{ textAlign: "center", background: "color-mix(in srgb, var(--green) 12%, transparent)", borderRadius: 12, padding: "12px 8px" }}>
            <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>BRUTTO</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 500, color: "var(--green)" }}>
              {fmtEur(breakdown.total_gross)}
            </div>
          </div>
          <div style={{ fontSize: 22, color: "var(--muted)" }}>→</div>
          <div style={{ textAlign: "center", background: "color-mix(in srgb, var(--accent2) 14%, transparent)", borderRadius: 12, padding: "12px 8px" }}>
            <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>NETTO</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 500, color: "var(--accent2)" }}>
              {fmtEur(nettoCalc.netto)}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "center", fontSize: 11, color: "var(--muted)" }}>
          Abzüge gesamt: <strong style={{ color: "var(--red)" }}>{fmtEur(nettoCalc.abzuege.gesamt)}</strong>
          {nettoCalc.abzuege.manuell && <> (manuell {nettoCalc.abzuege.manuellProzent}%)</>}
        </div>
      </div>

      {/* §5+§7 BUrlG — Urlaubskonto (Zwölftelung + Verfall 31.03) */}
      {(urlaubskonto.entitlement.isProrated || urlaubskonto.konto.carryOverAvailable > 0 || urlaubskonto.konto.verfallWarning) && (
        <div
          className="card"
          style={{
            background: urlaubskonto.konto.verfallWarning
              ? "color-mix(in srgb, var(--red) 10%, var(--surface))"
              : "color-mix(in srgb, var(--accent2) 8%, var(--surface))",
            border: urlaubskonto.konto.verfallWarning
              ? "1px solid color-mix(in srgb, var(--red) 35%, transparent)"
              : "1px solid color-mix(in srgb, var(--accent2) 30%, transparent)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 8, display: "inline-flex", alignItems: "center" }}>
            🏖 Urlaubskonto {year}
            <InfoTooltip title="BUrlG Zwölftelung + Verfall">
              §5 BUrlG (Zwölftelung): Wenn dein Arbeitsverhältnis nicht das
              ganze Jahr besteht, verringert sich der Anspruch um 1/12 pro
              fehlendem Kalendermonat.{"\n\n"}
              §7 III BUrlG (Übertrag): Urlaub muss im Kalenderjahr genommen
              werden. Übertrag aus dem Vorjahr verfällt am 31.03.
              des laufenden Jahres, wenn er bis dahin nicht genommen wurde.{"\n\n"}
              Einstellungen unten:
              {" "}Beschäftigungsbeginn/-ende + Übertrag aus Vorjahr.
            </InfoTooltip>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, fontSize: 12 }}>
            <div>
              <div style={{ color: "var(--muted)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Anspruch</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500 }}>
                {urlaubskonto.entitlement.anspruch} Tage
              </div>
              {urlaubskonto.entitlement.isProrated && (
                <div style={{ fontSize: 10, color: "var(--muted)" }}>
                  {urlaubskonto.entitlement.fullMonths}/12 Monate (§5)
                </div>
              )}
            </div>
            {urlaubskonto.konto.carryOverAvailable > 0 && (
              <div>
                <div style={{ color: "var(--muted)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Übertrag</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500 }}>
                  +{urlaubskonto.konto.carryOverAvailable}
                </div>
                <div style={{ fontSize: 10, color: urlaubskonto.konto.verfallWarning ? "var(--red)" : "var(--muted)" }}>
                  Verfall {urlaubskonto.konto.verfallDate}
                </div>
              </div>
            )}
            <div>
              <div style={{ color: "var(--muted)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Genommen</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500 }}>
                {urlaubskonto.usedThisYear} Tage
              </div>
            </div>
            <div>
              <div style={{ color: "var(--muted)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Rest</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500, color: urlaubskonto.konto.remaining < 0 ? "var(--red)" : "var(--green)" }}>
                {urlaubskonto.konto.remaining} Tage
              </div>
            </div>
          </div>
          {urlaubskonto.konto.verfallWarning && (
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--red)", fontWeight: 700 }}>
              ⚠️ {urlaubskonto.konto.carryOverAvailable} Übertrag-Tag(e) verfallen in {urlaubskonto.konto.daysUntilVerfall} Tagen (31.03.)
            </div>
          )}
          {urlaubskonto.entitlement.waitingPeriodActive && (
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
              ℹ️ §4 BUrlG Wartezeit: Voller Urlaubsanspruch erst nach 6 Monaten Beschäftigung.
            </div>
          )}
        </div>
      )}

      {/* §3 EntgFG — Krankheit über 6 Wochen */}
      {krankheitOverLimit.length > 0 && (
        <div
          role="alert"
          className="card"
          style={{
            background: "color-mix(in srgb, var(--red) 10%, var(--surface))",
            border: "1px solid color-mix(in srgb, var(--red) 35%, transparent)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--red)", marginBottom: 6, display: "inline-flex", alignItems: "center" }}>
            🩺 §3 EntgFG — Lohnfortzahlung endet
            <InfoTooltip title="6 Wochen Lohnfortzahlung">
              §3 EntgFG: Der Arbeitgeber zahlt bei Krankheit maximal
              6 Wochen (42 Kalendertage) das volle Gehalt weiter.{"\n\n"}
              Ab dem 43. Tag zahlt die Krankenkasse Krankengeld:{"\n"}
              • 70 % des Bruttos{"\n"}
              • Höchstens 90 % des Nettos{"\n\n"}
              Diese Anzeige nutzt eine vereinfachte Kettenlogik
              (kalendarisch aufeinanderfolgende Krank-Einträge).
              Fortsetzungserkrankung nach §3 II EntgFG wird nicht modelliert.
            </InfoTooltip>
          </div>
          {krankheitOverLimit.map(ep => (
            <div key={ep.start} style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.55 }}>
              <strong style={{ color: "var(--text)" }}>{ep.start} — {ep.end}</strong>
              {" · "}{ep.days} Kalendertage{" · "}
              <span style={{ color: "var(--red)" }}>
                {ep.excessDates.length} Tag{ep.excessDates.length === 1 ? "" : "e"} über Limit
              </span>
              {" · ab "}{ep.excessDates[0]}{" Krankengeld"}
            </div>
          ))}
        </div>
      )}

      {/* Verdienst breakdown */}
      <div className="card">
        <div className="label" style={{ marginBottom: 10 }}>📊 Verdienst-Aufschlüsselung</div>
        {(() => {
          const prevMonthName = MONTHS[(month - 2 + 12) % 12]!;
          const rows: Array<{ key: string; label: string; value: string; clickable: boolean }> = [
            { key: "hours",     label: "Gearbeitete Stunden",   value: formatDuration(Math.round(breakdown.worked_hours * 60)), clickable: false },
            { key: "base",      label: "Grundgehalt",           value: fmtEur(breakdown.base_pay),           clickable: false },
            { key: "overtime",  label: "Überstundenvergütung",  value: fmtEur(breakdown.overtime_pay),       clickable: false },
            { key: "night",     label: "Nachtzuschlag",         value: fmtEur(breakdown.night_shift_bonus),  clickable: false },
            {
              key:   "notdienst",
              label: currentMonthNotdienstDays > 0
                ? `Notdienst-Bonus (${currentMonthNotdienstDays}× aus ${prevMonthName}) →`
                : `Notdienst-Bonus (0× aus ${prevMonthName})`,
              value:     fmtEur(breakdown.notdienst_bonus),
              clickable: currentMonthNotdienstDays > 0,
            },
          ];
          if (settings.sfn_enabled && breakdown.sfn_zuschlag > 0) {
            rows.push({
              key: "sfn",
              label: "§3b Zuschlag (SFN, steuerfrei-Anteil)",
              value: fmtEur(breakdown.sfn_zuschlag),
              clickable: false,
            });
          }
          return rows;
        })().map(({ key, label, value, clickable }) => {
          const onClick = clickable && key === "notdienst" ? onJumpToPrevMonthTracker : undefined;
          return (
            <div
              key={key}
              onClick={onClick}
              title={clickable ? "Klick: zu Notdienst-Einträgen im Tracker springen" : undefined}
              style={{
                display: "flex", justifyContent: "space-between",
                padding: "7px 0",
                borderBottom: "1px solid var(--border)",
                cursor: clickable ? "pointer" : "default",
                ...(clickable ? {
                  marginLeft: -6, marginRight: -6, paddingLeft: 6, paddingRight: 6, borderRadius: 6,
                  transition: "background 0.15s",
                } : {}),
              }}
              onMouseEnter={clickable ? (e) => { (e.currentTarget as HTMLDivElement).style.background = "color-mix(in srgb, var(--orange) 8%, transparent)"; } : undefined}
              onMouseLeave={clickable ? (e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; } : undefined}
            >
              <span style={{ fontSize: 13, color: clickable ? "var(--orange)" : "var(--muted)", fontWeight: clickable ? 700 : 400 }}>{label}</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13 }}>{value}</span>
            </div>
          );
        })}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Brutto Gesamt</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500, color: "var(--green)" }}>
            {fmtEur(breakdown.total_gross)}
          </span>
        </div>
      </div>

      {/* Abzüge breakdown — only in auto mode */}
      {!nettoCalc.abzuege.manuell && breakdown.total_gross > 0 && (
        <div className="card red">
          <div className="label" style={{ marginBottom: 10 }}>🧾 Abzüge im Detail</div>
          {[
            { label: "Lohnsteuer",          value: nettoCalc.abzuege.lohnsteuer },
            { label: "Solidaritätszuschlag", value: nettoCalc.abzuege.soli },
            { label: "Kirchensteuer",       value: nettoCalc.abzuege.kirchensteuer },
            { label: "Rentenversicherung (RV)", value: nettoCalc.abzuege.rv },
            { label: "Arbeitslosenversicherung (AV)", value: nettoCalc.abzuege.av },
            { label: "Krankenversicherung (KV)", value: nettoCalc.abzuege.kv },
            { label: "Pflegeversicherung (PV)", value: nettoCalc.abzuege.pv },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: value > 0 ? "var(--red)" : "var(--muted)" }}>
                − {fmtEur(value)}
              </span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Summe Abzüge</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 500, color: "var(--red)" }}>
              − {fmtEur(nettoCalc.abzuege.gesamt)}
            </span>
          </div>
        </div>
      )}

      {/* ── Monatsabrechnung eintragen ── */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span className="label">🧾 Abrechnung {MONTHS[month-1]}</span>
          <button
            onClick={onOpenRecordModal}
            style={{
              background: "var(--accent)", border: "none", color: "white",
              padding: "6px 12px", borderRadius: 8, cursor: "pointer",
              fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 700,
            }}
          >
            {curRecord ? "✏️ Bearbeiten" : "+ Eintragen"}
          </button>
        </div>

        {curRecord ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>BRUTTO</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500, color: "var(--green)" }}>{fmtEur(curRecord.brutto)}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>NETTO</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500, color: "var(--blue)" }}>{fmtEur(curRecord.netto)}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>STEUER</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500, color: "var(--red)" }}>{fmtEur(curRecord.brutto - curRecord.netto)}</div>
            </div>
            {curRecord.note && (
              <div style={{ gridColumn: "1/-1", fontSize: 12, color: "var(--muted)", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                📝 {curRecord.note}
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "16px 0", color: "var(--muted)", fontSize: 13 }}>
            Noch keine Abrechnung eingetragen.
          </div>
        )}
      </div>
    </>
  );
}
