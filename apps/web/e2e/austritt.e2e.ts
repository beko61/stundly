import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { loadE2eEnv } from "./env";

/**
 * Migration 042: Austritt aus der Firma — Firma sieht danach nur noch Daten aus der Zeit der Zugehörigkeit,
 * eine neue Firma nichts aus der Zeit davor. Firma entfernt (UI) · Mitarbeiter tritt selbst aus (UI).
 */
const env = loadE2eEnv();
const admin = createClient(env.url, env.service, { auth: { persistSession: false } });

const stamp = Date.now();
const pw = () => randomBytes(12).toString("base64url") + "A1!";
const boss  = { email: `e2e-aus-boss-${stamp}@example.com`,  password: pw(), id: "" };
const emp   = { email: `e2e-aus-emp-${stamp}@example.com`,   password: pw(), id: "" };
const self  = { email: `e2e-aus-self-${stamp}@example.com`,  password: pw(), id: "" };
const alt   = { email: `e2e-aus-alt-${stamp}@example.com`,   password: pw(), id: "" };
const users = [boss, emp, self, alt];
let companyId = "";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = new Date();
// Datum im aktuellen Monat, das nicht heute ist (Eintrag "während der Zugehörigkeit")
const during = iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() === 1 ? 2 : 1));
const OLD = "2025-03-03";            // Vorgeschichte von "alt" vor dem Beitritt
const LATER = "2099-01-05";          // nach dem Austritt

async function entry(userId: string, date: string) {
  const { error } = await admin.from("time_entries")
    .insert({ user_id: userId, date, start_time: "07:00", end_time: "15:00", break_minutes: 30, day_type: "arbeiten" });
  if (error) throw error;
}
const membership = async (uid: string) =>
  (await admin.from("company_memberships").select("visible_from, left_at, left_reason, left_by").eq("user_id", uid).eq("company_id", companyId)).data ?? [];

test.beforeAll(async () => {
  for (const u of users) {
    const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true });
    if (error) throw error;
    u.id = data.user.id;
  }
  const { data: co, error } = await admin.from("companies").insert({ name: "E2E Austritt GmbH", slug: `e2e-aus-${stamp}` }).select("id").single();
  if (error) throw error;
  companyId = co.id as string;

  // "alt" hat schon eigene Daten, bevor er beitritt
  await entry(alt.id, OLD);

  await admin.from("profiles").update({ company_id: companyId, role: "company_admin", full_name: "Chef E2E" }).eq("user_id", boss.id);
  await admin.from("profiles").update({ company_id: companyId, role: "employee", full_name: "Emil Entfernt" }).eq("user_id", emp.id);
  await admin.from("profiles").update({ company_id: companyId, role: "employee", full_name: "Selma Selbst" }).eq("user_id", self.id);
  await admin.from("profiles").update({ company_id: companyId, role: "employee", full_name: "Anton Alt" }).eq("user_id", alt.id);

  await entry(emp.id, during);
});

test.afterAll(async () => {
  for (const u of users) if (u.id) await admin.from("time_entries").delete().eq("user_id", u.id);
  for (const u of users) if (u.id) await admin.auth.admin.deleteUser(u.id);
  if (companyId) await admin.from("companies").delete().eq("id", companyId);
});

async function loginAs(page: Page, u: { email: string; password: string }) {
  await page.goto("/login");
  const nur = page.getByRole("button", { name: "Nur notwendige" });
  if (await nur.isVisible()) await nur.click();
  await page.locator('input[type="email"]').fill(u.email);
  await page.locator('input[type="password"]').fill(u.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}
async function bossClient() {
  const c = createClient(env.url, env.anon, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email: boss.email, password: boss.password });
  return c;
}

test("Beitritt: Trigger legt Mitgliedschaft an — mit Vorgeschichte erst ab Beitritt sichtbar", async () => {
  expect(await membership(emp.id)).toEqual([expect.objectContaining({ visible_from: null, left_at: null })]);
  const [m] = await membership(alt.id);
  expect(m!.visible_from).not.toBeNull();

  const c = await bossClient();
  const { data } = await c.from("time_entries").select("date").eq("user_id", alt.id);
  expect(data ?? []).toEqual([]);   // Eintrag von 2025 bleibt der neuen Firma verborgen
});

test("Firma entfernt Mitarbeiter → Konto bleibt, Firma sieht nur die Zeit im Team", async ({ page }) => {
  await loginAs(page, boss);
  await page.goto("/company/employees");
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Entfernen" }).first().click();
  await expect(page.getByRole("button", { name: /Ehemalige Mitarbeiter \(1\)/ })).toBeVisible();

  const { data: prof } = await admin.from("profiles").select("company_id, role").eq("user_id", emp.id).single();
  expect(prof).toEqual({ company_id: null, role: "individual" });
  expect(await membership(emp.id)).toEqual([
    expect.objectContaining({ left_at: expect.any(String), left_reason: "removed", left_by: boss.id }),
  ]);

  // Nach dem Austritt eingetragen → für die Firma unsichtbar; während der Zeit → sichtbar
  await entry(emp.id, LATER);
  const c = await bossClient();
  const { data } = await c.from("time_entries").select("date").eq("user_id", emp.id);
  expect((data ?? []).map((r) => r.date)).toEqual([during]);

  // Detailseite: nur Ansicht
  await page.getByRole("button", { name: /Ehemalige Mitarbeiter/ }).click();
  await page.getByRole("link", { name: /Emil Entfernt/ }).click();
  await page.waitForURL(new RegExp(`/company/employees/${emp.id}`));
  await expect(page.getByText(/Ausgeschieden am/)).toBeVisible({ timeout: 30_000 });
});

test("Mitarbeiter verlässt die Firma selbst (Einstellungen)", async ({ page }) => {
  await loginAs(page, self);
  await page.goto("/settings");
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: /Firma verlassen/ }).click();
  await page.waitForURL(/\/dashboard/);

  const { data: prof } = await admin.from("profiles").select("company_id, role").eq("user_id", self.id).single();
  expect(prof).toEqual({ company_id: null, role: "individual" });
  expect(await membership(self.id)).toEqual([expect.objectContaining({ left_reason: "left", left_by: self.id })]);
});
