"use client";

import { useEffect, useState } from "react";
import { useTrackerStore } from "@/store/trackerStore";
import { createClient } from "@/lib/supabase/client";

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const YEARS  = [2025, 2026, 2027, 2028];

export function MonthNav() {
  const { year, month, setMonth } = useTrackerStore();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      const name = session?.user?.user_metadata?.["full_name"] as string | undefined;
      setUserName((name ?? session?.user?.email ?? "").toUpperCase());
    });
  }, []);

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

  const yearSelectStyle: React.CSSProperties = {
    background:        "var(--accent)",
    border:            "1px solid var(--accent)",
    color:             "white",
    padding:           "10px 28px 10px 14px",
    borderRadius:      8,
    minHeight:         44,
    cursor:            "pointer",
    fontFamily:        "'Syne',sans-serif",
    fontSize:          12,
    fontWeight:        700,
    appearance:        "none",
    WebkitAppearance:  "none",
    MozAppearance:     "none",
    backgroundImage:   "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='white' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
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
    <div className="page-header">
      <div style={{
        display:        "flex",
        justifyContent: "space-between",
        alignItems:     "flex-start",
        gap:            12,
        flexWrap:       "nowrap",
      }}>
        {/* Sol: başlık */}
        <h1 style={{
          fontSize:      13,
          fontWeight:    700,
          letterSpacing: "-0.01em",
          margin:        0,
          paddingTop:    6,
          minWidth:      0,
          flexShrink:    1,
          overflow:      "hidden",
          textOverflow:  "ellipsis",
          whiteSpace:    "nowrap",
          color:         "var(--muted)",
          textTransform: "uppercase",
        }}>
          Zeiterfassung
        </h1>

        {/* Sağ: yıl üstte, ay altta — kompakt stack */}
        <div style={{
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "flex-end",
          gap:            6,
          flexShrink:     0,
        }}>
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
              fontSize:    14,
              fontWeight:  800,
              minWidth:    74,
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
