import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { loadE2eEnv } from "./env";

/**
 * Chef füllt das nächste Jahr eines Mitarbeiters mit dessen Standardzeiten (Firmen-Panel → Mitarbeiter).
 * Vorhandene Einträge bleiben, Tage sind als "autofill" markiert.
 */
const env = loadE2eEnv();
const admin = createClient(env.url, env.service, { auth: { persistSession: false } });

const stamp = Date.now();
const pw = () => randomBytes(12).toString("base64url") + "A1!";
const boss = { email: `e2e-jf-boss-${stamp}@example.com`, password: pw(), id: "" };
const emp  = { email: `e2e-jf-emp-${stamp}@example.com`,  password: pw(), id: "" };
let companyId = "";
const next = new Date().getFullYear() + 1;
const STD = { monThuStart: "06:30", monThuEnd: "15:00", monThuPause: 30, friStart: "06:30", friEnd: "12:00", friPause: 0 };
const KEEP = `${next}-01-04`; // Montag 2027 — schon eingetragen, darf nicht überschrieben werden

test.beforeAll(async () => {
  for (const u of [boss, emp]) {
    const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true });
    if (error) throw error;
    u.id = data.user.id;
  }
  const { data: co, error } = await admin.from("companies").insert({ name: "E2E Jahr GmbH", slug: `e2e-jf-${stamp}` }).select("id").single();
  if (error) throw error;
  companyId = co.id as string;
  await admin.from("profiles").update({ company_id: companyId, role: "company_admin", full_name: "Chef Jahr" }).eq("user_id", boss.id);
  await admin.from("profiles").update({ company_id: companyId, role: "employee", full_name: "Jana Jahr", bundesland: "NI", standard_times: STD }).eq("user_id", emp.id);
  await admin.from("time_entries").insert({ user_id: emp.id, date: KEEP, day_type: "arbeiten", start_time: "09:00", end_time: "10:00", break_minutes: 0 });
});

test.afterAll(async () => {
  for (const u of [boss, emp]) if (u.id) await admin.from("time_entries").delete().eq("user_id", u.id);
  for (const u of [boss, emp]) if (u.id) await admin.auth.admin.deleteUser(u.id);
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

test("Chef füllt das nächste Jahr mit den Standardzeiten des Mitarbeiters", async ({ page }) => {
  await loginAs(page, boss);
  await page.goto(`/company/employees/${emp.id}`);
  // Vorschlag = Standardzeiten des Mitarbeiters; Samstag dazu
  await expect(page.getByLabel("Mo Beginn")).toHaveValue("06:30");
  await page.getByLabel("Sa arbeitet").check();
  await page.getByLabel("Sa Beginn").fill("08:00");
  await page.getByLabel("Sa Ende").fill("12:00");
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: `${next} füllen` }).click();
  await expect(page.getByRole("status")).toContainText(`Tage neu eingetragen`, { timeout: 30_000 });

  const { data } = await admin.from("time_entries").select("date, start_time, end_time, tags")
    .eq("user_id", emp.id).gte("date", `${next}-01-01`).lte("date", `${next}-12-31`).order("date");
  const rows = data ?? [];
  expect(rows.length).toBeGreaterThan(280);
  expect(rows.find((r) => r.date === KEEP)).toMatchObject({ start_time: "09:00:00" });           // unverändert
  expect(rows.find((r) => r.date === `${next}-01-05`)).toMatchObject({ start_time: "06:30:00", end_time: "15:00:00", tags: ["autofill"] });
  expect(rows.some((r) => r.date === `${next}-01-01`)).toBe(false);                               // Neujahr
  const sat = rows.find((r) => new Date(`${r.date}T12:00:00`).getDay() === 6);
  expect(sat).toMatchObject({ start_time: "08:00:00", end_time: "12:00:00" });
  expect(rows.some((r) => new Date(`${r.date}T12:00:00`).getDay() === 0)).toBe(false);          // Sonntag

  // Nochmal mit anderer Zeit: automatisch gefüllte Tage werden aktualisiert, selbst eingetragene nicht
  await page.getByLabel("Mo Beginn").fill("07:15");
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: `${next} füllen` }).click();
  await expect(page.getByRole("status")).toContainText("automatisch gefüllte Tage aktualisiert", { timeout: 30_000 });
  const { data: after } = await admin.from("time_entries").select("date, start_time")
    .eq("user_id", emp.id).in("date", [KEEP, `${next}-01-11`]);
  expect(after?.find((r) => r.date === KEEP)).toMatchObject({ start_time: "09:00:00" });
  expect(after?.find((r) => r.date === `${next}-01-11`)).toMatchObject({ start_time: "07:15:00" });

  // Freitag abwählen und nochmal füllen → automatisch gefüllte Freitage verschwinden
  await page.getByLabel("Fr arbeitet").uncheck();
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: `${next} füllen` }).click();
  await expect(page.getByRole("status")).toContainText("abgewählten Wochentagen entfernt", { timeout: 30_000 });
  const fridays = async () => ((await admin.from("time_entries").select("date").eq("user_id", emp.id)
    .gte("date", `${next}-01-01`).lte("date", `${next}-12-31`)).data ?? [])
    .filter((r) => new Date(`${r.date}T12:00:00`).getDay() === 5);
  expect(await fridays()).toEqual([]);

  // Alles löschen: nur automatisch gefüllte Tage, der selbst eingetragene bleibt
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: `Automatisch gefüllte Tage in ${next} löschen` }).click();
  await expect(page.getByRole("status")).toContainText("gelöscht", { timeout: 30_000 });
  const { data: left } = await admin.from("time_entries").select("date")
    .eq("user_id", emp.id).gte("date", `${next}-01-01`).lte("date", `${next}-12-31`);
  expect((left ?? []).map((r) => r.date)).toEqual([KEEP]);

  // Jahresauswahl bis 2035
  await expect(page.getByLabel("Jahr", { exact: true }).locator("option", { hasText: "2035" })).toHaveCount(1);
});
