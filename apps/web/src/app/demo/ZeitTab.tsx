"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DemoEntry, DemoState } from "./state";
import { entryNetMinutes, fmtHM } from "./state";
import { EntryModal } from "./EntryModal";

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const STATUS_COLOR: Record<string, string> = {
  arbeiten: "var(--green)",
  urlaub:   "var(--blue)",
  krank:    "var(--red)",
  frei:     "var(--muted)",
};
const STATUS_ICON: Record<string, string> = {
  arbeiten: "✓", urlaub: "🏖", krank: "🤒", frei: "—",
};
const STATUS_LABEL: Record<string, string> = {
  arbeiten: "Arbeiten", urlaub: "Urlaub", krank: "Krank", frei: "Frei",
};

interface Props {
  state:       DemoState;
  onUpsert:    (e: DemoEntry) => void;
  onRemove:    (date: string) => void;
}

export function ZeitTab({ state, onUpsert, onRemove }: Props) {
  const [modalDate, setModalDate] = useState<string | null>(null);

  // Juni 2026 = 30 günlük tam liste
  const days = useMemo(() => {
    const year = 2026, month = 6;
    const daysInMonth = new Date(year, month, 0).getDate();
    const entryMap = new Map(state.entries.map((e) => [e.date, e]));
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dow = new Date(year, month - 1, d).getDay();
      return { dateStr, dow, day: d, entry: entryMap.get(dateStr) ?? null };
    });
  }, [state.entries]);

  // Live summary (Juni Soll + Ist + Diff)
  const summary = useMemo(() => {
    const workedMin = state.entries.reduce((s, e) => s + entryNetMinutes(e), 0);
    const sollMin = state.settings.monthly_target_hours * 60;
    const diffMin = workedMin - sollMin;
    return { workedMin, sollMin, diffMin };
  }, [state]);

  const modalEntry = modalDate ? (state.entries.find((e) => e.date === modalDate) ?? null) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>⏱ Zeiterfassung</h1>
        <p style={{ fontSize: 13, color: "var(--muted)" }}>
          Tippe einen Tag, um Start/Ende/Pause zu setzen. Differenz + Lohn rechnen sich live.
        </p>
      </div>

      {/* Live Summary Bar */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
        gap: 8, padding: 12,
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
      }}>
        <SummaryCell label="Soll"      value={fmtHM(summary.sollMin)}   />
        <SummaryCell label="Ist"       value={fmtHM(summary.workedMin)} color="var(--green)" />
        <SummaryCell
          label="Differenz"
          value={(summary.diffMin >= 0 ? "+" : "-") + fmtHM(Math.abs(summary.diffMin))}
          color={summary.diffMin >= 0 ? "var(--green)" : "var(--red)"}
        />
      </div>

      {/* Day list — tüm Juni */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {days.map(({ dateStr, dow, day, entry }) => {
          const isWeekend = dow === 0 || dow === 6;
          const netMin = entry ? entryNetMinutes(entry) : 0;
          const color = entry ? STATUS_COLOR[entry.day_type] ?? "var(--muted)" : "var(--border)";
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => setModalDate(dateStr)}
              style={{
                width: "100%", textAlign: "left", cursor: "pointer",
                background: "var(--surface)",
                border: `1px solid ${entry ? color : "var(--border)"}`,
                borderRadius: 12, padding: "12px 14px",
                opacity: isWeekend && !entry ? 0.55 : 1,
                display: "flex", alignItems: "center", gap: 12,
                fontFamily: "inherit",
                transition: "border-color 0.15s, background 0.15s",
              }}
            >
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 500,
                color: "var(--muted)", width: 28, textAlign: "center", flexShrink: 0,
              }}>
                {String(day).padStart(2, "0")}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                  {WEEKDAYS[dow]}
                </div>
                {entry ? (
                  <div style={{ fontSize: 13, fontWeight: 700, color, marginTop: 1 }}>
                    {STATUS_ICON[entry.day_type]} {STATUS_LABEL[entry.day_type]}
                    {entry.start_time && entry.end_time && (
                      <span style={{ color: "var(--muted)", fontWeight: 500, marginLeft: 8, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                        {entry.start_time} – {entry.end_time}
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>
                    {isWeekend ? "Wochenende" : "+ Eintrag hinzufügen"}
                  </div>
                )}
              </div>
              {entry && netMin > 0 && (
                <span style={{
                  fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 600,
                  color, flexShrink: 0,
                }}>
                  {fmtHM(netMin)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Hint footer */}
      <div style={{
        fontSize: 12, color: "var(--muted)", textAlign: "center",
        padding: 14, background: "var(--surface)", borderRadius: 10,
        border: "1px dashed var(--border)", marginTop: 8,
      }}>
        💡 Klick einen Tag → setze Zeiten → Differenz + Brutto/Netto rechnen sich
        in <strong style={{ color: "var(--text)" }}>Übersicht</strong> + <strong style={{ color: "var(--text)" }}>Lohn</strong> live mit.
        <br/>
        Daten bleiben lokal in deinem Browser. <Link href="/register" style={{ color: "var(--accent2)", fontWeight: 700 }}>
          Konto erstellen, um zu sichern →
        </Link>
      </div>

      {modalDate && (
        <EntryModal
          date={modalDate}
          initial={modalEntry}
          onSave={onUpsert}
          onDelete={onRemove}
          onClose={() => setModalDate(null)}
        />
      )}
    </div>
  );
}

function SummaryCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
      <div style={{
        fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 700,
        marginTop: 2, color: color ?? "var(--text)",
      }}>{value}</div>
    </div>
  );
}
