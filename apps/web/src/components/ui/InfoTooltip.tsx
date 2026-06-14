"use client";

import { useState, useRef, useEffect } from "react";

interface InfoTooltipProps {
  /** Kısa başlık (opsiyonel) */
  title?: string;
  /** Açıklama metni (line break için \n veya ReactNode) */
  children: React.ReactNode;
  /** Tooltip rengi (default accent2 mor) */
  color?: string;
  /** Icon (default ℹ️) */
  icon?: string;
}

/**
 * Hover/tıklama ile açılan info kutusu.
 * Masaüstünde hover, mobilde tap (touch).
 */
export function InfoTooltip({ title, children, color = "var(--accent2)", icon = "ℹ️" }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  // Dış tıklama → kapat (mobil için)
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <span ref={wrapRef} style={{ position: "relative", display: "inline-flex", verticalAlign: "middle" }}>
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        aria-label={title ?? "Mehr Infos"}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          fontSize: 13,
          lineHeight: 1,
          cursor: "pointer",
          opacity: 0.7,
          transition: "opacity 0.15s",
          display: "inline-flex",
          alignItems: "center",
          marginLeft: 4,
        }}
      >
        {icon}
      </button>

      {open && (
        <div
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 200,
            minWidth: 200,
            maxWidth: 280,
            background: "var(--surface)",
            border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
            borderRadius: 10,
            padding: "9px 11px",
            boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
            fontFamily: "'Syne', sans-serif",
            color: "var(--text)",
          }}
        >
          {title && (
            <div style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color,
              marginBottom: 6,
            }}>
              {title}
            </div>
          )}
          <div style={{ fontSize: 10.5, lineHeight: 1.45, color: "var(--muted)", whiteSpace: "pre-line" }}>
            {children}
          </div>
        </div>
      )}
    </span>
  );
}
