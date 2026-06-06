"use client";

interface Props {
  value: number;
  onChange: (year: number) => void;
  years?: number[];
}

const DEFAULT_YEARS = [2025, 2026, 2027, 2028];

const CARET_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='white' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")";

export function YearPicker({ value, onChange, years = DEFAULT_YEARS }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label="Jahr auswählen"
      style={{
        background: "var(--accent)",
        border: "1px solid var(--accent)",
        color: "white",
        padding: "6px 28px 6px 12px",
        borderRadius: 8,
        cursor: "pointer",
        fontFamily: "'Syne',sans-serif",
        fontSize: 13,
        fontWeight: 700,
        appearance: "none",
        WebkitAppearance: "none",
        MozAppearance: "none",
        backgroundImage: CARET_BG,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
        backgroundSize: "10px",
      }}
    >
      {years.map((y) => (
        <option key={y} value={y} style={{ background: "var(--surface)", color: "var(--text)" }}>
          {y}
        </option>
      ))}
    </select>
  );
}
