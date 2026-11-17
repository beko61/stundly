import { test, expect } from "@playwright/test";

/**
 * Werbe-Herkunft: Einstieg über eine Rechner-Seite mit ?utm_…, Weg zur Registrierung per App-Link —
 * die Kampagne landet in den Auth-Metadaten (lib/marketing/utm). Die Registrierung wird abgefangen,
 * es entsteht kein Konto.
 */
test("utm der Einstiegsseite geht mit in die Registrierung", async ({ page }) => {
  let signupBody: { data?: Record<string, unknown> } | null = null;
  await page.route("**/auth/v1/signup**", async (route) => {
    signupBody = route.request().postDataJSON();
    await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ msg: "e2e: abgefangen" }) });
  });

  await page.goto("/zuschlagsrechner?utm_source=google&utm_medium=cpc&utm_campaign=notdienst");
  await page.locator('a[href="/register"]').first().click();
  await page.waitForURL(/\/register$/, { timeout: 30_000 });
  // Cookie-Banner deckt am Handy die AGB-Checkbox ab
  const nur = page.getByRole("button", { name: "Nur notwendige" });
  if (await nur.isVisible().catch(() => false)) await nur.click();

  await page.getByPlaceholder("Max Mustermann").fill("E2E Utm");
  await page.getByPlaceholder("deine@email.de").fill(`e2e-utm-${Date.now()}@example.com`);
  await page.locator('input[type="password"]').fill("e2eUtmTest-123");
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: "Registrieren" }).click();

  await expect.poll(() => signupBody, { timeout: 15_000 }).not.toBeNull();
  expect(signupBody!.data).toMatchObject({ utm_source: "google", utm_medium: "cpc", utm_campaign: "notdienst" });
});
