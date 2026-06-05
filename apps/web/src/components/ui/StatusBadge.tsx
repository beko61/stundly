import type { DayType } from "@workly/shared";
import { DAY_TYPE_LABELS } from "@workly/shared";

interface StatusBadgeProps {
  type: DayType;
  size?: "sm" | "md";
}

export function StatusBadge({ type, size = "md" }: StatusBadgeProps) {
  return (
    <span
      className={`badge badge-${type}`}
      style={size === "sm" ? { fontSize: 10, padding: "2px 7px" } : undefined}
    >
      {DAY_TYPE_LABELS[type]}
    </span>
  );
}
