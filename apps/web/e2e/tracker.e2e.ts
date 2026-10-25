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
  // Cookie-Banner bewusst NICHT schließen: bei offenem Fenster darf er "Speichern" nicht verdecken
  await page.goto("/login");
  const banner = page.getByRole("dialog", { name: "Cookie-Einwilligung" });
  await expect(banner).toBeVisible();
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
  await expect(banner).toBeHidden(); // Fenster offen → Banner weg
  const times = modal.locator('input[type="time"]');
  await times.nth(0).fill("07:00");
  await times.nth(1).fill("15:30");
  await modal.getByRole("button", { name: "Speichern" }).click();
  await expect(modal).toBeHidden();
  await expect(row).toContainText("07:00");
  await expect(banner).toBeVisible(); // nach dem Schließen wieder da — Einwilligung steht noch aus

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
  await page.locator('[aria-labelledby="notdienst-modal-title"]').getByRole("button", { name: "Schließen" }).first().click();

  // 📋 neben 📍 kopiert die Adresse (z. B. für Blitzer.de) — ohne Einstellung, öffnet nichts
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await captureOpen();
  await page.locator(".day-entry").nth(new Date().getDate() - 1).getByText("Frau Muster, 2. OG").click();
  const ndModal = page.locator('[aria-labelledby="notdienst-modal-title"]');
  await ndModal.getByRole("button", { name: "Adresse kopieren" }).click();
  await expect(ndModal.getByText("Adresse kopiert")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("Musterstraße 1, 30159 Hannover");
  expect(await opened()).toEqual([]);

  expect(consoleErrors).toEqual([]);
});

test("Notdienste in Eingabe-Reihenfolge; Installieren-Symbol klein, verdeckt keine Fenster", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Nur notwendige" }).click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.goto("/tracker");

  // Installieren: kleines Symbol (Android-Emulation, nicht installiert), Tippen öffnet die Karte
  const fab = page.getByRole("button", { name: "Stundly auf dem Home-Bildschirm installieren" });
  await expect(fab).toBeVisible({ timeout: 10_000 });
  const box = await fab.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(48);
  await fab.click();
  const card = page.getByRole("dialog", { name: "Stundly App installieren" });
  await expect(card.getByRole("button", { name: "Installieren" })).toBeVisible();
  await card.getByRole("button", { name: "Verkleinern" }).click();
  await expect(fab).toBeVisible();

  const day = new Date().getDate() - 1;
  const row = page.locator(".day-entry").nth(day);
  const modal = page.locator('[aria-labelledby="notdienst-modal-title"]');
  for (const [kunde, start, end] of [["Ahmet", "20:00", "21:00"], ["Mehmet", "08:00", "09:00"]] as const) {
    await row.getByRole("button", { name: /Notdienst hinzufügen/ }).click();
    await expect(modal).toBeVisible({ timeout: 30_000 });
    await expect(fab).toBeHidden(); // Fenster offen → Symbol weg
    await modal.getByPlaceholder(/Frau Ermakov/).fill(kunde);
    await modal.getByLabel("Start").fill(start);
    await modal.getByLabel("Ende").fill(end);
    await modal.getByRole("button", { name: /Speichern/ }).click();
    await expect(modal.getByRole("button", { name: /Aktualisieren/ })).toBeVisible();
    await modal.getByRole("button", { name: "Schließen" }).first().click();
  }

  // Ahmet zuerst eingetragen → bleibt vor Mehmet, obwohl Mehmet früher beginnt (auch nach Neuladen)
  for (let i = 0; i < 2; i++) {
    const text = await row.innerText();
    expect(text.indexOf("Ahmet")).toBeGreaterThan(-1);
    expect(text.indexOf("Ahmet")).toBeLessThan(text.indexOf("Mehmet"));
    await page.reload();
    await expect(row).toContainText("Mehmet");
  }
});

test("Nach-oben-Button rechts ohne Überlappung; Urlaubsantrag: PDF geht ans Teilen-Menü", async ({ page }) => {
  // Teilen-Menü mitschneiden (headless Chromium hat keins)
  await page.addInitScript(() => {
    const w = window as unknown as { __shared: unknown };
    w.__shared = null;
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (d: ShareData) => {
        const files = d.files ?? [];
        w.__shared = { names: files.map((f) => f.name), types: files.map((f) => f.type), sizes: files.map((f) => f.size), title: d.title, text: d.text };
      },
    });
  });
  page.on("dialog", (d) => void d.accept());

  await page.goto("/login");
  await page.getByRole("button", { name: "Nur notwendige" }).click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));

  // Nach oben: rechts, überlappt weder Support- noch Kamera-Button
  await page.goto("/tracker");
  await page.mouse.wheel(0, 1500);
  const up = page.getByRole("button", { name: "Nach oben scrollen" });
  await expect(up).toBeVisible();
  const vw = page.viewportSize()!.width;
  const b = (await up.boundingBox())!;
  expect(b.x).toBeGreaterThan(vw / 2);
  for (const sel of [".support-fab", ".floating-scan"]) {
    const o = await page.locator(sel).first().boundingBox();
    if (!o) continue;
    const overlap = b.x < o.x + o.width && o.x < b.x + b.width && b.y < o.y + o.height && o.y < b.y + b.height;
    expect(overlap, `Nach-oben überlappt ${sel}`).toBe(false);
  }

  // Urlaubsantrag in 3 Wochen (Mo–Di) → Fenster → "Per Mail senden" gibt das PDF ans Teilen-Menü
  const d = new Date();
  d.setDate(d.getDate() + 21 + ((8 - d.getDay()) % 7));
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const end = new Date(d); end.setDate(d.getDate() + 1);
  await page.goto("/vacation");
  await page.getByRole("button", { name: /Neuer Antrag/ }).first().click();
  const dates = page.locator('input[type="date"]');
  await dates.nth(0).fill(iso(d));
  await dates.nth(1).fill(iso(end));
  await page.locator('form input[type="email"]').fill("chef@example.com");
  await page.getByRole("button", { name: /Speichern \+ PDF & Mail senden/ }).click();

  const sheet = page.getByRole("dialog", { name: /Urlaubsantrag ist fertig/ });
  await expect(sheet).toBeVisible({ timeout: 30_000 });
  await expect(sheet).toContainText("chef@example.com");
  await expect(page.locator(".support-fab").first()).toBeHidden(); // schwebender Chat-Knopf nicht über dem Fenster
  await sheet.getByRole("button", { name: /Per Mail senden/ }).click();
  const shared = await page.evaluate(() => (window as unknown as { __shared: { names: string[]; types: string[]; sizes: number[]; title: string; text: string } }).__shared);
  expect(shared.names[0]).toMatch(/^Urlaubsantrag_.*\.pdf$/);
  expect(shared.types[0]).toBe("application/pdf");
  expect(shared.sizes[0]).toBeGreaterThan(1000);
  expect(shared.title).toMatch(/^Urlaubsantrag/);
  expect(shared.text.split("\n")[0]).toBe(shared.title); // iOS-Outlook: Betreff = erste Textzeile
});
