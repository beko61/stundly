# Google Search Console + Bing Webmaster — özet (21.11.2026)

Yeni sohbette şunu yaz: "SEARCH_CONSOLE_KURULUM.md'yi oku, PowerShell otomasyonunu yapalım."

## Neden
Vercel Analytics (son 7 gün, 21.11): 60 ziyaretçi. Arama motorlarından gelenler: **Bing 10, Google 1**, DuckDuckGo 1, Ecosia 1.
En çok ziyaret alan SEO sayfası `/rufbereitschaft-verguetung` (15). Almanya'da aramaların büyük çoğunluğu Google'da yapılıyor, Google'dan gelen trafik neredeyse sıfır.

## Kontrol edilen durum (21.11, Claude)
- `https://stundly.de/robots.txt` → 200, içinde `Sitemap: https://stundly.de/sitemap.xml` satırı var; giriş gerektiren sayfalar Disallow ✓
- `https://stundly.de/sitemap.xml` → 200, 19 URL ✓
- DNS (united-domains, ns.udag.*): **`google-site-verification=…` TXT kaydı ZATEN VAR** → Search Console mülkü (Domain property) muhtemelen daha önce doğrulanmış.
  Bing doğrulama kaydı yok.
- Sitede Search Console için `<meta>` doğrulaması yok (DNS ile yapılmış, bu yeterli).

## Yapılacaklar
1. **Search Console** (https://search.google.com/search-console) — Google hesabınla gir:
   - `stundly.de` mülkü listede var mı? Varsa → **Sitemaps** → `sitemap.xml` gönder; **Seiten/Indexierung** raporuna bak
     (kaç sayfa indeksli, hangileri "Gecrawlt – zurzeit nicht indexiert").
   - Yoksa (başka bir Google hesabıyla kurulmuş olabilir) → "Domain" mülkü ekle; DNS'teki mevcut kayıt doğru hesaba
     aitse doğrudan doğrulanır, değilse Google'ın verdiği yeni TXT kaydını united-domains DNS'ine ekle.
   - Önemli sayfalar için **URL-Prüfung → Indexierung beantragen**: `/`, `/rufbereitschaft-verguetung`, `/zuschlagsrechner`,
     `/ueberstundenrechner`, `/stundenzettel-vorlage`, `/stundenzettel-excel-vorlage`, `/notdienst-verwaltung`, `/handwerker`, `/firma`.
2. **Bing Webmaster Tools** (https://www.bing.com/webmasters) → "Import from Google Search Console" (tek tık, doğrulama + sitemap aktarılır).
3. 1–2 hafta sonra Search Console → **Leistung**: hangi aramalarla görünüyoruz, tıklama/gösterim.

## Otomasyon — `scripts/seo-kontrol.ps1` (21.11, yapıldı)
`workly` klasöründe:
- `.\scripts\seo-kontrol.ps1` → robots, sitemap, her URL (200 / noindex / canonical), DNS TXT
- `.\scripts\seo-kontrol.ps1 -IndexNow` → ayrıca sitemap URL'lerini IndexNow'a gönderir (Bing/Yandex/Seznam). Her deploy sonrası çalıştırılabilir.
- `.\scripts\seo-kontrol.ps1 -Tarayici` → Search Console (Sitemaps, Indexierung, 9 önemli sayfa için URL-Prüfung) + Bing sekmelerini açar
- IndexNow anahtarı: `apps/web/public/673d482b3e7a2319a90f72347d4f01cf.txt` (middleware matcher'da hariç tutuldu). Canlıda erişilebilir olması için deploy gerekli.
- "Execution Policy" hatası olursa: `powershell -ExecutionPolicy Bypass -File .\scripts\seo-kontrol.ps1`

## Otomasyon fikri (ilk notlar)
Kullanıcı isteği: "PowerShell'de ben başlatayım, sistem otomatik yapsın."
Gerçekçi sınırlar:
- Google'a giriş, "Bestätigen"/"Indexierung beantragen" tıklamaları ve hesap izinleri **kullanıcıda** kalır
  (Claude şifre/giriş yapmaz). Google'ın eski "sitemap ping" adresi 2023'te kapatıldı.
- united-domains'in herkese açık bir DNS API'si yok → DNS kaydı elle.
Otomatik yapılabilecekler (script `scripts/seo-kontrol.ps1` gibi):
- robots.txt, sitemap.xml ve sitemap'teki her URL'nin 200 döndüğünü, `noindex` olmadığını, canonical'ın doğru olduğunu kontrol.
- DNS TXT kayıtlarını kontrol (Google/Bing doğrulama var mı) — `Resolve-DnsName -Type TXT stundly.de`.
- Search Console ve Bing sayfalarını tarayıcıda doğru adreslerle açma.
- **IndexNow** (Bing, Yandex, Seznam; Google desteklemiyor): sitede bir anahtar dosyası (`public/<key>.txt`) yayınlanır,
  script sitemap'teki URL'leri `https://api.indexnow.org/indexnow` adresine gönderir — girişsiz, tamamen otomatik.
  Kod değişikliği gerektirir (anahtar dosyası + isteğe bağlı her deploy sonrası gönderim).
- İsteğe bağlı (ileri seviye): Search Console API (OAuth, bir kez kullanıcı onayı) ile sitemap gönderme ve haftalık
  arama raporunu çekme.

## Yarım kalan iş (bu sohbetten)
- **Notdienst-Pauschale netto Rechner** sayfası (`/notdienstpauschale-rechner`): soru "Notdienstpauschale'den netto ne kalır?",
  hesap = netto(Gehalt + Pauschale) − netto(Gehalt) (`calcNettoFromBrutto`, `@workly/shared`). Henüz hiçbir dosya yazılmadı.
  Kayıt linki `/register?utm_source=tool&utm_campaign=notdienstpauschale`. Rufbereitschaft sayfası (v0.103.3) kalıp.
