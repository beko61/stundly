import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/config.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["@react-pdf/renderer"],
  },
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
