"use client";

import { YearPicker } from "@/components/ui/YearPicker";

const MONTHS = [
  "Januar","Februar","März","April","Mai","Juni",
  "Juli","August","September","Oktober","November","Dezember",
];

type Props = {
  year: number;
  month: number;
  moneyHidden: boolean;
  onYearChange: (y: number) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onTogglePrivacy: () => void;
};

export function SalaryHeader({
  year, month, moneyHidden,
  onYearChange, onPrevMonth, onNextMonth, onTogglePrivacy,
}: Props) {
  return (
    <div className="page-header">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Gehaltsübersicht</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={onTogglePrivacy}
            title={moneyHidden ? "Beträge anzeigen" : "Beträge verbergen"}
            aria-label={moneyHidden ? "Beträge anzeigen" : "Beträge verbergen"}
            style={{
              background: moneyHidden ? "color-mix(in srgb, var(--blue) 14%, transparent)" : "var(--surface2)",
              border: `1px solid ${moneyHidden ? "color-mix(in srgb, var(--blue) 35%, transparent)" : "var(--border)"}`,
              color: moneyHidden ? "var(--blue)" : "var(--muted)",
              width: 36, height: 30, borderRadius: 8, cursor: "pointer",
              fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {moneyHidden ? "🔒" : "👁"}
          </button>
          <YearPicker value={year} onChange={onYearChange} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <button onClick={onPrevMonth} style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", width: 44, height: 44, borderRadius: 10, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} aria-label="Vorheriger Monat">‹</button>
        <h1 style={{ fontSize: 18, fontWeight: 800, minWidth: 90, textAlign: "center" }}>{MONTHS[month - 1]}</h1>
        <button onClick={onNextMonth} style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", width: 44, height: 44, borderRadius: 10, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} aria-label="Nächster Monat">›</button>
      </div>
    </div>
  );
}
