import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/config.ts");

// Content-Security-Policy: nur eigene Skripte + Supabase + Vercel-Statistik; keine fremden Frames/Formulare.
// 'unsafe-inline' (Next.js Inline-Skripte, JSON-LD, Theme-Skript) und 'unsafe-eval' (PDF/Excel-Bibliotheken)
// bleiben erlaubt — später mit Nonces verschärfen. blob: für PDF-Vorschau (iframe) und Downloads.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://va.vercel-scripts.com https://vitals.vercel-insights.com",
  "frame-src 'self' blob:",
  "object-src 'self' blob:",
  "media-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // E2E-Tests (Playwright) bauen in einen eigenen Ordner, damit ein laufender Dev-Server nicht gestört wird
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // NOT: @react-pdf/renderer optimizePackageImports kaldırıldı — React 19'da
  // ReactCurrentDispatcher yok, package React 18 için. Ayrıca proje jspdf
  // kullanıyor, @react-pdf/renderer runtime'da import edilmiyor.
  transpilePackages: ["@workly/shared"],
  serverExternalPackages: ["@supabase/ssr"],

  // ESLint config is incomplete (typescript-eslint plugin not installed).
  // Don't fail production builds on lint — Vercel will skip the lint step.
  // Local typecheck still runs and catches real type errors.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Vercel EU region için
  // vercel.json'da "regions": ["fra1"] ile Frankfurt seçilir

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // DSGVO — HSTS (HTTPS zorunlu)
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
      // Stripe webhook için raw body
      {
        source: "/api/stripe/webhook",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
