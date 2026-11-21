// Stundly SEO otomasyonu — GitHub Actions (.github/workflows/seo.yml) ve seo-kontrol.ps1 kullanır.
//
//   node scripts/seo-otomatik.mjs indexnow   # sitemap URL'lerini IndexNow'a gönder (Bing, Yandex, Seznam)
//   node scripts/seo-otomatik.mjs sitemap    # sitemap'i Google Search Console'a gönder
//   node scripts/seo-otomatik.mjs rapor      # son 7 günün Google arama raporu (+ e-posta)
//
// Ortam değişkenleri:
//   GSC_SERVICE_ACCOUNT  Google service account JSON'u (sitemap, rapor)
//   RESEND_API_KEY, SEO_RAPOR_EMAIL  ikisi de varsa rapor e-postayla gönderilir
// Kurulum: SEARCH_CONSOLE_KURULUM.md → "Tek seferlik kurulum"

import { createSign } from "node:crypto";
import { readdirSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SITE = "https://stundly.de";
const DOMAIN = "stundly.de";
const SITEMAP = `${SITE}/sitemap.xml`;
const GSC_SITE = encodeURIComponent(`sc-domain:${DOMAIN}`);
const GSC_API = `https://www.googleapis.com/webmasters/v3/sites/${GSC_SITE}`;

async function sitemapUrls() {
  const res = await fetch(SITEMAP);
  if (!res.ok) throw new Error(`sitemap.xml -> ${res.status}`);
  return [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

async function indexNow() {
  const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "apps", "web", "public");
  const keyFile = readdirSync(publicDir).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
  if (!keyFile) throw new Error("apps/web/public içinde IndexNow anahtar dosyası yok");
  const key = keyFile.slice(0, 32);
  const urls = await sitemapUrls();
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: DOMAIN, key, keyLocation: `${SITE}/${keyFile}`, urlList: urls }),
  });
  if (res.status !== 200 && res.status !== 202) throw new Error(`IndexNow -> ${res.status} ${await res.text()}`);
  console.log(`IndexNow: ${urls.length} URL gönderildi -> ${res.status}`);
}

