import { test, expect } from "@playwright/test";

/** Öffentliche Seiten laden ohne Konsolenfehler (Tanıtım + araç sayfaları). */
const PAGES = [
  ["/", /Stundly/],
  ["/stundenzettel-excel-vorlage", /Stundenzettel-Vorlage für Excel/],
  ["/stundenzettel-vorlage", /Stundenzettel-Vorlage als PDF/],
  ["/ueberstundenrechner", /Überstunden/],
  ["/login", /Anmelden|Login/i],
] as const;

for (const [path, heading] of PAGES) {
  test(`öffentlich: ${path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(path);
    await expect(page.locator("body")).toContainText(heading);
    expect(errors).toEqual([]);
  });
}

test("Startseite ohne Preis-Countdown und ohne Beta-Preis (Besucher schreckten Beträge ab)", async ({ page }) => {
  await page.goto("/");
  const body = page.locator("body");
  await expect(body).toContainText("keine Kreditkarte");
  await expect(body).not.toContainText(/noch \d+ Tage/);
  await expect(body).not.toContainText("Für Beta-Tester danach ab");
  await expect(body).not.toContainText("dauerhaft 50 %");
});
