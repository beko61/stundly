"use client";

import type React from "react";
import { useTrackerStore } from "@/store/trackerStore";

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const YEARS  = [2025, 2026, 2027, 2028];

export function MonthNav() {
  const { year, month, setMonth } = useTrackerStore();
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  function prev() {
    if (month === 1) setMonth(year - 1, 12);
    else setMonth(year, month - 1);
  }

  function next() {
    if (month === 12) setMonth(year + 1, 1);
    else setMonth(year, month + 1);
  }

  function goToday() {
    const t = new Date();
    setMonth(t.getFullYear(), t.getMonth() + 1);
    setTimeout(() => {
      const el = document.getElementById("today-entry");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
  }

  // Gleiche Optik wie die Pfeil-Buttons (vorher knallig gefüllt → wirkte wie Haupt-Aktion)
  const yearSelectStyle: React.CSSProperties = {
    background:        "var(--surface2)",
    border:            "1px solid var(--border)",
    color:             "var(--text)",
    padding:           "10px 28px 10px 14px",
    borderRadius:      10,
    minHeight:         44,
    cursor:            "pointer",
    fontFamily:        "'DM Mono',monospace",
    fontSize:          14,
    fontWeight:        500,
    appearance:        "none",
    WebkitAppearance:  "none",
    MozAppearance:     "none",
    backgroundImage:   "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
    backgroundRepeat:  "no-repeat",
    backgroundPosition:"right 8px center",
    backgroundSize:    "10px",
  };

  // WCAG 2.5.5 Target Size — min 44×44 CSS px
  const arrowBtnStyle: React.CSSProperties = {
    background:     "var(--surface2)",
    border:         "1px solid var(--border)",
    color:          "var(--text)",
    width:          44,
    height:         44,
    borderRadius:   10,
    cursor:         "pointer",
    fontSize:       18,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
    padding:        0,
  };

  return (
    <div className="page-header page-header-contained">
      <div style={{
        display:        "flex",
        justifyContent: "space-between",
        alignItems:     "center",
        gap:            12,
        flexWrap:       "wrap",
      }}>
        <h1>Zeiterfassung</h1>

        {/* Jahr + Monat in einer Zeile, rechtsbündig */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <select
            value={year}
            onChange={(e) => setMonth(Number(e.target.value), month)}
            aria-label="Jahr auswählen"
            style={yearSelectStyle}
          >
            {YEARS.map((y) => (
              <option key={y} value={y} style={{ background: "var(--surface)", color: "var(--text)" }}>{y}</option>
            ))}
          </select>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={prev} aria-label="Vorheriger Monat" style={arrowBtnStyle}>‹</button>
            <span style={{
              fontSize:    16,
              fontWeight:  800,
              minWidth:    100,
              textAlign:   "center",
              letterSpacing: "-0.01em",
            }}>
              {MONTHS[month - 1]}
            </span>
            <button onClick={next} aria-label="Nächster Monat" style={arrowBtnStyle}>›</button>
            {!isCurrentMonth && (
              <button
                onClick={goToday}
                aria-label="Heute"
                title="Heute"
                style={{
                  ...arrowBtnStyle,
                  background:  "var(--surface2)",
                  borderColor: "var(--accent)",
                  color:       "var(--accent2)",
                  marginLeft:  2,
                }}
              >📍</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
