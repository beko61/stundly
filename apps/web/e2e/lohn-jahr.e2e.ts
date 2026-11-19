import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { loadE2eEnv } from "./env";

/**
 * Lohn-Einstellungen gelten je Jahr (Nutzerwunsch 19.11.2026): Sollstunden in 2027 ändern
 * darf 2026 nicht verändern.
 */
const env = loadE2eEnv();
const admin = createClient(env.url, env.service, { auth: { persistSession: false } });

const email = `e2e-lohnjahr-${Date.now()}@example.com`;
const password = randomBytes(12).toString("base64url") + "A1!";
let userId = "";
const thisYear = new Date().getFullYear();
const next = thisYear + 1;

test.beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: "E2E Lohnjahr" },
  });
  if (error) throw error;
  userId = data.user.id;
  const { error: e2 } = await admin.from("salary_settings")
    .insert({ user_id: userId, valid_from: `${thisYear}-06-10`, monthly_target_hours: 174, hourly_rate: 20 });
  if (e2) throw e2;
});

test.afterAll(async () => {
  if (userId) {
    await admin.from("salary_settings").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
});

test("Sollstunden 2027 ändern lässt 2026 unverändert", async ({ page }) => {
  await page.goto("/login");
  const nur = page.getByRole("button", { name: "Nur notwendige" });
  if (await nur.isVisible()) await nur.click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));

  await page.goto("/salary");
  const soll = page.locator('label:has-text("Sollstunden/Monat") + input');
  await expect(soll).toHaveValue("174", { timeout: 30_000 });

  await page.getByLabel("Jahr auswählen").selectOption(String(next));
  await expect(soll).toHaveValue("174");          // nächstes Jahr übernimmt den letzten Stand
  await soll.fill("160");

  // gespeichert als eigene Zeile ab 01.01. des nächsten Jahres
  await expect.poll(async () => {
    const { data } = await admin.from("salary_settings").select("valid_from, monthly_target_hours").eq("user_id", userId);
    return (data ?? []).map((r) => `${r.valid_from}:${Number(r.monthly_target_hours)}`).sort();
  }, { timeout: 15_000 }).toEqual([`${thisYear}-06-10:174`, `${next}-01-01:160`]);

  await page.getByLabel("Jahr auswählen").selectOption(String(thisYear));
  await expect(soll).toHaveValue("174");
  await page.getByLabel("Jahr auswählen").selectOption(String(next));
  await expect(soll).toHaveValue("160");

  // nach Neuladen bleibt es so
  await page.reload();
  await expect(soll).toHaveValue("174", { timeout: 30_000 });
});