// Service account ile OAuth token (JWT bearer), harici paket olmadan
async function googleToken() {
  const raw = process.env.GSC_SERVICE_ACCOUNT;
  if (!raw) return null;
  const sa = JSON.parse(raw);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/webmasters",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
  });
  if (!res.ok) throw new Error(`Google token -> ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function gsc(token, path, init = {}) {
  const res = await fetch(`${GSC_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) throw new Error(`Search Console ${path} -> ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function sitemap({ zorunlu }) {
  const token = await googleToken();
  if (!token) {
    if (zorunlu) throw new Error("GSC_SERVICE_ACCOUNT yok");
    console.log("GSC_SERVICE_ACCOUNT yok — Google sitemap gönderimi atlandı");
    return;
  }
  await gsc(token, `/sitemaps/${encodeURIComponent(SITEMAP)}`, { method: "PUT" });
  console.log("Search Console: sitemap gönderildi");
}

const gun = (d) => d.toISOString().slice(0, 10);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function rapor() {
  const token = await googleToken();
  if (!token) throw new Error("GSC_SERVICE_ACCOUNT yok");

  // Search Console verisi ~3 gün gecikmeli
  const bitis = new Date(Date.now() - 3 * 864e5);
  const aralik = (offset) => ({
    startDate: gun(new Date(bitis - (offset + 6) * 864e5)),
    endDate: gun(new Date(bitis - offset * 864e5)),
  });
  const sorgu = (body) => gsc(token, "/searchAnalytics/query", { method: "POST", body: JSON.stringify(body) });

  const [buHafta, gecenHafta, sorgular, sayfalar, sm] = await Promise.all([
    sorgu({ ...aralik(0) }),
    sorgu({ ...aralik(7) }),
    sorgu({ ...aralik(0), dimensions: ["query"], rowLimit: 15 }),
    sorgu({ ...aralik(0), dimensions: ["page"], rowLimit: 15 }),
    gsc(token, `/sitemaps/${encodeURIComponent(SITEMAP)}`).catch(() => null),
  ]);

  const top = (r) => r.rows?.[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const a = top(buHafta), b = top(gecenHafta);
  const fark = (x, y) => (x - y >= 0 ? `+${x - y}` : `${x - y}`);
  const satirlar = (r) => (r.rows ?? []).map((x) => [x.keys[0], x.clicks, x.impressions, x.position.toFixed(1)]);

  const { startDate, endDate } = aralik(0);
  const md = [
    `## Google arama raporu ${startDate} – ${endDate}`,
    "",
    `- Tıklama: **${a.clicks}** (önceki hafta ${fark(a.clicks, b.clicks)})`,
    `- Gösterim: **${a.impressions}** (önceki hafta ${fark(a.impressions, b.impressions)})`,
    `- Ortalama sıra: **${a.position ? a.position.toFixed(1) : "–"}**`,
    sm ? `- Sitemap: son okuma ${sm.lastDownloaded?.slice(0, 10) ?? "–"}, hata ${sm.errors ?? 0}, uyarı ${sm.warnings ?? 0}` : "- Sitemap: bilgi yok",
    "",
    "### Aramalar (tıklama / gösterim / sıra)",
    ...satirlar(sorgular).map((r) => `- ${r[0]} — ${r[1]} / ${r[2]} / ${r[3]}`),
    "",
    "### Sayfalar (tıklama / gösterim / sıra)",
    ...satirlar(sayfalar).map((r) => `- ${r[0].replace(SITE, "") || "/"} — ${r[1]} / ${r[2]} / ${r[3]}`),
  ].join("\n");

  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");

  const { RESEND_API_KEY, SEO_RAPOR_EMAIL } = process.env;
  if (RESEND_API_KEY && SEO_RAPOR_EMAIL) {
    const tablo = (r, baslik) =>
      `<h3>${baslik}</h3><table cellpadding="4" style="border-collapse:collapse;font-size:14px">` +
      `<tr><th align="left"></th><th>Tıklama</th><th>Gösterim</th><th>Sıra</th></tr>` +
      satirlar(r).map((x) => `<tr><td>${esc(x[0].replace(SITE, "") || "/")}</td><td align="right">${x[1]}</td><td align="right">${x[2]}</td><td align="right">${x[3]}</td></tr>`).join("") +
      `</table>`;
    const html =
      `<div style="font-family:sans-serif"><h2>Google arama raporu ${startDate} – ${endDate}</h2>` +
      `<p>Tıklama: <b>${a.clicks}</b> (${fark(a.clicks, b.clicks)})<br>Gösterim: <b>${a.impressions}</b> (${fark(a.impressions, b.impressions)})<br>` +
      `Ortalama sıra: <b>${a.position ? a.position.toFixed(1) : "–"}</b></p>` +
      tablo(sorgular, "Aramalar") + tablo(sayfalar, "Sayfalar") + `</div>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Stundly <noreply@stundly.de>",
        to: SEO_RAPOR_EMAIL,
        subject: `Stundly SEO: ${a.clicks} tıklama, ${a.impressions} gösterim (${startDate} – ${endDate})`,
        html,
      }),
    });
    if (!res.ok) throw new Error(`Resend -> ${res.status} ${await res.text()}`);
    console.log("Rapor e-postayla gönderildi");
  }
}

const komut = process.argv[2];
const islem = { indexnow: indexNow, sitemap: () => sitemap({ zorunlu: true }), "sitemap-varsa": () => sitemap({ zorunlu: false }), rapor }[komut];
if (!islem) {
  console.error("Kullanım: node scripts/seo-otomatik.mjs indexnow | sitemap | sitemap-varsa | rapor");
  process.exit(2);
}
islem().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
