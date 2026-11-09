import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { loadE2eEnv } from "./env";

/**
 * Foto-Scan: großes Handyfoto wird vor dem Senden verkleinert (vorher > Server-Limit → "Netzwerkfehler",
 * HEIC/BMP → "Ungültiger Bildtyp"), erkannte Tage werden übernommen. Die KI-Antwort ist gemockt
 * (kein Anthropic-Aufruf im Test).
 */
const env = loadE2eEnv();
const admin = createClient(env.url, env.service, { auth: { persistSession: false } });

const email = `e2e-scan-${Date.now()}@example.com`;
const password = randomBytes(12).toString("base64url") + "A1!";
let userId = "";

test.beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  userId = data.user.id;
});

test.afterAll(async () => {
  if (userId) {
    await admin.from("time_entries").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
});

/** 3000×2000 BMP (~18 MB) mit Verlauf — wie ein großes Handyfoto, aber ohne Bildbibliothek erzeugt. */
function bigBmp(w = 3000, h = 2000): Buffer {
  const row = Math.ceil((w * 3) / 4) * 4;
  const buf = Buffer.alloc(54 + row * h);
  buf.write("BM", 0); buf.writeUInt32LE(buf.length, 2); buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14); buf.writeInt32LE(w, 18); buf.writeInt32LE(h, 22);
  buf.writeUInt16LE(1, 26); buf.writeUInt16LE(24, 28); buf.writeUInt32LE(row * h, 34);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = 54 + y * row + x * 3;
    buf[o] = (x * 255) / w; buf[o + 1] = (y * 255) / h; buf[o + 2] = 200;
  }
  return buf;
}

test("Großes Foto → verkleinert gesendet → Einträge übernommen", async ({ page }) => {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let sent: { image: string; mediaType: string } | null = null;
  await page.route("**/api/scan", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ json: { result: "{}", parsed: {
      hinweis: "2 Tage erkannt",
      eintraege: [
        { datum: `${ym}-01`, beginn: "07:00", ende: "15:30", pause_minuten: 30 },
        { datum: `${ym}-02`, beginn: "07:00", ende: "16:00", pause_minuten: 45 },
      ],
    } } });
  });

  await page.goto("/login");
  const nur = page.getByRole("button", { name: "Nur notwendige" });
  if (await nur.isVisible()) await nur.click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));

  await page.goto("/tracker");
  await page.getByRole("button", { name: "Stundenzettel scannen" }).click();
  await page.locator('input[type="file"]').nth(1).setInputFiles({ name: "zettel.bmp", mimeType: "image/bmp", buffer: bigBmp() });
  await page.getByText("Ich willige ein").click();
  await page.getByRole("button", { name: "Zustimmen und fortfahren" }).click();
  await page.getByRole("button", { name: /KI scannen/ }).click();

  await expect(page.getByText("Erkannte Einträge (2)")).toBeVisible();
  expect(sent!.mediaType).toBe("image/jpeg");
  expect(sent!.image.length).toBeLessThan(3 * 1024 * 1024); // Server-Limit (vorher ~24 MB base64)

  await page.getByRole("button", { name: /Einträge übernehmen/ }).click();
  await expect(page.getByText("2 Einträge übernommen")).toBeVisible();
  await expect.poll(async () => (await admin.from("time_entries")
    .select("date").eq("user_id", userId)).data?.length).toBe(2);
});
