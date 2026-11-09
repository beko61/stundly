import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { loadE2eEnv } from "./env";

/**
 * Migration 039 gegen das Test-Projekt: Super-Admin ist ein eigenes Merkmal (is_super_admin).
 *  - Super-Admin, der als Mitarbeiter in einer Firma war und von ihr entfernt wurde
 *    (deleted_at + is_active=false): Login geht, eigene Zeiten + Admin-Panel offen, Firmen-Panel nicht.
 *  - Normales Konto kann sich is_super_admin nicht selbst geben (DB-Trigger).
 */
const env = loadE2eEnv();
const admin = createClient(env.url, env.service, { auth: { persistSession: false } });

const stamp = Date.now();
const sa = { email: `e2e-sa-${stamp}@example.com`, password: randomBytes(12).toString("base64url") + "A1!", id: "" };
const plain = { email: `e2e-plain-${stamp}@example.com`, password: randomBytes(12).toString("base64url") + "A1!", id: "" };
let companyId = "";

test.beforeAll(async () => {
  for (const u of [sa, plain]) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email, password: u.password, email_confirm: true, user_metadata: { full_name: "E2E Test" },
    });
    if (error) throw error;
    u.id = data.user.id;
  }
  const { data: co, error: coErr } = await admin.from("companies")
    .insert({ name: "E2E Firma", slug: `e2e-firma-${stamp}` }).select("id").single();
  if (coErr) throw coErr;
  companyId = co.id as string;

  // Mitarbeiter der Firma, danach von der Firma entfernt (wie /api/company/employees/delete)
  const { error } = await admin.from("profiles").update({
    is_super_admin: true, role: "employee", company_id: companyId,
    deleted_at: new Date().toISOString(), is_active: false,
  }).eq("user_id", sa.id);
  if (error) throw error;
});

test.afterAll(async () => {
  for (const u of [sa, plain]) if (u.id) await admin.auth.admin.deleteUser(u.id);
  if (companyId) await admin.from("companies").delete().eq("id", companyId);
});

test("Super-Admin nach Austritt: Login, eigene Zeiten und Admin-Panel offen — Firmen-Panel zu", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(sa.email);
  await page.locator('input[type="password"]').fill(sa.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));

  await page.goto("/tracker");
  await expect(page).toHaveURL(/\/tracker/);
  await expect(page.locator(".day-entry").first()).toBeVisible();

  await page.goto("/superadmin");
  await expect(page).toHaveURL(/\/superadmin/);
  await expect(page.locator(".sa-badge:visible").first()).toBeVisible(); // mobil: Topbar, Desktop: Seitenleiste

  await page.goto("/company/dashboard");
  await expect(page).not.toHaveURL(/\/company/);
});

test("Normales Konto kann sich is_super_admin nicht selbst setzen", async () => {
  const client = createClient(env.url, env.anon, { auth: { persistSession: false } });
  const { error: loginErr } = await client.auth.signInWithPassword({ email: plain.email, password: plain.password });
  if (loginErr) throw loginErr;

  const { error } = await client.from("profiles").update({ is_super_admin: true }).eq("user_id", plain.id);
  expect(error?.message ?? "").toContain("is_super_admin");

  const { data } = await admin.from("profiles").select("is_super_admin").eq("user_id", plain.id).single();
  expect(data?.is_super_admin).toBe(false);
});

test("Kokpit: geçici şifre atamak → hedef hesap onunla girer ve değiştirmek zorunda; admin şifresi aynı", async ({ page }) => {
  await page.goto("/login");
  const nur = page.getByRole("button", { name: "Nur notwendige" });
  if (await nur.isVisible()) await nur.click();
  await page.locator('input[type="email"]').fill(sa.email);
  await page.locator('input[type="password"]').fill(sa.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));

  await page.goto("/superadmin/users");
  await page.getByLabel("Ara").fill(plain.email);
  await page.locator(".sa-row", { hasText: plain.email }).click();
  await page.getByRole("button", { name: /Geçici şifre ata/ }).click();
  const temp = await page.locator("#sa-tmp-pw").inputValue();
  expect(temp.length).toBeGreaterThanOrEqual(8);
  await page.getByRole("button", { name: "Şifreyi ata" }).click();
  await expect(page.getByTestId("temp-password")).toHaveText(temp);

  const anon = () => createClient(env.url, env.anon, { auth: { persistSession: false } });
  expect((await anon().auth.signInWithPassword({ email: plain.email, password: temp })).error).toBeNull();
  expect((await anon().auth.signInWithPassword({ email: sa.email, password: sa.password })).error).toBeNull();
  const { data: prof } = await admin.from("profiles").select("must_change_password").eq("user_id", plain.id).single();
  expect(prof?.must_change_password).toBe(true);
  const { data: audit } = await admin.from("audit_log").select("action, payload").eq("resource_id", plain.id);
  expect(audit?.some(a => a.action === "superadmin.set_temp_password")).toBe(true);
  expect(JSON.stringify(audit)).not.toContain(temp);

  // Hedef hesap: geçici şifreyle giriş → önce yeni şifre
  const ctx = await page.context().browser()!.newContext();
  const p2 = await ctx.newPage();
  await p2.goto("/login");
  const nur2 = p2.getByRole("button", { name: "Nur notwendige" });
  if (await nur2.isVisible()) await nur2.click();
  await p2.locator('input[type="email"]').fill(plain.email);
  await p2.locator('input[type="password"]').fill(temp);
  await p2.locator('button[type="submit"]').click();
  await p2.waitForURL(/\/password-change/);
  await ctx.close();
  plain.password = temp;
});
