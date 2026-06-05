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

  const now   = new Date();
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

  return (
    <div className="page-header">
      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>
          Zeiterfassung
        </h1>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {YEARS.map((y) => (
            <button key={y} onClick={() => setMonth(y, month)} style={{
              background:  y === year ? "var(--accent)"   : "var(--surface2)",
              border:      `1px solid ${y === year ? "var(--accent)" : "var(--border)"}`,
              color:       y === year ? "white"           : "var(--muted)",
              padding:     "6px 10px", borderRadius: 8, cursor: "pointer",
              fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 700,
            }}>{y}</button>
          ))}

          {!isCurrentMonth && (
            <button onClick={goToday} style={{
              background: "var(--surface2)", border: "1px solid var(--accent)", color: "var(--accent2)",
              padding: "6px 12px", borderRadius: 8, cursor: "pointer",
              fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 700,
            }}>📍 Heute</button>
          )}
        </div>
      </div>

      {/* Month nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={prev} style={{
          background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)",
          width: 40, height: 40, borderRadius: 10, cursor: "pointer", fontSize: 18,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>‹</button>

        <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", flex: 1, textAlign: "center" }}>
          {MONTHS[month - 1]}
        </h2>

        <button onClick={next} style={{
          background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)",
          width: 40, height: 40, borderRadius: 10, cursor: "pointer", fontSize: 18,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>›</button>
      </div>

      <div style={{ textAlign: "center", fontSize: 11, color: "var(--green)", marginTop: 8 }}>
        ● Synchronisiert ✓
      </div>
    </div>
  );
}

