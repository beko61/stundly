import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { loadE2eEnv } from "./env";

/**
 * Kernablauf gegen das Test-Projekt: Konto anlegen (Admin-API) → Login → Tag eintragen →
 * nach Neuladen noch da. Das Konto wird am Ende wieder gelöscht.
 */
const env = loadE2eEnv();
const admin = createClient(env.url, env.service, { auth: { persistSession: false } });

const email = `e2e-${Date.now()}@example.com`;
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

test("Login → Zeiterfassung → Tag eintragen → bleibt nach Neuladen", async ({ page }) => {
  await page.goto("/login");
  // Cookie-Banner wie ein Nutzer schließen (datensparsame Wahl) — er überdeckt sonst unten den Speichern-Button
  await page.getByRole("button", { name: "Nur notwendige" }).click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));

  await page.goto("/tracker");
  const today = new Date().getDate();
  const row = page.locator(".day-entry").nth(today - 1);
  await expect(row).toContainText(String(today).padStart(2, "0"));
  await row.click();

  const modal = page.locator('[aria-labelledby="time-entry-modal-title"]');
  await expect(modal).toBeVisible();
  const times = modal.locator('input[type="time"]');
  await times.nth(0).fill("07:00");
  await times.nth(1).fill("15:30");
  await modal.getByRole("button", { name: "Speichern" }).click();
  await expect(modal).toBeHidden();
  await expect(row).toContainText("07:00");

  await page.reload();
  await expect(page.locator(".day-entry").nth(today - 1)).toContainText("15:30");
});

test("Notdienst mit Kunde und Adresse → beides steht in der Tagesliste", async ({ page }) => {
  // React-Warnungen (z.B. ungültig verschachteltes HTML) und Laufzeitfehler sollen nicht auftreten
  const consoleErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => consoleErrors.push(e.message.slice(0, 200)));
  await page.goto("/login");
  await page.getByRole("button", { name: "Nur notwendige" }).click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));

  await page.goto("/tracker");
  const row = page.locator(".day-entry").nth(new Date().getDate() - 1);
  await row.getByRole("button", { name: /Notdienst hinzufügen/ }).click();

  const modal = page.locator('[aria-labelledby="notdienst-modal-title"]');
  // Dev-Server kompiliert das Modal beim ersten Öffnen (lazy) — in der Produktion vorgebaut
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await modal.getByPlaceholder(/Frau Ermakov/).fill("Frau Muster, 2. OG");
  await modal.getByLabel("PLZ").fill("30159");
  await modal.getByLabel("Ort").fill("Hannover");
  await modal.getByLabel("Straße und Hausnummer").fill("Musterstraße 1");
  await modal.getByLabel("Start").fill("18:00");
  await modal.getByLabel("Ende").fill("19:00");
  await modal.getByRole("button", { name: /Speichern/ }).click();
  await expect(modal.getByRole("button", { name: /Aktualisieren/ })).toBeVisible();
  await modal.getByRole("button", { name: "Schließen" }).first().click();

  await expect(row).toContainText("Frau Muster, 2. OG");
  await expect(row).toContainText("Musterstraße 1, 30159 Hannover");

  // Notdienst-Karte oben: standardmäßig offen, zu- und wieder aufklappen
  const card = page.getByRole("button", { name: /🚨 Notdienst/ });
  await expect(page.getByText("Nd-Std")).toBeVisible();
  await card.click();
  await expect(page.getByText("Nd-Std")).toBeHidden();
  await card.click();
  await expect(page.getByText("Nd-Std")).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
