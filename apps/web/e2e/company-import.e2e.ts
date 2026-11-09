import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { loadE2eEnv } from "./env";

/**
 * Firma → Foto-Import: Foto → Tabelle (KI-Antwort gemockt) → nicht erkannten Namen zuordnen, Zeit korrigieren →
 * "Bei allen speichern" → Einträge bei beiden Mitarbeitern + als Korrektur protokolliert (für sie sichtbar).
 */
const env = loadE2eEnv();
const admin = createClient(env.url, env.service, { auth: { persistSession: false } });

const stamp = Date.now();
const password = randomBytes(12).toString("base64url") + "A1!";
const boss = { email: `e2e-imp-boss-${stamp}@example.com`, id: "" };
const max  = { email: `e2e-imp-max-${stamp}@example.com`, id: "" };
const ayse = { email: `e2e-imp-ayse-${stamp}@example.com`, id: "" };
let companyId = "";

test.beforeAll(async () => {
  for (const u of [boss, max, ayse]) {
    const { data, error } = await admin.auth.admin.createUser({ email: u.email, password, email_confirm: true });
    if (error) throw error;
    u.id = data.user.id;
  }
  const { data: co, error } = await admin.from("companies")
    .insert({ name: "E2E Import GmbH", slug: `e2e-imp-${stamp}` }).select("id").single();
  if (error) throw error;
  companyId = co.id as string;
  await admin.from("profiles").update({ company_id: companyId, role: "company_admin", full_name: "Chef E2E" }).eq("user_id", boss.id);
  await admin.from("profiles").update({ company_id: companyId, role: "employee", full_name: "Max Müller" }).eq("user_id", max.id);
  await admin.from("profiles").update({ company_id: companyId, role: "employee", full_name: "Ayşe Yılmaz" }).eq("user_id", ayse.id);
  // vorhandener Eintrag → wird überschrieben (sichtbar als Korrektur)
  await admin.from("time_entries").insert({ user_id: max.id, date: "2026-11-03", day_type: "arbeiten", start_time: "08:00", end_time: "12:00", break_minutes: 0 });
});

test.afterAll(async () => {
  for (const u of [max, ayse]) {
    await admin.from("entry_corrections").delete().eq("user_id", u.id);
    await admin.from("time_entries").delete().eq("user_id", u.id);
  }
  for (const u of [boss, max, ayse]) if (u.id) await admin.auth.admin.deleteUser(u.id);
  if (companyId) await admin.from("companies").delete().eq("id", companyId);
});

test("Foto → Tabelle prüfen/korrigieren → bei allen gespeichert", async ({ page }) => {
  await page.route("**/api/company/scan", (route) => route.fulfill({ json: {
    hinweis: "Schichtplan KW 45",
    rows: [
      { name: "Müller", userId: max.id, date: "2026-11-03", day_type: "arbeiten", start_time: "07:00", end_time: "15:30", break_minutes: 30 },
      { name: "Müller", userId: max.id, date: "2026-11-04", day_type: "urlaub", start_time: null, end_time: null, break_minutes: 0 },
      { name: "A. Yilmz", userId: null, date: "2026-11-03", day_type: "arbeiten", start_time: "06:00", end_time: "41:00", break_minutes: 45 },
    ],
  } }));

  await page.goto("/login");
  const nur = page.getByRole("button", { name: "Nur notwendige" });
  if (await nur.isVisible()) await nur.click();
  await page.locator('input[type="email"]').fill(boss.email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));

  await page.goto("/company/reports");
  await page.getByRole("link", { name: "📷 Foto-Import" }).click();
  await page.getByText("Ich bestätige als Arbeitgeber").click();
  await page.getByLabel("Foto aus Galerie").setInputFiles({
    name: "plan.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64"),
  });

  const rows = page.getByTestId("import-row");
  await expect(rows).toHaveCount(3);
  await expect(page.getByText("3 Zeilen erkannt")).toBeVisible();
  const save = page.getByRole("button", { name: /Bei allen speichern/ });
  await expect(save).toBeDisabled();                       // Zeile 3: kein Mitarbeiter
  await expect(rows.nth(2)).toContainText("Mitarbeiter wählen");

  // Korrigieren: Person zuordnen, falsch gelesene Endzeit (41:00 → ungültig) eintragen
  await rows.nth(2).getByLabel("Mitarbeiter").selectOption({ label: "Ayşe Yılmaz" });
  await rows.nth(2).getByLabel("Ende").fill("14:00");
  await page.screenshot({ path: test.info().outputPath("foto-import-tabelle.png"), fullPage: true });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText(/Gespeichert: 2 neu, 1 geändert, 0 unverändert/)).toBeVisible();

  const { data: maxRows } = await admin.from("time_entries").select("date, day_type, start_time, end_time, break_minutes")
    .eq("user_id", max.id).order("date");
  expect(maxRows).toMatchObject([
    { date: "2026-11-03", day_type: "arbeiten", start_time: expect.stringMatching(/^07:00/), end_time: expect.stringMatching(/^15:30/), break_minutes: 30 },
    { date: "2026-11-04", day_type: "urlaub" },
  ]);
  const { data: ayseRows } = await admin.from("time_entries").select("start_time, end_time, break_minutes").eq("user_id", ayse.id);
  expect(ayseRows).toMatchObject([{ start_time: expect.stringMatching(/^06:00/), end_time: expect.stringMatching(/^14:00/), break_minutes: 45 }]);

  const { data: corr } = await admin.from("entry_corrections").select("user_id, reason").in("user_id", [max.id, ayse.id]);
  expect(corr).toHaveLength(3);
  expect(corr!.every(c => c.reason === "Import aus Stundenzettel-Foto")).toBe(true);
});
