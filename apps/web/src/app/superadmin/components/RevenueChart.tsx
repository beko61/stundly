/**
 * MRR trend bar chart — pure inline SVG, server-render friendly.
 * Chart lib yok, minimal dependency (superadmin sadece)
 */

import type { MrrPoint } from "@/lib/utils/mrrTrend";

interface Props {
  data: MrrPoint[];
}

export function RevenueChart({ data }: Props) {
  const maxMrr = Math.max(...data.map(d => d.mrr), 1);
  // Trend (son ay vs önceki ay) — YoY olmadığı için MoM %
  const last  = data[data.length - 1]?.mrr ?? 0;
  const prev  = data[data.length - 2]?.mrr ?? 0;
  const momPct = prev > 0 ? Math.round(((last - prev) / prev) * 100) : (last > 0 ? 100 : 0);
  const momPos = momPct >= 0;

  // ARR (annual run rate) = son ay × 12
  const arr = last * 12;

  // Chart dimensions
  const barCount = data.length;
  const barWidth = 100 / barCount;
  const barGap   = 2;   // %

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            📈 MRR Trend — letzte {data.length} Monate
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 6 }}>
            <span style={{ fontSize: 26, fontWeight: 800, fontFamily: "'DM Mono',monospace", color: "var(--green)" }}>
              €{last.toFixed(2)}
            </span>
            <span style={{ fontSize: 12, color: momPos ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
              {momPos ? "▲" : "▼"} {momPos ? "+" : ""}{momPct}% MoM
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            ARR (Run Rate): <strong style={{ color: "var(--accent2)" }}>€{arr.toFixed(0)}</strong>
          </div>
        </div>
      </div>

      {/* Bar chart — SVG-based */}
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        style={{ width: "100%", height: 120, display: "block" }}
        role="img"
        aria-label={`MRR trend last ${data.length} months`}
      >
        {data.map((d, i) => {
          const h = (d.mrr / maxMrr) * 40;
          const x = i * barWidth + barGap / 2;
          const w = barWidth - barGap;
          const y = 40 - h;
          const isLast = i === data.length - 1;
          return (
            <g key={d.month}>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={isLast ? "var(--green)" : "color-mix(in srgb, var(--accent2) 60%, transparent)"}
                rx="0.3"
              >
                <title>{`${d.label}: €${d.mrr.toFixed(2)}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>

      {/* Labels — ay isimleri */}
      <div style={{ display: "flex", marginTop: 6 }}>
        {data.map(d => (
          <div key={d.month} style={{ flex: 1, textAlign: "center", fontSize: 9, color: "var(--muted)", fontFamily: "'DM Mono',monospace" }}>
            {d.label}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, fontSize: 10, color: "var(--muted)", lineHeight: 1.5 }}>
        ℹ️ Basitleştirilmiş hesap: her ayın son günü itibariyle aktif abonelikler ×
        plan ücreti. Trial dahil değil. Pro-rated upgrade/coupon uygulanmamış.
      </div>
    </div>
  );
}
