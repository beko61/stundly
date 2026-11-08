import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { loadE2eEnv } from "./env";

/**
 * Einladungslink für ein bestehendes Konto: /join/<token> → "Anmelden" → Beitritt.
 * Vorher: /join war nicht öffentlich (abgemeldet → /login ohne Token) und angemeldet leitete /login?token
 * sofort aufs Dashboard → der Beitritt passierte nie.
 */
const env = loadE2eEnv();
const admin = createClient(env.url, env.service, { auth: { persistSession: false } });

const stamp = Date.now();
const password = randomBytes(12).toString("base64url") + "A1!";
const users: Record<"invited" | "other", { email: string; id: string }> = {
  invited: { email: `e2e-inv-${stamp}@example.com`, id: "" },
  other:   { email: `e2e-inv-other-${stamp}@example.com`, id: "" },
};
let companyId = "";

async function invite(email: string): Promise<string> {
  const { data, error } = await admin.from("invitations")
    .insert({ company_id: companyId, email, role: "employee" }).select("token").single();
  if (error) throw error;
  return data.token as string;
}

async function login(page: import("@playwright/test").Page, email: string) {
  // Cookie-Banner deckt am Handy den Button ab ("Anmelden & beitreten" steht tiefer)
  const nur = page.getByRole("button", { name: "Nur notwendige" });
  if (await nur.isVisible()) await nur.click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
}

test.beforeAll(async () => {
  for (const u of Object.values(users)) {
    const { data, error } = await admin.auth.admin.createUser({ email: u.email, password, email_confirm: true });
    if (error) throw error;
    u.id = data.user.id;
  }
  const { data: co, error } = await admin.from("companies")
    .insert({ name: "E2E Einladung", slug: `e2e-inv-${stamp}` }).select("id").single();
  if (error) throw error;
  companyId = co.id as string;
});

test.afterAll(async () => {
  for (const u of Object.values(users)) if (u.id) await admin.auth.admin.deleteUser(u.id);
  if (companyId) await admin.from("companies").delete().eq("id", companyId);
});

test("Abgemeldet: Link öffnen → Anmelden → Mitarbeiter der Firma", async ({ page }) => {
  const token = await invite(users.invited.email);
  await page.goto(`/join/${token}`);
  await expect(page.getByText("Einladung erhalten")).toBeVisible();
  await page.getByRole("link", { name: /Bereits registriert/ }).click();
  await expect(page).toHaveURL(/\/login\?token=/);
  await login(page, users.invited.email);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));

  const { data: prof } = await admin.from("profiles").select("company_id, role").eq("user_id", users.invited.id).single();
  expect(prof).toMatchObject({ company_id: companyId, role: "employee" });
  const { data: inv } = await admin.from("invitations").select("status").eq("token", token).single();
  expect(inv?.status).toBe("accepted");
});

test("Angemeldet mit anderem Konto: Grund wird angezeigt statt stiller Weiterleitung", async ({ page }) => {
  const token = await invite(`e2e-inv-someone-${stamp}@example.com`);
  await page.goto("/login");
  await login(page, users.other.email);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));

  // bereits angemeldet: Link → Anmelden bleibt auf /login (früher sofort Dashboard)
  await page.goto(`/join/${token}`);
  await page.getByRole("link", { name: /Bereits registriert/ }).click();
  await expect(page).toHaveURL(/\/login\?token=/);
  await login(page, users.other.email);
  await expect(page.getByText("Diese Einladung ist für eine andere E-Mail-Adresse.")).toBeVisible();

  const { data: prof } = await admin.from("profiles").select("company_id").eq("user_id", users.other.id).single();
  expect(prof?.company_id).toBeNull();
});
