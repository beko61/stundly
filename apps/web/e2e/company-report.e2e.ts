import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import { loadE2eEnv } from "./env";

/** Firma → Berichte → "Jahr 2025": Jahresbericht-PDF eines Mitarbeiters zum Unterschreiben. */
const env = loadE2eEnv();
const admin = createClient(env.url, env.service, { auth: { persistSession: false } });

const stamp = Date.now();
const password = randomBytes(12).toString("base64url") + "A1!";
const boss = { email: `e2e-rep-boss-${stamp}@example.com`, id: "" };
const emp  = { email: `e2e-rep-emp-${stamp}@example.com`, id: "" };
let companyId = "";

test.beforeAll(async () => {
  for (const u of [boss, emp]) {
    const { data, error } = await admin.auth.admin.createUser({ email: u.email, password, email_confirm: true });
    if (error) throw error;
    u.id = data.user.id;
  }
  const { data: co, error } = await admin.from("companies")
    .insert({ name: "E2E Bericht GmbH", slug: `e2e-rep-${stamp}` }).select("id").single();
  if (error) throw error;
  companyId = co.id as string;
  await admin.from("profiles").update({ company_id: companyId, role: "company_admin", full_name: "Chef E2E" }).eq("user_id", boss.id);
  await admin.from("profiles").update({
    company_id: companyId, role: "employee", full_name: "Erika Muster", vorname: "Erika", nachname: "Muster",
  }).eq("user_id", emp.id);
  const { error: tErr } = await admin.from("time_entries").insert([
    { user_id: emp.id, date: "2025-01-06", day_type: "arbeiten", start_time: "07:45", end_time: "17:00", break_minutes: 60 },
    { user_id: emp.id, date: "2025-06-02", day_type: "arbeiten", start_time: "07:45", end_time: "18:00", break_minutes: 60 },
    { user_id: emp.id, date: "2025-08-04", day_type: "urlaub", start_time: null, end_time: null, break_minutes: 0 },
  ]);
  if (tErr) throw tErr;
});

test.afterAll(async () => {
  if (emp.id) await admin.from("time_entries").delete().eq("user_id", emp.id);
  for (const u of [boss, emp]) if (u.id) await admin.auth.admin.deleteUser(u.id);
  if (companyId) await admin.from("companies").delete().eq("id", companyId);
});

test("Jahresbericht-PDF für einen Mitarbeiter herunterladen", async ({ page }) => {
  await page.goto("/login");
  const nur = page.getByRole("button", { name: "Nur notwendige" });
  if (await nur.isVisible()) await nur.click();
  await page.locator('input[type="email"]').fill(boss.email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));

  await page.goto("/company/reports?year=2025&month=6");
  const card = page.locator(".card", { hasText: "Erika Muster" });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    card.getByRole("button", { name: "Jahr 2025" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("Jahresbericht_2025_Erika_Muster.pdf");
  await download.saveAs(test.info().outputPath("Jahresbericht_2025_Erika_Muster.pdf"));
  const pdf = readFileSync((await download.path())!, "latin1");
  expect(pdf.startsWith("%PDF")).toBe(true);
  for (const t of ["JAHRESBERICHT ARBEITSZEIT", "Erika Muster", "Summe", "Arbeitszeitkonto 2025", "Dezember"]) {
    expect(pdf).toContain(t);
  }
});
