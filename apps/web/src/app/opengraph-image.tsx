/**
 * Dynamic Open Graph Image — Next.js generates this at build time.
 * Used as the preview image when stundly.de is shared on Twitter/LinkedIn/WhatsApp etc.
 * Output: 1200×630 PNG.
 */

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Stundly – Arbeitszeiterfassung für Deutschland";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #0f0f13 0%, #1a1a2e 50%, #16213e 100%)",
          color: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "60px 80px",
          position: "relative",
        }}
      >
        {/* Decorative gradient blob top-right */}
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -200,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(124,106,247,0.35) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        {/* Decorative gradient blob bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: -200,
            left: -200,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(192,132,252,0.25) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Top: 🇩🇪 Made-in badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 22px",
            background: "rgba(192,132,252,0.15)",
            border: "1px solid rgba(192,132,252,0.4)",
            borderRadius: 100,
            fontSize: 22,
            color: "#c084fc",
            fontWeight: 700,
            letterSpacing: 1,
            marginBottom: 40,
          }}
        >
          🇩🇪 Made for Deutschland
        </div>

        {/* Main title */}
        <div
          style={{
            fontSize: 110,
            fontWeight: 900,
            letterSpacing: 6,
            color: "#c084fc",
            marginBottom: 24,
            display: "flex",
          }}
        >
          STUNDLY
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 38,
            fontWeight: 700,
            color: "white",
            marginBottom: 16,
            textAlign: "center",
            lineHeight: 1.2,
            display: "flex",
          }}
        >
          Arbeitszeit, Lohn & Notdienst
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 500,
            color: "rgba(255,255,255,0.7)",
            marginBottom: 60,
            textAlign: "center",
            display: "flex",
          }}
        >
          — alles in einer App.
        </div>

        {/* Bottom: trust strip */}
        <div
          style={{
            display: "flex",
            gap: 40,
            fontSize: 22,
            color: "rgba(255,255,255,0.85)",
            fontWeight: 600,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            🔒 DSGVO
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            ⚖️ ArbZG
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            💶 §19 UStG
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            📱 PWA
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
