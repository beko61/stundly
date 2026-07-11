/**
 * Skeleton loading primitive.
 *
 * Kullanım:
 *   <Skeleton width={200} height={16} />
 *   <Skeleton lines={3} />       // 3 satır text skeleton
 *   <Skeleton fullWidth height={40} />
 *
 * Shimmer CSS `globals.css`'te (.skeleton + @keyframes).
 * `prefers-reduced-motion` respekt eder.
 */
import type { CSSProperties } from "react";

interface Props {
  width?:      number | string;
  height?:     number | string;
  fullWidth?:  boolean;
  lines?:      number;
  radius?:     number | string;
  style?:      CSSProperties;
  "aria-label"?: string;
}

export function Skeleton({
  width, height = 16, fullWidth, lines, radius, style, "aria-label": ariaLabel,
}: Props) {
  if (lines && lines > 1) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={ariaLabel ?? "Wird geladen"}
        style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}
      >
        {Array.from({ length: lines }).map((_, i) => (
          <span
            key={i}
            className="skeleton"
            aria-hidden="true"
            style={{
              display:      "block",
              width:        i === lines - 1 ? "70%" : "100%",
              height,
              borderRadius: radius ?? 6,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <span
      className="skeleton"
      role="status"
      aria-live="polite"
      aria-label={ariaLabel ?? "Wird geladen"}
      style={{
        display:      "inline-block",
        width:        fullWidth ? "100%" : (width ?? 120),
        height,
        borderRadius: radius ?? 6,
        ...style,
      }}
    />
  );
}
