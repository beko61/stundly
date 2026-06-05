import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        workly: {
          bg:       "#0f0f13",
          surface:  "#18181f",
          surface2: "#22222d",
          border:   "#2e2e3d",
          accent:   "#7c6af7",
          accent2:  "#c084fc",
          green:    "#34d399",
          red:      "#f87171",
          yellow:   "#fbbf24",
          blue:     "#60a5fa",
          orange:   "#fb923c",
          text:     "#e8e8f0",
          muted:    "#6b6b80",
        },
      },
      fontFamily: {
        sans:  ["Syne", "sans-serif"],
        mono:  ["DM Mono", "monospace"],
      },
      borderRadius: {
        workly: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
