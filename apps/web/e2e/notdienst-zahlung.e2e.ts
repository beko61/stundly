import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { loadE2eEnv } from "./env";

/**
 * Migration 041: Notdienst-Zahlung von beiden Seiten bestätigt.
 * Firma → "überwiesen" (wartet) · Mitarbeiter kann "bezahlt" nicht selbst setzen · Mitarbeiter → "Erhalten" → bezahlt.
 */
const env = loadE2eEnv();
const admin = createClient(env.url, env.service, { auth: { persistSession: false } });

const stamp = Date.now();
const pw = () => randomBytes(12).toString("base64url") + "A1!";
const boss = { email: `e2e-ndz-boss-${stamp}@example.com`, password: pw(), id: "" };
const emp  = { email: `e2e-ndz-emp-${stamp}@example.com`, password: pw(), id: "" };
let companyId = "";
let ndId = "";

// Erster Montag des aktuellen Monats → Woche (bis Sonntag) gehört sicher zu diesem Monat
const now = new Date();
const first = new Date(now.getFullYear(), now.getMonth(), 1);
first.setDate(1 + ((8 - first.getDay()) % 7));
const ndDate = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}-${String(first.getDate()).padStart(2, "0")}`;

test.beforeAll(async () => {
  for (const u of [boss, emp]) {
    const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true });
    if (error) throw error;
    u.id = data.user.id;
  }
  const { data: co, error } = await admin.from("companies").insert({ name: "E2E Notdienst GmbH", slug: `e2e-ndz-${stamp}` }).select("id").single();
  if (error) throw error;
  companyId = co.id as string;
  await admin.from("profiles").update({ company_id: companyId, role: "company_admin", full_name: "Chef E2E" }).eq("user_id", boss.id);
  await admin.from("profiles").update({ company_id: companyId, role: "employee", full_name: "Nico Notdienst" }).eq("user_id", emp.id);
  const { data: nd, error: ndErr } = await admin.from("notdienst_entries")
    .insert({ user_id: emp.id, date: ndDate, start_time: "18:00", end_time: "20:00", kunde: "Frau Kraft" }).select("id").single();
  if (ndErr) throw ndErr;
  ndId = nd.id as string;
});

test.afterAll(async () => {
  if (emp.id) await admin.from("notdienst_entries").delete().eq("user_id", emp.id);
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
const ndRow = async () => (await admin.from("notdienst_entries").select("erledigt, ueberwiesen_am").eq("id", ndId).single()).data!;

test("Firma überweist → Mitarbeiter bestätigt → erst dann bezahlt", async ({ browser }) => {
  // 1. Firma markiert als überwiesen
  const bossCtx = await browser.newContext();
  const bp = await bossCtx.newPage();
  await loginAs(bp, boss);
  await bp.goto(`/company/employees/${emp.id}?year=${first.getFullYear()}&month=${first.getMonth() + 1}`);
  await bp.getByRole("button", { name: "Als überwiesen markieren" }).click();
  await expect(bp.getByText("💸 Überwiesen · wartet")).toBeVisible();
  expect(await ndRow()).toMatchObject({ erledigt: false, ueberwiesen_am: expect.any(String) });

  // 2. Mitarbeiter darf "bezahlt" nicht direkt setzen (DB-Schutz)
  const empClient = createClient(env.url, env.anon, { auth: { persistSession: false } });
  await empClient.auth.signInWithPassword({ email: emp.email, password: emp.password });
  const direct = await empClient.from("notdienst_entries").update({ erledigt: true }).eq("id", ndId);
  expect(direct.error?.message).toMatch(/setzt deine Firma/);
  expect((await ndRow()).erledigt).toBe(false);

  // 3. Mitarbeiter bestätigt in der Tagesliste
  const empCtx = await browser.newContext();
  const ep = await empCtx.newPage();
  await loginAs(ep, emp);
  await ep.goto("/tracker");
  await ep.getByRole("button", { name: "Zahlung erhalten bestätigen" }).click();
  await expect.poll(async () => (await ndRow()).erledigt).toBe(true);
  await expect(ep.getByRole("img", { name: "Bezahlt — von dir bestätigt" })).toBeVisible();

  // 4. Firma sieht "bezahlt"
  await bp.reload();
  await expect(bp.getByText("✅ Bezahlt")).toBeVisible();
  await bossCtx.close(); await empCtx.close();
});
