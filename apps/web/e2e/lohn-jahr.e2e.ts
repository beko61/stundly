import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { loadE2eEnv } from "./env";
import { formatDur } from "../src/lib/utils/formatDur";

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

test("Urlaub: Jahr wählbar, Anspruch je Jahr (2027 → 30 Tage)", async ({ page }) => {
  await admin.from("salary_settings").delete().eq("user_id", userId);
  await admin.from("salary_settings").insert([
    { user_id: userId, valid_from: `${thisYear}-06-10`, monthly_target_hours: 174, hourly_rate: 20, urlaub_anspruch: 25 },
    { user_id: userId, valid_from: `${next}-01-01`, monthly_target_hours: 160, hourly_rate: 20, urlaub_anspruch: 30 },
  ]);
  await page.goto("/login");
  const nur = page.getByRole("button", { name: "Nur notwendige" });
  if (await nur.isVisible()) await nur.click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));

  await page.goto("/vacation");
  await expect(page.getByText("25 Tage Jahresanspruch")).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Jahr auswählen").selectOption(String(next));
  await expect(page.getByText("30 Tage Jahresanspruch")).toBeVisible();
});

test("Überstunden: Saldo des Jahres wird automatisch ins nächste Jahr übertragen", async ({ page }) => {
  await admin.from("salary_settings").delete().eq("user_id", userId);
  await admin.from("salary_settings").insert({ user_id: userId, valid_from: `${thisYear}-01-01`, monthly_target_hours: 174, hourly_rate: 20 });
  await admin.from("time_entries").insert(["05", "06", "07"].map((d) => ({
    user_id: userId, date: `${thisYear}-01-${d}`, day_type: "arbeiten", start_time: "07:00", end_time: "17:00", break_minutes: 0,
  })));

  await page.goto("/login");
  const nur = page.getByRole("button", { name: "Nur notwendige" });
  if (await nur.isVisible()) await nur.click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));

  await page.goto("/reports");
  await page.getByRole("tab", { name: /Jahr/ }).click();
  const card = page.locator(".card", { hasText: "Gesamt Überstunden" });
  await expect(card).toBeVisible({ timeout: 30_000 });
  const saldo = (await card.locator("div").nth(1).textContent())!.trim();
  expect(saldo).not.toBe("");

  await page.getByLabel("Jahr auswählen").selectOption(String(next));
  await expect(card).toContainText(`inkl. Übertrag aus ${thisYear}: ${saldo}`);

  await admin.from("time_entries").delete().eq("user_id", userId);
});

test("Überstunden-Übertrag im Gehalt korrigieren (Migration 044) und zurück auf automatisch", async ({ page }) => {
  await admin.from("salary_settings").delete().eq("user_id", userId);
  await admin.from("salary_settings").insert({ user_id: userId, valid_from: `${thisYear}-01-01`, monthly_target_hours: 174, hourly_rate: 20 });

  await page.goto("/login");
  const nur = page.getByRole("button", { name: "Nur notwendige" });
  if (await nur.isVisible()) await nur.click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));

  await page.goto("/salary");
  await page.getByLabel("Jahr auswählen").selectOption(String(next));
  const carry = page.getByLabel(`Überstunden aus ${thisYear} (Std.)`);
  await expect(carry).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(`automatisch aus ${thisYear}`)).toBeVisible();
  await carry.fill("12.5");

  await expect.poll(async () => {
    const { data } = await admin.from("salary_settings").select("valid_from, ueberstunden_uebertrag").eq("user_id", userId).eq("valid_from", `${next}-01-01`);
    return data?.[0] ? Number(data[0].ueberstunden_uebertrag) : null;
  }, { timeout: 15_000 }).toBe(12.5);

  await page.goto("/reports");
  await page.getByRole("tab", { name: /Jahr/ }).click();
  await page.getByLabel("Jahr auswählen").selectOption(String(next));
  await expect(page.locator(".card", { hasText: "Gesamt Überstunden" }))
    .toContainText(`inkl. Übertrag aus ${thisYear}: ${formatDur(750, true)}`, { timeout: 30_000 });

  // zurück auf automatisch
  await page.goto("/salary");
  await page.getByLabel("Jahr auswählen").selectOption(String(next));
  await page.getByRole("button", { name: /automatisch/ }).click();
  await expect.poll(async () => {
    const { data } = await admin.from("salary_settings").select("ueberstunden_uebertrag").eq("user_id", userId).eq("valid_from", `${next}-01-01`);
    return data?.[0]?.ueberstunden_uebertrag ?? "null";
  }, { timeout: 15_000 }).toBe("null");
});

test("Überstunden-Übertrag-Feld auch ohne gespeicherte Lohn-Einstellungen sichtbar", async ({ page }) => {
  await admin.from("salary_settings").delete().eq("user_id", userId);
  await page.goto("/login");
  const nur = page.getByRole("button", { name: "Nur notwendige" });
  if (await nur.isVisible()) await nur.click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));

  await page.goto("/salary");
  await page.getByLabel("Jahr auswählen").selectOption(String(next));
  await expect(page.getByLabel(`Überstunden aus ${thisYear} (Std.)`)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(`automatisch aus ${thisYear}`)).toBeVisible();
});
