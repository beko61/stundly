import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { loadE2eEnv } from "./env";

/**
 * Passwort-Reset darf nur das Konto aus dem Link ändern.
 * Bug (09.11.2026): Admin-Reset-Link (Implicit-Flow, #access_token) im Browser des eingeloggten Super-Admins
 * geöffnet → PKCE-Client verwirft den Link, behält die bestehende Sitzung → Formular änderte das Passwort des
 * ADMINS statt des Zielkontos.
 */
const env = loadE2eEnv();
const admin = createClient(env.url, env.service, { auth: { persistSession: false } });
const anon = () => createClient(env.url, env.anon, { auth: { persistSession: false } });

const stamp = Date.now();
const pw = () => randomBytes(12).toString("base64url") + "A1!";
const a = { email: `e2e-rst-a-${stamp}@example.com`, password: pw(), id: "" }; // eingeloggter "Admin"
const b = { email: `e2e-rst-b-${stamp}@example.com`, password: pw(), id: "" }; // Ziel des Links

test.beforeAll(async () => {
  for (const u of [a, b]) {
    const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true });
    if (error) throw error;
    u.id = data.user.id;
  }
});
test.afterAll(async () => {
  for (const u of [a, b]) if (u.id) await admin.auth.admin.deleteUser(u.id);
});

async function canLogin(email: string, password: string) {
  const { error } = await anon().auth.signInWithPassword({ email, password });
  return !error;
}

async function loginAs(page: Page, u: { email: string; password: string }) {
  await page.goto("/login");
  const nur = page.getByRole("button", { name: "Nur notwendige" });
  if (await nur.isVisible()) await nur.click();
  await page.locator('input[type="email"]').fill(u.email);
  await page.locator('input[type="password"]').fill(u.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** Recovery-Link wie aus dem Admin-Panel (Implicit-Flow: Tokens im #Hash). */
async function implicitRecoveryUrl(email: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error) throw error;
  const { data: v, error: vErr } = await anon().auth.verifyOtp({ type: "recovery", token_hash: data.properties.hashed_token });
  if (vErr || !v.session) throw vErr ?? new Error("keine Sitzung");
  const s = v.session;
  return `/reset-password#access_token=${s.access_token}&refresh_token=${s.refresh_token}&expires_in=${s.expires_in}&expires_at=${s.expires_at}&token_type=bearer&type=recovery`;
}

test("Eingeloggt als A, Link für B geöffnet → nur B bekommt das neue Passwort", async ({ page }) => {
  await loginAs(page, a);
  await page.goto(await implicitRecoveryUrl(b.email));

  await expect(page.getByText(b.email)).toBeVisible(); // zeigt, für welches Konto
  const neu = pw();
  await page.locator('input[type="password"]').nth(0).fill(neu);
  await page.locator('input[type="password"]').nth(1).fill(neu);
  await page.getByRole("button", { name: "Passwort speichern" }).click();
  await expect(page.getByText("Passwort geändert")).toBeVisible();

  expect(await canLogin(b.email, neu)).toBe(true);
  expect(await canLogin(a.email, a.password)).toBe(true);   // A unverändert
});

test("Eingeloggt, /reset-password ohne Link → kein Formular (vorher: Passwort des eingeloggten Kontos änderbar)", async ({ page }) => {
  await loginAs(page, a);
  await page.goto("/reset-password");
  await expect(page.getByText("Link ungültig oder abgelaufen")).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});
