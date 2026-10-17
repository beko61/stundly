import { defineConfig, devices } from "@playwright/test";
import { loadE2eEnv } from "./e2e/env";

/**
 * Uçtan uca testler — ayrı Supabase test projesine karşı (bkz. .env.test.example).
 * Çalıştırma: npm run test:e2e   (apps/web içinde)
 *
 * Next.js .env.local'ı (canlı DB) da okur; burada verilen değerler önceliklidir.
 * Mail, ödeme ve KI anahtarları boş verilir → testler gerçek mail/ödeme tetiklemez.
 */
const e2e = loadE2eEnv();
const PORT = 3200;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.e2e\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      NEXT_PUBLIC_SUPABASE_URL: e2e.url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: e2e.anon,
      SUPABASE_SERVICE_ROLE_KEY: e2e.service,
      NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
      RESEND_API_KEY: "",
      STRIPE_SECRET_KEY: "",
      STRIPE_WEBHOOK_SECRET: "",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "",
      ANTHROPIC_API_KEY: "",
      CRON_SECRET: "e2e-only",
    },
  },
});
