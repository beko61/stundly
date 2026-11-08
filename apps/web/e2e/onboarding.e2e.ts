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

  // 3.3: Auswahl spricht auch Angestellte an
  await page.goto("/onboarding/type");
  await expect(page.getByText(/Für Angestellte, Monteure und Selbstständige/)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("1-auswahl.png"), fullPage: true });

  await page.goto("/onboarding/setup?type=individual");
  await page.locator("select").selectOption("NI");
  // Standard Mo–Do 07:45–17:00 (60) bleibt; Fr bis 15:30 statt 14:30 → 4 × 8h15 + 7h15 = 40h15
  await page.getByLabel("Fr Ende").fill("15:30");
  await expect(page.getByText("40h 15m")).toBeVisible();
  // Handy: Pause-Feld bleibt in der Karte (ragte vorher rechts heraus)
  const card = (await page.locator(".card").first().boundingBox())!;
  const pause = (await page.getByLabel("Fr Pause in Minuten").boundingBox())!;
  expect(pause.x + pause.width).toBeLessThanOrEqual(card.x + card.width);
  await page.screenshot({ path: test.info().outputPath("2-einrichtung.png"), fullPage: true });

  await page.getByRole("button", { name: "Weiter" }).click();
  await page.waitForURL(/\/onboarding\/done/);

  const stored = await page.evaluate(() => localStorage.getItem("workly_standard_times_v1"));
  expect(JSON.parse(stored ?? "{}")).toMatchObject({ friEnd: "15:30", monThuEnd: "17:00" });

  const { data } = await admin.from("salary_settings")
    .select("monthly_target_hours, hourly_rate").eq("user_id", userId);
  expect(data).toHaveLength(1);
  expect(Number(data![0]!.monthly_target_hours)).toBe(174.42); // 40,25 × 52 / 12
  expect(Number(data![0]!.hourly_rate)).toBe(0);

  // 3.2: Standardzeiten auch im Profil (Migration 040) …
  const { data: prof } = await admin.from("profiles").select("standard_times").eq("user_id", userId).single();
  expect(prof?.standard_times).toMatchObject({ friEnd: "15:30", monThuEnd: "17:00" });

  // 3.5: Dashboard-Guide hakt Standardzeiten ab; Stundenlohn (0) noch offen
  await page.goto("/dashboard");
  await expect(page.getByText("🚀 In 3 Schritten startklar")).toBeVisible();
  await expect(page.getByText("Erledigt ✓")).toHaveCount(1);
  await expect(page.getByLabel("Schritt 2 erledigt")).toBeVisible();
  await expect(page.getByText("Lohn einstellen →")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("3-dashboard.png"), fullPage: true });

  // Gehalt-Seite: zeigt 0 €/h + Soll aus der Einrichtung und überschreibt sie nicht per Auto-Save
  // (früher: Standardwerte 15 €/h / 174 h geladen, bevor die User-ID da war, und gespeichert)
  await page.goto("/salary");
  await expect(page.locator('div:has(> label:has-text("Stundenlohn (€)")) > input')).toHaveValue("0");
  await expect(page.locator('div:has(> label:has-text("Sollstunden/Monat")) > input')).toHaveValue("174.42");
  await page.waitForTimeout(1500); // Auto-Save-Debounce 600 ms
  const { data: after } = await admin.from("salary_settings")
    .select("monthly_target_hours, hourly_rate").eq("user_id", userId)
    .order("created_at", { ascending: false }).limit(1).single();
  expect(Number(after!.hourly_rate)).toBe(0);
  expect(Number(after!.monthly_target_hours)).toBe(174.42);
});

test("Anderes Gerät (leerer Speicher): Standardzeiten kommen aus dem Profil", async ({ browser }) => {
  const ctx = await browser.newContext(); // eigener, leerer localStorage
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));

  await page.goto("/tracker");
  await expect.poll(async () => JSON.parse(
    (await page.evaluate(() => localStorage.getItem("workly_standard_times_v1"))) ?? "{}",
  ).friEnd).toBe("15:30");
  await ctx.close();
});
