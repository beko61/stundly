"use client";

import { useState } from "react";
import type { DemoEntry, DemoDayType } from "./state";
import { useModalA11y } from "@/hooks/useModalA11y";

interface Props {
  date:    string;
  initial: DemoEntry | null;
  onSave:  (e: DemoEntry) => void;
  onDelete?: (date: string) => void;
  onClose: () => void;
}

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONTHS_DE = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

const DAY_TYPES: { id: DemoDayType; label: string; icon: string; color: string }[] = [
  { id: "arbeiten", label: "Arbeiten", icon: "✓",  color: "var(--green)"  },
  { id: "urlaub",   label: "Urlaub",   icon: "🏖", color: "var(--blue)"   },
  { id: "krank",    label: "Krank",    icon: "🤒", color: "var(--red)"    },
  { id: "frei",     label: "Frei",     icon: "—",  color: "var(--muted)"  },
];

export function EntryModal({ date, initial, onSave, onDelete, onClose }: Props) {
  const modalRef = useModalA11y<HTMLDivElement>({ onClose });
  const [type,  setType]  = useState<DemoDayType>(initial?.day_type ?? "arbeiten");
  const [start, setStart] = useState(initial?.start_time ?? "07:45");
  const [end,   setEnd]   = useState(initial?.end_time   ?? "17:00");
  const [pause, setPause] = useState(initial?.break_minutes ?? 60);

  const d = new Date(date);
  const dow = d.getDay();
  const day = d.getDate();
  const monthName = MONTHS_DE[d.getMonth()];
  const isArbeiten = type === "arbeiten";

  function handleSave() {
    const entry: DemoEntry = {
      date,
      day_type:      type,
      start_time:    isArbeiten ? start : null,
      end_time:      isArbeiten ? end   : null,
      break_minutes: isArbeiten ? pause : 0,
    };
    onSave(entry);
    onClose();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: 0,
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Eintrag bearbeiten"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: "16px 16px 0 0",
          width: "100%", maxWidth: 480,
          padding: "20px 20px calc(20px + env(safe-area-inset-bottom))",
          maxHeight: "92vh", overflowY: "auto",
          border: "1px solid var(--border)",
          borderBottom: "none",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {WEEKDAYS[dow]} · {monthName} 2026
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>
              {String(day).padStart(2, "0")}. {monthName}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            style={{
              background: "transparent", border: "none", color: "var(--muted)",
              fontSize: 24, cursor: "pointer",
              minWidth: 44, minHeight: 44, borderRadius: 8,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          >×</button>
        </div>

        {/* Status chips */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 18 }}>
          {DAY_TYPES.map((t) => {
            const active = type === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  padding: "10px 4px", borderRadius: 10,
                  background: active ? t.color : "var(--surface2)",
                  color: active ? "white" : "var(--muted)",
                  border: `1px solid ${active ? t.color : "var(--border)"}`,
                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                  fontFamily: "inherit",
                  minHeight: 60,
                }}
              >
                <span style={{ fontSize: 18 }}>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Time fields (sadece Arbeiten için) */}
        {isArbeiten ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="label">Start</label>
                <input
                  className="input"
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Ende</label>
                <input
                  className="input"
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label">Pause (Minuten)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={240}
                step={15}
                value={pause}
                onChange={(e) => setPause(Math.max(0, Math.min(240, Number(e.target.value) || 0)))}
              />
            </div>
          </div>
        ) : (
          <div style={{
            padding: "16px 18px",
            background: "var(--surface2)", border: "1px solid var(--border)",
            borderRadius: 10, fontSize: 13, color: "var(--muted)", lineHeight: 1.6,
          }}>
            {type === "urlaub" && "🏖 Urlaub-Tag — wird mit 8h Sollstunden gerechnet (Mo-Fr)."}
            {type === "krank"  && "🤒 Krankheitstag — wird mit 8h Sollstunden gerechnet (Mo-Fr)."}
            {type === "frei"   && "— Frei — 0h, wird nicht gerechnet."}
          </div>
        )}

        {/* Action row */}
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          {initial && onDelete && (
            <button
              type="button"
              onClick={() => { onDelete(date); onClose(); }}
              className="btn"
              style={{
                background: "transparent",
                border: "1px solid color-mix(in srgb, var(--red) 40%, transparent)",
                color: "var(--red)",
                minHeight: 44,
              }}
            >
              Löschen
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="btn btn-primary"
            style={{ flex: 1, minHeight: 44, fontSize: 14 }}
          >
            Speichern
          </button>
        </div>

        <div style={{ marginTop: 12, fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
          💡 Daten bleiben lokal — sicher dir dein Konto, um sie zu behalten.
        </div>
      </div>
    </div>
  );
}
