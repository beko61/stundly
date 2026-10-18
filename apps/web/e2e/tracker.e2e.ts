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

  // window.open mitschneiden statt öffnen
  const captureOpen = () => page.evaluate(() => {
    const w = window as unknown as { __opened: string[] };
    w.__opened = [];
    window.open = ((u: string) => { w.__opened.push(u); return null; }) as typeof window.open;
  });
  const opened = () => page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
  await captureOpen();

  // 📍 in der Liste startet KEINE Navigation (versehentliches Tippen) — öffnet den Notdienst
  await row.getByText("Musterstraße 1, 30159 Hannover").click();
  await expect(modal).toBeVisible();
  expect(await opened()).toEqual([]);

  // 📍-Knopf im Notdienst-Fenster startet die Navigation (Standard Google Maps)
  await modal.getByRole("button", { name: "In Google Maps öffnen" }).click();
  expect(await opened()).toEqual(["https://www.google.com/maps/search/?api=1&query=Musterstra%C3%9Fe%201%2C%2030159%20Hannover"]);
  await modal.getByRole("button", { name: "Schließen" }).first().click();

  // Notdienst-Karte oben: standardmäßig offen, zu- und wieder aufklappen
  const card = page.getByRole("button", { name: /🚨 Notdienst/ });
  await expect(page.getByText("Nd-Std")).toBeVisible();
  await card.click();
  await expect(page.getByText("Nd-Std")).toBeHidden();
  await card.click();
  await expect(page.getByText("Nd-Std")).toBeVisible();

  // Profil → Navigation → Waze; danach startet der 📍-Knopf Waze
  await page.goto("/settings");
  await page.getByRole("radio", { name: /Waze/ }).check();
  await expect(page.getByRole("status").filter({ hasText: "Gespeichert" })).toBeVisible();
  await page.goto("/tracker");
  await captureOpen();
  await page.locator(".day-entry").nth(new Date().getDate() - 1).getByText("Frau Muster, 2. OG").click();
  await page.locator('[aria-labelledby="notdienst-modal-title"]').getByRole("button", { name: "In Waze öffnen" }).click();
  expect((await opened())[0]).toMatch(/^https:\/\/waze\.com\/ul\?q=Musterstra/);

  expect(consoleErrors).toEqual([]);
});
