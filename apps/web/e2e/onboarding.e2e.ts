import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { loadE2eEnv } from "./env";

/**
 * Faz 3.1 gegen das Test-Projekt: Einrichtung fragt die üblichen Arbeitszeiten ab →
 * Standardzeiten (Gerät) + Soll/Monat (salary_settings) passen zusammen, Stundenlohn noch 0.
 */
const env = loadE2eEnv();
const admin = createClient(env.url, env.service, { auth: { persistSession: false } });

const email = `e2e-onb-${Date.now()}@example.com`;
const password = randomBytes(12).toString("base64url") + "A1!";
let userId = "";

test.beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: "E2E Test" },
  });
  if (error) throw error;
  userId = data.user.id;
});

test.afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});

test("Einrichtung: Arbeitszeiten → Standardzeiten + Soll gespeichert, Stundenlohn 0", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));

  await page.goto("/onboarding/setup?type=individual");
  await page.locator("select").selectOption("NI");
  // Standard Mo–Do 07:45–17:00 (60) bleibt; Fr bis 15:30 statt 14:30 → 4 × 8h15 + 7h15 = 40h15
  await page.getByLabel("Fr Ende").fill("15:30");
  await expect(page.getByText("40h 15m")).toBeVisible();

  await page.getByRole("button", { name: "Weiter" }).click();
  await page.waitForURL(/\/onboarding\/done/);

  const stored = await page.evaluate(() => localStorage.getItem("workly_standard_times_v1"));
  expect(JSON.parse(stored ?? "{}")).toMatchObject({ friEnd: "15:30", monThuEnd: "17:00" });

  const { data } = await admin.from("salary_settings")
    .select("monthly_target_hours, hourly_rate").eq("user_id", userId);
  expect(data).toHaveLength(1);
  expect(Number(data![0]!.monthly_target_hours)).toBe(174.42); // 40,25 × 52 / 12
  expect(Number(data![0]!.hourly_rate)).toBe(0);
});
