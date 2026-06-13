# Stundly – Son Kayıt

## 2026-06-13 (15) – v0.5.2: BUG FIX — OG image middleware redirect

### Yapıldı
- ✅ **Bug**: `https://stundly.de/opengraph-image` URL'i `/login`'e 307 redirect ediyordu
  - Sebep: `middleware.ts` matcher pattern'i `opengraph-image` route'unu exclude etmiyordu
  - Auth check'i metadata route'unu da yakalıyor → social paylaşımlarda preview bozuk olabilirdi
- ✅ **Fix**: Matcher exclude listesine `opengraph-image|twitter-image|apple-icon|icon` eklendi
- ✅ Kullanıcının doğrulamadan tespit ettiği gerçek bug — sitemap.xml + robots.txt çalışıyordu ama OG image değildi
- ✅ Versiyon bump v0.5.1 → v0.5.2 (PATCH — bug fix)

### Test
- ✅ `tsc --noEmit` → 0 hata
- ⏳ Vercel deploy bitince: `curl -I https://stundly.de/opengraph-image` → `200 OK` + `Content-Type: image/png` dönmeli (eskiden `307 Location: /login`)

### Sebep & Notlar
- robots.txt + sitemap.xml exclude edilmişti ama yeni eklenen `app/opengraph-image.tsx` route'u listede yoktu
- Next.js'in tüm metadata route'ları için (icon, apple-icon, twitter-image dahil) generic exclude pattern eklendi → ileride benzer file convention'lar eklenirse otomatik public olur
- Bu bug olmadan: Twitter/FB/LinkedIn'de paylaşım önce yükleyebilir ama crawler `/login` HTML görüp parse edemez → preview kayıp
- Test komutu: kullanıcı `curl -I https://stundly.de/opengraph-image` ile doğrulayabilir

---

## 2026-06-13 (14) – v0.5.1: Vacation page empty state polish

### Yapıldı
- ✅ Vacation page'de eski minimal "Noch keine Urlaubsanträge" textine yerine gradient hint card:
  - Büyük 🏖 ikon, başlık, açıklayıcı paragraph
  - Açıklama: "Stundly PDF üretir + Tracker tagleri auto Urlaub'a çevirir"
  - CTA buton: "➕ Ersten Antrag erstellen" → mevcut `setShowForm(true)` handler'ı
- Salary/Dashboard empty state'leriyle görsel olarak tutarlı (gradient + emoji + CTA)
- ✅ Versiyon bump v0.5.0 → v0.5.1 (PATCH — UX polish, davranış aynı)

### Test
- ✅ `tsc --noEmit` → 0 hata

### Sebep & Notlar
- Empty state'ler 4 sayfada tutarlı şimdi: Dashboard, Salary (2-katman), Vacation
- Reports için her ay tüm günleri zaten gösteriyor (Wochenende/Frei fallback), ayrıca empty state'e gerek yok
- Calendar zaten görsel bar grafik, az veriyle dürüst görünüyor

---

## 2026-06-13 (13) – v0.5.0: Salary page empty states

### Yapıldı
- ✅ Salary page'e **2 katmanlı empty state** eklendi:
  1. **`entries.length === 0 && yearEntries.length === 0`** → Yeni kullanıcı (bu yıl hiç entry yok)
     - Büyük gradient hint card: "Noch keine Berechnung möglich"
     - 💰 ikon + açıklama: "Stundenlohn ayarla → Tracker'da arbeitstage erfasse"
     - CTA: "⏱ Zur Zeiterfassung →" (Link, accent button)
  2. **`entries.length === 0` (yalnızca bu ayda yok)** → Daha küçük info notice
     - "ℹ️ Für Juni 2026 gibt es noch keine Zeiteinträge"
     - Inline link: "Arbeitstage erfassen →"
- Settings kartları (Stundenlohn input + Steuer settings) her durumda görünür kalır
- ✅ Versiyon bump v0.4.3 → v0.5.0 (MINOR — yeni user-facing UX katmanı)

### Test
- ✅ `tsc --noEmit` → 0 hata

### Sebep & Notlar
- Önceden yeni kullanıcı Salary sayfasında €0 brutto + €0 netto + sıfır breakdown görüyordu → ürünün bozuk gibi göründüğü algı
- Yeni davranış: net mesaj + actionable CTA → next-step belirsizliği yok
- 2 katman ayrımı önemli: yıllık hiç entry yok = kurulum aşaması; ay-bazlı yok = sadece geçici durum (geçmiş ay browse ediyor olabilir)
- "💰 Noch keine Berechnung möglich" wording: pozitif ton, "broken" izlenimi vermez

### Versiyon tarihçesi (bu session)
- v0.1.0 → v0.2.0 (audit + version system)
- v0.2.0 → v0.3.0 (Dashboard setup guide + Beta wording)
- v0.3.0 → v0.4.0 (Landing mockup section)
- v0.4.0 → v0.4.1 (SEO infra + trust strip)
- v0.4.1 → v0.4.2 (schema.org JSON-LD)
- v0.4.2 → v0.4.3 (Dynamic OG image)
- v0.4.3 → **v0.5.0** (Salary empty states)

---

## 2026-06-13 (12) – v0.4.3: Dynamic OG image (1200×630)

### Yapıldı
- ✅ **Yeni `app/opengraph-image.tsx`** — Next.js `ImageResponse` API ile dinamik OG image
  - Boyut: 1200×630 (Twitter/Facebook/LinkedIn standardı)
  - Edge runtime
  - Tasarım:
    - Gradient background (#0f0f13 → #1a1a2e → #16213e diagonal)
    - Sağ üstte/sol altta dekoratif gradient blob'lar (#7c6af7 / #c084fc)
    - "🇩🇪 Made for Deutschland" rounded badge (üstte)
    - "STUNDLY" başlık (110px, accent purple)
    - Tagline 2-satır: "Arbeitszeit, Lohn & Notdienst" + "— alles in einer App."
    - Altta trust strip: 🔒 DSGVO · ⚖️ ArbZG · 💶 §19 UStG · 📱 PWA
- ✅ `layout.tsx` — Eski `images: ["/icons/icon-512.png"]` openGraph + twitter'dan kaldırıldı
  - Şimdi otomatik olarak `opengraph-image.tsx` kullanılır (Next.js convention)
- ✅ Versiyon bump v0.4.2 → v0.4.3 (PATCH — marketing/SEO polish)

### Test
- ✅ `tsc --noEmit` → 0 hata
- ⏳ Vercel build sonrası `stundly.de/opengraph-image` URL'i üretilmiş olmalı
- ⏳ Test: https://www.opengraph.xyz/?url=https%3A%2F%2Fstundly.de — sosyal preview kontrol
- ⏳ Test: Twitter Card Validator + LinkedIn Post Inspector

### Sebep & Notlar
- Önceden Twitter/Facebook stundly.de paylaşılınca 512×512 ufak icon gösteriyordu
- Şimdi 1200×630 büyük tasarım: marka adı + tagline + trust signals
- "Made for Deutschland" rozeti hedef pazarı netleştirir
- ImageResponse'un kısıtları: flexbox only, sınırlı CSS — bunlarla uyumlu tasarlandı
- Gradient blob'lar derinlik veriyor, düz background'dan daha profesyonel
- Bundle'a ekleme yok — edge runtime'da request anında üretilir

### Test Vercel deploy sonrası
1. https://stundly.de/opengraph-image — direkt image URL'i (PNG indirir)
2. https://www.opengraph.xyz/?url=https%3A%2F%2Fstundly.de — Twitter/FB preview
3. Discord/Slack'te `https://stundly.de` paylaş — gerçek render kontrol

---

## 2026-06-13 (11) – v0.4.2: schema.org JSON-LD (SoftwareApplication)

### Yapıldı
- ✅ Landing page'e schema.org `SoftwareApplication` JSON-LD eklendi
  - 3 plan (Einzelperson 5.99 / Team 19.99 / Unternehmen 49.99 EUR)
  - Creator/Organization: Stundly, Hannover, Niedersachsen, DE
  - Feature list (6 öğe)
  - `inLanguage: de-DE`, `applicationCategory: BusinessApplication`
- ✅ `dangerouslySetInnerHTML` ile `<script type="application/ld+json">` render edildi (Next.js + React standardı)
- ✅ Versiyon bump v0.4.1 → v0.4.2 (PATCH — SEO only, kullanıcı-görünür değişiklik yok)

### Test
- ✅ `tsc --noEmit` → 0 hata
- ✅ Google Rich Results Test ile doğrulanabilir: https://search.google.com/test/rich-results?url=https://stundly.de

### Sebep & Notlar
- Schema.org JSON-LD: Google'ın crawler'ı sayfayı "bir SaaS, fiyatları şunlar, geliştirici Hannover'lı" olarak anlar
- Sonuç: arama sonuçlarında rich snippet (yıldız reyting + fiyat + organisator) çıkma şansı artar
- "Stundenerfassung Hannover" gibi local search'ler için lokasyon doğru kayıtlı (Niedersachsen)
- ratingValue eklenmedi (henüz kullanıcı testimonial yok)
- priceValidUntil: 2027-12-31 (1.5 yıl, makul)
- Beta phase'de bile bu schema kalıcı (yıllık fiyatlar, beta phase tek-seferlik özel teklif)

---

## 2026-06-13 (10) – v0.4.1: SEO infrastructure + Trust strip + CTA Beta wording

### Yapıldı
- ✅ **Yeni `app/robots.ts`** — Next.js auto robots.txt
  - Allow `/`, disallow tüm authenticated route'lar (`/dashboard`, `/tracker`, `/api/`, vb.)
  - Sitemap reference: `${APP_URL}/sitemap.xml`
- ✅ **Yeni `app/sitemap.ts`** — Next.js auto sitemap.xml
  - Index: priority 1.0, weekly
  - Pricing: 0.8 monthly
  - Register/Login: 0.4-0.5 yearly
  - Impressum/Datenschutz/AGB: 0.3 yearly
- ✅ **Landing trust strip** — Footer üstüne 5 ikonlu satır
  - 🇩🇪 Entwickelt in Hannover
  - 🔒 Server in Frankfurt (EU)
  - 🚫 0 Tracking-Cookies
  - ⚖️ DSGVO & ArbZG-konform
  - 💶 Für Handwerk-Betriebe
- ✅ **CTA banner Beta-aware** — eskiden hardcoded "14 Tage kostenlos", Beta'da "3 Monate Beta-Zugang kostenlos"
- ✅ **Twitter card** `summary` → `summary_large_image` (sosyal paylaşımlarda büyük preview)

### Versiyon bump v0.4.0 → v0.4.1 (PATCH — SEO + polish)

### Test
- ✅ `tsc --noEmit` → 0 hata

### Sebep & Notlar
- robots.ts + sitemap.ts: Google/Bing crawl talimatı — organic SEO altyapısı
- Auth route'ları disallow → gizli sayfalar arama motoruna düşmesin
- Trust strip: ziyaretçi karar verme anında küçük şüpheleri ortadan kaldırır (Hannover'lı developer + EU server + DSGVO)
- "0 Tracking-Cookies" = differentiator (Toggl/Clockify çerez yüklüyor)
- Twitter large image: stundly.de linki Twitter/X'te paylaşılınca artık büyük görsel

### Sonraki olası adımlar
- Gerçek 1200x630 OG image tasarımı (şu an icon-512 kullanılıyor, ideal değil)
- Footer'a hosting badge (Vercel + Supabase logoları opsiyonel)
- Schema.org JSON-LD (SaaS Product structured data)
- Hreflang/multilang (DE/EN ileride)

---

## 2026-06-13 (9) – v0.4.0: Landing "Stundly im Einsatz" — 3 browser-mockup

### Yapıldı
- ✅ **Yeni `BrowserMock` component** (landing page'de inline) — Mac-tarzı pencere chrome (3 nokta + URL bar) + body slot
- ✅ Landing'e "Stundly im Einsatz" section eklendi (FEATURES ile COMPLIANCE arasında)
- ✅ **3 realistik UI mockup**:
  1. **Dashboard** (`stundly.de/dashboard`) — Yeni kullanıcı setup guide görünümü (3 numaralı adım kartı, gradient)
  2. **Zeiterfassung** (`stundly.de/tracker`) — 2 mini KPI kart (Differenz +04:15, Gearbeitet 178:15) + 5 günlük day list (Arbeiten/Urlaub karışık, doğru renkler, gerçek tarih + Cuma 6:15h)
  3. **Lohn & Steuer** (`stundly.de/salary`) — Brutto € 2.847 → Netto € 1.973 hero + Abzüge breakdown (LSt/Soli/RV/KV/AV/PV gerçek oranlarla)
- ✅ Caption altta her birinde: Dashboard "in 60 Sekunden startklar", Tracker "pro Tag in 5 Sekunden", Salary "Brutto → Netto automatisch"
- ✅ Versiyon bump v0.3.0 → v0.4.0 (MINOR — yeni section)

### Tasarım detayları
- Browser chrome: Mac-tarzı, 3 renkli nokta (#ff5f57 / #febc2e / #28c840)
- URL bar: 🔒 prefix, DM Mono font, muted color
- Pencere shadow: `0 8px 32px rgba(0,0,0,0.25)`
- İçerikler Stundly'nin gerçek CSS değişkenlerini kullanıyor (var(--green), var(--accent2), vs.) → tema değişse de uyumlu
- Mobile responsive: `repeat(auto-fit, minmax(340px, 1fr))` — küçük ekranda dikey yığılır

### Test
- ✅ `tsc --noEmit` → 0 hata

### Sebep & Notlar
- FAZ 2 ana iş paketinden ilki: "Landing'de ekran görüntüleri / mockup"
- Mockup'lar real screenshot değil — Stundly UI'ın HTML-rendered versiyonu (renkler/fontlar gerçek, içerikler örnek). İleride gerçek screenshot ile değiştirilebilir
- Honesty perspektifinden: ürün gerçekten böyle görünüyor (aynı CSS), sadece sample data ile
- Ziyaretçi "Demo ansehen" butonu olmadan da ürünü görsel olarak değerlendirebilir

### Kalan FAZ 2 işleri
- Demo video (60sn ekran kaydı)
- Sosyal kanıt rozetleri (Made in Germany badge daha belirgin)
- Testimonial section (ilk beta testerlardan toplanacak)

---

## 2026-06-13 (8) – v0.3.0: Yeni kullanıcı setup guide + Beta wording

### Yapıldı

**Yeni kullanıcı Dashboard empty-state (#1 ürün önceliği: basit + first-60s WOW)**
- ✅ `dashboard/page.tsx` — `isNewUser = yearEntries.length === 0` kontrolü
- Yeni kullanıcı için ayrı render branch: tüm KPI/hero/chart'lar gizli, yerine **3-adım setup guide**:
  1. 🕐 Standardzeiten festlegen → `/settings`
  2. 💰 Stundenlohn & Steuer → `/salary`
  3. ⏱ Ersten Arbeitstag erfassen → `/tracker`
- Her adım kart-link, numaralı badge + icon + açıklama + CTA arrow
- Gradient background (accent → accent2), gözü çekiyor
- Altta küçük Schnellzugriff (Tracker + Einstellungen)
- "Sobald du den ersten Eintrag erfasst hast, siehst du hier dein vollständiges Dashboard." footnote

**Onboarding done page Beta wording düzeltildi**
- ✅ `onboarding/done/page.tsx` — `isBetaActive()` kontrolü eklendi
- Beta aktifse: "🎁 Beta-Phase: Alle Funktionen 3 Monate kostenlos bis 07. September 2026"
- Beta bitince: eski "✓ 14 Tage kostenlos testen" wording'ine düşer
- Eski metin "14 Tage kostenlos" ile çelişiyordu (Beta phase'de 3 ay ücretsiz)

**Versiyon bump: v0.2.0 → v0.3.0** (MINOR — kullanıcı-görünür yeni feature)

### Test
- ✅ `tsc --noEmit` → 0 hata (bir JSX unicode quote hatası düzeltildi)

### Sebep & Notlar
- Log'daki strateji notu: "5 çalışan deneyiminden ders: 5 çalışanına `internetsiz HTML` denetti, 'zor' deyip reddettiler. Bu **#1 ürün önceliği**: basit + telefonda + tek tıkla"
- Yeni kullanıcı Dashboard'da sıfır değerli kartlar görmek yerine net "şu 3 adımı yap" rehberi görür
- Beta dışındaki müşteri yolculuğu da onarıldı (kayıt sonrası mesaj artık doğru)

### Sonraki adım için fikir
- Tracker'da "Heute" gününe scroll/highlight (ilk açılışta)
- Onboarding done → direkt Settings'e yönlendirmek de düşünülebilir (3-adımdan #1'i atla)
- Setup guide adımlarının "tamamlandı" işaretlemesi (DB-driven checkmarks)

---

## 2026-06-13 (7) – v0.2.0: Versiyon sistemi + Abmelden altı footer

### Yapıldı
- ✅ Yeni `lib/version.ts` — tek doğruluk kaynağı (`STUNDLY_VERSION = "0.2.0"`, `STUNDLY_VERSION_LABEL = "Stundly v0.2.0"`)
- ✅ Sidebar footer hardcoded "v0.1.0" → `STUNDLY_VERSION_LABEL` (import edildi)
- ✅ Vacation PDF footer hardcoded "v0.1.0" → `STUNDLY_VERSION_LABEL`
- ✅ Settings → Abmelden butonunun altına version footer eklendi (DM Mono, küçük, muted)
- ✅ Memory: `feedback_versiyon_bump.md` eklendi — semver bump standardı (patch/minor/major)

### Bump kuralları (artık standart)
- **PATCH**: bug fix, yorum cleanup, log-only değişiklik, internal refactor
- **MINOR**: yeni kullanıcı-görünür özellik / UI / alan
- **MAJOR**: breaking change, public launch

### Versiyon geçmişi
- v0.1.0 → v0.2.0 (audit roundlarındaki tüm fix + Standardzeiten feature + refactor toplandı)

### Test
- ✅ `tsc --noEmit` → 0 hata

### Sebep & Notlar
- Kullanıcı talebi: "abmelden altinda versiyon var her yeni yada degisiklik yaptiginda versiyon sitandarti belirle ve versiyon atla"
- Memory'ye standart kaydedildi → bundan sonra her commit'ten önce version.ts bump edilecek
- Şu an v0.2.0 — sonraki PATCH bug fix'lerde v0.2.1, sonraki MINOR feature'da v0.3.0

---

## 2026-06-13 (6) – #12b refactor tamamlandı + #10 yorum cleanup

### Yapıldı

**#12b — MonthlySummary + Dashboard helper'a geçti (DRY tamam)**
- ✅ `lib/utils/monthStats.ts` — `MonthStatsResult` genişletildi: `urlaubMin` ve `krankMin` alanları eklendi (UI breakdown için)
- ✅ `MonthlySummary.tsx` — 70 satırlık lokal `stats` hesabı kaldırıldı, helper'ı çağırıyor (worked/ndMin/urlaubMin/krankMin hepsi tek kaynaktan)
- ✅ `dashboard/page.tsx` — `calcMonthMinutes` yerel fonksiyonu kaldırıldı, helper'a geçti (selected month stats + 12-month breakdown)
- ✅ Yeni `monthFeiertageMap()` küçük helper'ı (yıllık feiertage → aylık subset Record)

**#10 — Yorum drift cleanup**
- ✅ `DayEntry.tsx` — "Sollstunden (8:15 / 6:15)" yorumu "8h Sollstunden (Mo-Fr)" olarak güncellendi
- ✅ `DayEntry.tsx` — `getDayStdMins` üst yorumu sadeleştirildi, `standardTimes` referansı eklendi
- ✅ `TimeEntryModal.tsx` — "Sollstunden Mo-Do 8:15 / Fr 6:15" yorumu "Sollstunden = 8h flat Mo-Fr" oldu

### Sonuç: 4 dosyanın hepsi tek doğruluk kaynağını kullanıyor
- `reports/page.tsx` ✓
- `calendar/page.tsx` ✓
- `MonthlySummary.tsx` ✓ (yeni)
- `dashboard/page.tsx` ✓ (yeni)
- Helper kullananlar: Auto-Feiertag sayımı + targetMin + workDaysInPeriod ortak

### Test
- ✅ `tsc --noEmit` → 0 hata (tek small fix: dashboard'da `calculateWorkDuration` import'u 7-day chart için geri eklendi)

### Sebep & Notlar
- DRY ihlali #12 ile başlamıştı (reports + calendar refactor edilmişti, ama MonthlySummary + dashboard kendi kodunda kalmıştı)
- Bu turda helper'a `urlaubMin`/`krankMin` eklenerek MonthlySummary'nin UI breakdown'u korundu
- Dashboard refactor sırasında 30+ satır tekrar eden kod silindi
- Toplam: ~150 satır kod kaldırıldı, hepsi tek helper'a delegated

---

## 2026-06-13 (5) – Standardzeiten özelleştirilebilir (kullanıcının gerçek schedule'ı)

### Yapıldı
- ✅ **Yeni `lib/utils/standardTimes.ts`** — localStorage tabanlı kullanıcı arbeitszeit ayarları
  - `monThuStart/End/Pause` (Mo-Do) + `friStart/End/Pause` (Fr) ayrı alanlar
  - Default: Mo-Do 07:45-17:00/60dk = 8:15h, Fr 07:45-14:30/30dk = 6:15h (Hannover Vorlage — kullanıcının gerçek schedule'ı geri geldi)
  - `getStandardTimes()`, `setStandardTimes()`, `getDefaultForDow(dow)` API
  - localStorage'a yazınca `storage` event firewall ile cross-component sync
- ✅ **TimeEntryModal** — `getDefaults` artık `getStandardTimes()` okuyor, hafta gününe göre Mo-Do veya Fr ayarını seçiyor (Sa/So için Mo-Do fallback)
- ✅ **AutoFillReports** — Standardzeiten config bölümü eklendi:
  - Mo-Do + Fr ayrı kartlar, her birinde 3 input (Beginn / Ende / Pause)
  - Yazınca anında localStorage'a kaydeder + "✓ Gespeichert" feedback
  - Confirm dialog kullanıcının kaydettiği saatleri gösterir
  - Yıllık doldurma artık STD_TIMES constant'ı yerine kullanıcının ayarlarını kullanır

### Geri alındı (önceki #9 fix'i)
- ⏪ TimeEntryModal Cuma default = 17:00/60dk değişikliği geri alındı
  - Sebep: Kullanıcı "cuma günü bilerek öyle yaptım, benim çalışma saatim öyle" diye belirtti
  - Yeni çözüm: Standardzeiten artık kullanıcı tarafından ayarlanabilir
  - Default tekrar Hannover Vorlage (07:45-14:30/30dk) — istediği gibi değişebilir

### Test
- ✅ `tsc --noEmit` → 0 hata

### Sebep & Notlar
- Kullanıcı tek tipte Mo-Fr 8h sabit değil, Cuma yarım gün çalışıyor (07:45-14:30 / 30dk pause = 6:15h)
- "Auto-Fill önce ayarla, sonra doldur" UX akışı için Settings'te ayarlar inline duruyor
- localStorage tercihi: Beta phase'de cihaz-başına ayar yeterli; ileride DB migration ile multi-device sync eklenebilir
- Sollstunden (Urlaub/Krank/Feiertag günleri 8h flat sayılıyor — bu ayrı bir karar) DEĞİŞMEDİ, sadece UI default + AutoFill saatleri özelleştirilebilir hale geldi

### Kullanım
1. Settings'e git → "Jahres-Befüllung" kartı
2. "Standardzeiten" bölümünde Mo-Do ve Fr için kendi saatlerini gir → otomatik kaydeder
3. "Jahr komplett befüllen" butonu kaydettiğin saatlerle doldurur
4. Tracker'da yeni Arbeiten entry açtığında da bu saatler default gelir

---

## 2026-06-13 (4) – Audit listesi devamı: #9 #14 #11 #12 (4 fix)

### Yapıldı

**#9 — TimeEntryModal Cuma default 8h**
- ✅ `TimeEntryModal.tsx` — `getDefaults` artık tüm hafta içi günler için 08:00–17:00 / 60dk pause = 8h netto (eskiden Cuma 07:45–14:30 / 30dk = 6:15h, eski Hannover modeli)
- Sollstunden Mo-Fr 8h modeli ile uyumlu (eskiden UI default model ile çelişiyordu)

**#14 — Onboarding Bundesland zorunlu seçim**
- ✅ `onboarding/setup/page.tsx` — Bundesland default `""` (boş) yapıldı, `<option value="" disabled>Bitte auswählen…</option>` eklendi
- Eskiden "NI" otomatik seçili → Bayern'li kullanıcı "Weiter" deyince Niedersachsen Feiertag'ları alırdı
- Açıklama metni de güncellendi: "Bestimmt die gesetzlichen Feiertage in deinem Bundesland."

**#11 — Logo upload resize + compress**
- ✅ `settings/page.tsx` — Yeni `resizeLogo(file, maxWidth, quality)` helper'ı eklendi (Canvas API)
  - Max genişlik 400px, JPEG kalite 0.85 → genelde 30-80 KB base64
  - Dosya tipi kontrolü (image/*)
  - 5 MB üst sınır + okunabilir hata mesajı
- DB row patlama riski ortadan kalktı

**#12 — Month-stat helper'a refactor (kısmi: 2/4 dosya)**
- ✅ Yeni `lib/utils/monthStats.ts` — tek doğruluk kaynağı `calcMonthStats({...})` + `countWorkDays(...)`
- ✅ `reports/page.tsx` — eski lokal `calcStats`/`countWorkDays` kaldırıldı, helper kullanıyor
- ✅ `calendar/page.tsx` — eski lokal `calcMonthStats` kaldırıldı, bundesland yükleniyor + Auto-Feiertag desteği (eskiden Neujahr vb. saymıyordu!)
- ⏳ `MonthlySummary.tsx` + `dashboard/page.tsx` UI-spesifik ekstra alanlar kullanıyor (urlaubMin/krankMin/brutto) → sonraki turda helper'ı genişleterek refactor edilecek

### Test
- ✅ `tsc --noEmit` → 0 hata

### Sebep & Notlar
- #9: Tracker'da Cuma yeni Arbeiten entry açtığında 14:30 görmek kullanıcıyı şaşırtıyordu (Sollstunden 8h ama default 6:15h)
- #14: Bayern/BW gibi farklı Feiertag profili olan eyaletler için zorunluydu
- #11: 5 MB logo → 5+ MB base64 + row size limit → sessizce kesik veri/timeout
- #12: Hidden bug öldü: Calendar `calcMonthStats` Auto-Feiertag (Neujahr vb. DB'de olmayan) saymıyordu → yıllık total saatler 5×8=40h+ eksik gözüküyordu. Helper bunu içeriyor

---

## 2026-06-13 (3) – A-Z audit sonrası 8 kritik fix (Türkçe leak + hardcoded değerler)

### Yapıldı

**Türkçe → Almanca temizliği (kritik — pazarlama önce şart)**
- ✅ `register/page.tsx` — tüm error mesajları DE: "Diese E-Mail-Adresse ist bereits registriert.", "Das Passwort muss mindestens 6 Zeichen lang sein.", "Bitte eine gültige E-Mail-Adresse eingeben.", "Zu viele Versuche. Bitte einige Minuten warten.", "Die Registrierung ist derzeit deaktiviert. Bitte kontaktiere den Administrator."
- ✅ `register/page.tsx` — confirm ekranı DE: "Bitte E-Mail prüfen", "Wir haben einen Bestätigungslink an X gesendet. Klicke auf den Link...", "Zur Anmeldung", "Keine Mail erhalten? Bitte Spam-Ordner prüfen."
- ✅ `page.tsx` — FAQ "für Almanya (ArbZG)" → "in Deutschland"

**Landing ↔ Pricing fiyat senkronu**
- ✅ `page.tsx` — Plans dizisi yeni fiyatlara güncellendi: Einzelperson 5,99€ · Team 19,99€ · Business 49,99€ (eskiden 9,99/29,99/79,99)
- ✅ Plan features Pricing ile uyumlu hale getirildi
- ✅ FAQ "14-tägige Testphase" → Beta phase wording: "kostenlose Testphase – während der Beta-Phase 3 Monate komplett gratis"

**Hardcoded değerler → salary_settings'ten oku**
- ✅ `calendar/page.tsx` — `TARGET_H = 174` hardcoded kaldırıldı, salary_settings'ten okunur (Tracker ile birebir uyum), `calcMonthStats` parametre alır
- ✅ `MonthlySummary.tsx` — `URLAUB_DEFAULT = 30` hardcoded kaldırıldı, `urlaub_anspruch` salary_settings'ten okunur (live sync via localStorage)
- ✅ `vacation/page.tsx` — `VAC_TOTAL = 30` hardcoded kaldırıldı, salary_settings'ten okunur
- ✅ `reports/page.tsx` — `STANDARD_HOURS = 174` hardcoded kaldırıldı, salary_settings'ten okunur (year mode'da × 12)

### Güncellendi
- ✅ 7 dosya değişti (register, page.tsx landing, calendar, MonthlySummary, vacation, reports, ayrıca önceki PDF + Berichte fix'leri tek commit'e dahil)

### Test
- ✅ `tsc --noEmit` → 0 hata

### Sebep & Notlar
- Kullanıcının A-Z audit talebi sonrası bulunan ana sorunlar:
  - **Türkçe leak**: Alman müşteri Register sayfasında Türkçe error görseydi şokta olurdu
  - **Fiyat tutarsızlığı**: Beta sonrası landing 9,99 gösterirken pricing 5,99 → kafa karışıklığı
  - **Calendar vs Tracker uyumsuzluğu** (kullanıcının raporladığı sorun): Calendar `TARGET_H=174` hardcoded olduğu için Tracker'daki MonthlySummary ile diff'ler birbirini tutmuyordu
  - **Urlaub kontingenti**: 3 yerde (MonthlySummary, vacation, calendar) `30` hardcoded; sadece Dashboard doğru okuyordu → kullanıcı 25'e değiştirse her yerde 30 görürdü
- Kalan teknik borç (audit listesi #9-18):
  - TimeEntryModal Cuma default 6:15h (eski Hannover modeli) → 8h olmalı
  - Logo upload resize/compress yok
  - DRY: aynı month-stat hesabı 4 dosyada kopya → tek lib helper'a refactor edilmeli
  - DayEntry yorum drift'leri

---

## 2026-06-13 (2) – PDF Briefkopf ortalama + Berichte tüm günler + Vacation senkron

### Yapıldı
- ✅ **PDF Monatsbericht Briefkopf ortalandı** (`lib/pdf/monthlyReportPdf.ts`)
  - Logo (22 mm) sayfa ortasına alındı (eskiden sol blok)
  - Firma adı + adres + tel + email tek blokta sayfa ortasında
- ✅ **Berichte Std sütunu Urlaub/Krank/Feiertag için 08:00 gösterir** (`reports/page.tsx`)
  - Eski: `start_time` null olunca "—" gösteriyordu
  - Yeni: day_type urlaub/krank/feiertag ise Sollstunden (08:00) yazılır
  - CSV export'u da aynı kurala uydu
- ✅ **Berichte tüm ay günlerini gösterir** (eskiden sadece entries vardı, 6-29 arası gözüküyordu)
  - `monthDays` memo'su her ayın tüm günlerini iterate eder
  - Entry yoksa: Wochenende / Feiertag / Frei olarak doğru tag
  - Wochenende satırı yumuşak gri arkaplanla ayrıştı
- ✅ **Arbeitstage KPI doğru sayıyor** — Mo-Fr minus Feiertag (Haziran 2026 NI: 22)
  - Eski: `entries.filter(arbeiten).length` → kullanıcı işlediği gün sayısı (yanıltıcı)
  - Yeni: `countWorkDays(year, month, feiertage)` → ayın gerçek iş günü sayısı
  - Profil'den bundesland yüklendi → doğru Feiertag listesi
- ✅ **Vacation page Urlaub sayısı time_entries'ten okunur** (`vacation/page.tsx`)
  - Eski: `vacation_requests.days_count` toplamı → Tracker'dan direkt Urlaub girilince saymıyordu
  - Yeni: `time_entries.day_type=urlaub` count → Zeiterfassung ile birebir senkron
  - `handleDelete` artık lokal hesap yapmıyor, `load()` çağırır → tek doğruluk kaynağı

### Güncellendi
- ✅ `apps/web/src/lib/pdf/monthlyReportPdf.ts` — Briefkopf merkezleme
- ✅ `apps/web/src/app/(dashboard)/reports/page.tsx` — countWorkDays + monthDays + DAY_STD_MIN
- ✅ `apps/web/src/app/(dashboard)/vacation/page.tsx` — yearUsedDays time_entries'ten

### Test
- ✅ `tsc --noEmit` → 0 hata

### Sebep & Notlar
- 4 fix kullanıcı raporundan: (1) PDF ortalama (2) Urlaub Std boş (3) "6-29 yerine 22 iş günü olmalı" (4) menü ↔ Zeiterfassung Urlaub mismatch
- 3 numaranın gerçek sorunu: Berichte sadece entries'i listeliyordu, eksik günleri (1-5, 30) görünmüyordu → şimdi tüm 30 gün listelenir; Arbeitstage de gerçek iş günü sayısını gösterir
- 4 numaranın gerçek sorunu: Tracker'dan eklenen Urlaub `vacation_requests` tablosuna yazılmıyordu (sadece `time_entries`'e); Vacation menüsü `vacation_requests`'i sayıyordu → şimdi her iki yer aynı kaynaktan okuyor

---

## 2026-06-13 – Bekleyen Supabase migration'ları çalıştırıldı

### Yapıldı
- ✅ Supabase SQL Editor → **013_urlaub_anspruch.sql** çalıştırıldı (salary_settings'e `urlaub_anspruch int default 30` kolonu eklendi, check 0-60)
- ✅ Supabase SQL Editor → **014_firma_adresse.sql** çalıştırıldı (profiles'a `firma_strasse / firma_plz / firma_ort / firma_telefon` text kolonları eklendi)
- ✅ Settings sayfasında firma adresi artık kaydedilebilir, PDF Briefkopf tam veri ile çıkar
- ✅ Urlaubsanspruch artık DB-driven (eski 30 gün hardcoded yerine kullanıcı ayarı)

### Güncellendi
- ✅ `STUNDLY_LOG.md` → "Henüz çalıştırılmamış migration" uyarısı kaldırıldı
- ✅ `son_kayit.md` → bu giriş eklendi

### Not
- Migration 001-012 zaten canlıda çalışıyordu (site ayakta) — sadece 013/014 bekliyordu
- Her ikisi de idempotent (`add column if not exists`), tekrar çalıştırılsa güvenli
- Kullanıcı tarafında kalan offline iş: Gewerbe Anmeldung + info@stundly.de forwarding

---

## 2026-06-12 → 13 – Beta launch + Settings reorganizasyonu + bug fix yağmuru

### Tamamlanan (özet)
- ✅ **Beta Phase** aktive (`lib/beta.ts`, BETA_MODE=true, 07.06 → 07.09.2026, Pricing gizli, Stripe checkout 403)
- ✅ **Sollstunden** Mo-Fr 8h sabit (Hannover 8:15/6:15 modeli kaldırıldı)
- ✅ **Auto-Feiertag sayım fix**: Neujahr vb. artık MonthlySummary + Dashboard workedMin'e dahil (eskiden 8h eksik sayılıyordu)
- ✅ **Notdienst hafta-ay atfı**: cross-month haftalar haftanın Pazartesi'sinin bulunduğu aya yazılır
- ✅ **Calendar Mayıs bug**: `window.location.href` → `router.push()` (Zustand state korunuyor)
- ✅ **Dashboard ↔ Salary live sync**: storage event + visibilitychange
- ✅ **Import split format desteği**: eski internetsiz HTML'in `userData[date]="Urlaub"` formatı parse edilir, Frei import'tan çıkar
- ✅ **Feiertag günlerinde Notdienst ekleme** açık
- ✅ **Settings reorganization**:
  - Firma adresi alanları eklendi (migration 014: firma_strasse/plz/ort/telefon)
  - Generic Mustermann placeholders
  - Notdienst ℹ️ tooltip (`InfoTooltip.tsx`)
  - Auto-fill butonu Settings'e taşındı (`AutoFillReports.tsx`), komplett dolu → pasif yeşil
  - PDF butonu Berichte sayfasına taşındı (CSV yanına)
- ✅ **PDF Briefkopf yenilendi**: logo sol üstte 24x24, firma adresi düzenli yerleşim, Mitarbeiter detayları, imza otomatik
- ✅ **Daten zurücksetzen butonu** Settings'e + `/api/account/reset-data`
- ✅ /setup tek-kullanımlık sayfa silindi (security)

### ⚠️ Kullanıcı tarafında bekleyen
1. Supabase'de **migration 013_urlaub_anspruch.sql** ve **014_firma_adresse.sql** çalıştırılmalı (firma bilgileri kaydedilmiyorsa bu eksik demektir)
2. Gewerbe Anmeldung (Hannover Gewerbeamt)
3. info@stundly.de forwarding (ImprovMX önerildi)

### Genel durum
- FAZ 1 KAPATILDI ✓
- Beta phase aktive, 3 ay ücretsiz, Stripe arka planda hazır
- 07.09.2026'da `BETA_MODE=false` set → normal Stripe pricing devreye girer

---

## 2026-06-07 (gece-2) – Export tam kapsamlı + Calendar/Dashboard sync fix

### Yapılan
- ✅ `apps/web/src/app/(dashboard)/calendar/page.tsx` — Ay tıklamada `window.location.href` (full reload) → `router.push()`. Zustand state silinmiyor, seçili ay korunuyor.
- ✅ `apps/web/src/app/(dashboard)/dashboard/page.tsx` — Salary sayfasındaki hourly_rate / monthly_target_hours / vb. değişiklikleri Dashboard'a canlı yansıtmak için: localStorage ilk + 'storage' event + 'visibilitychange' listener. Supabase satırı baseline, lokal en taze.
- ✅ `apps/web/src/app/(dashboard)/reports/page.tsx` — CSV export tamamen yenilendi:
  - `notdienst_entries` tablosu da yükleniyor (eskiden eksikti)
  - Yeni sütunlar: Kunde, Adresse, Problem, Ergebnis, Bezahlt
  - Urlaub/Krank/Feiertag için Sollstunden (Mo-Do 8:15h, Fr 6:15h) Std sütununa yazılır (eskiden NULL → boş görünüyordu)
  - Ayraç `;` + CRLF + BOM (Excel-DE uyumlu), tırnak escape
- ✅ `apps/web/src/app/(dashboard)/settings/page.tsx` — Yeni "💾 Sicherung herunterladen" butonu (Import kartının üstünde). `stundly_backup_YYYY-MM-DD.json` indirir: userData + userNotdienst + userNotes + salarySettings + vacationRequests + salaryRecords. İnternetsiz HTML formatıyla uyumlu → aynı sayfadaki Import alanından geri yüklenebilir.
- ✅ `apps/web/src/app/api/dsgvo/export/route.ts` — `notdienst_entries` ve `salary_records` eklendi.

### Güncellendi
- ✅ `STUNDLY_LOG.md` (devam ediyor).

### Test
- ✅ `tsc --noEmit` → temiz.

---

## 2026-06-07 (gece) – Masaüstü Dashboard yeniden tasarlandı

### Yapılan
- ✅ İnternet araştırması: 2026 SaaS dashboard trendi (Linear/Vercel/Notion/Toggl) — 240px sidebar + 4-6 KPI hero strip + border-only kart + F-pattern + progressive disclosure.
- ✅ `apps/web/src/app/(dashboard)/dashboard/page.tsx` — Yeni `/dashboard` route. Greeting + ay başlık, 2 hero kart (Stundensaldo + Brutto-Lohn), 4 KPI (Geleistet / Notdienst / Urlaub übrig / Nächster Feiertag), son 7 gün bar grafik + 4 quick action linki.
- ✅ `apps/web/src/app/globals.css` — Kritik bug fix: `.sidebar { display: none !important; }` masaüstünde bile Sidebar'ı gizliyordu, responsive media query'lere ayrıldı (mobile bottom-nav, desktop sidebar). Sidebar 250→240px, gradient kaldırıldı, link min-height 36px, active pill highlight. Page-header çirkin gradient (#1a1a2e→#0f3460) sade `var(--bg)` yapıldı. Yeni dash-* stilleri eklendi (hero, kpi-grid, panel, bars, actions).
- ✅ `apps/web/src/components/ui/Sidebar.tsx` — 4 grup başlığı (Übersicht / Erfassung / Auswertung / Konto), avatar + email footer.
- ✅ `apps/web/src/components/ui/BottomNav.tsx` — Calendar→Dashboard "Start" olarak değişti.
- ✅ `apps/web/src/middleware.ts` — `/tracker` redirect'leri `/dashboard`'a güncellendi.
- ✅ `apps/web/src/app/(auth)/login/page.tsx` — Login sonrası `/dashboard`.

### Güncellendi
- ✅ `STUNDLY_LOG.md` → 2026-06-07 (gece) bölümüne detaylı Dashboard refactor notu.

### Test
- ✅ `tsc --noEmit` → hata yok.

---

## 2026-06-07 – Mobile Abmelden butonu eklendi

### Yapılan
- ✅ `apps/web/src/app/(dashboard)/settings/page.tsx` → Settings sayfasının en altına (Import kartından sonra) tam genişlikte kırmızı kenarlıklı "🚪 Abmelden" butonu eklendi. `handleLogout` fonksiyonu zaten vardı ama bağlanmamıştı. Mobilde sidebar gizli olduğu için BottomNav → Profil sekmesinden artık çıkış yapılabiliyor.

### Güncellendi
- ✅ `STUNDLY_LOG.md` → 2026-06-07 (akşam) bölümüne "Mobile Abmelden butonu" notu eklendi.

---

## 2026-04-06 – Masaüstü Tasarımına Geçiş Tamamlandı

### Yapılan Değişiklikler
- ✅ `globals.css` → Desktop media queries eklendi (768px+, 1200px+)
  - Büyük card padding, wider modal (640-720px, ortada), responsive label/input/button boyutları
  - `summary-wrapper`, `settings-grid-3`, `report-table-header/row` CSS sınıfları
  - Sayfa geçiş animasyonu (fadeIn), focus ring (erişilebilirlik)
- ✅ `MonthlySummary.tsx` → `summary-wrapper` CSS sınıfı uygulandı
- ✅ `tracker/page.tsx` → İçerik padding 24→32px
- ✅ `calendar/page.tsx` → İçerik padding 24→32px
- ✅ `salary/page.tsx` → İçerik padding 24→32px, ayarlar gridi `settings-grid-3`
- ✅ `vacation/page.tsx` → İçerik padding 24→32px
- ✅ `settings/page.tsx` → Max-width 800→960px, padding 24→32px, 3 grid `settings-grid-3`
- ✅ `reports/page.tsx` → İçerik padding 24→32px, tablo `report-table-header/row`

### Önceden Tamamlanmış (Dokunulmadı)
- ✅ Sidebar.tsx → Zaten 250px sol kenar çubuğu olarak kurulmuş
- ✅ Dashboard layout → Sidebar + flex content layout zaten mevcut  
- ✅ MonthNav → Logout sidebar'a taşınmış, tekrarlı STUNDLY başlığı kaldırılmış

### Test
- ✅ `next build` → Derleme başarılı (8.8s)
- ✅ Tip kontrolleri geçti
- ✅ Dev server çalışıyor, landing/login sayfaları desktop'ta profesyonel

---



### Proje Durumu (Tespit Edildi)
- ✅ Monorepo yapısı kurulu (Turborepo)
- ✅ `apps/web` → Next.js (tracker, calendar, salary, reports, vacation, settings sayfaları mevcut)
- ✅ `apps/mobile` → Expo RN (TrackerScreen, CalendarScreen, SalaryScreen, ScanScreen, ProfileScreen, VacationScreen, ReportsScreen)
- ✅ `packages/shared` → Ortak tipler + timeCalc + salaryCalc + dayTypes
- ✅ Supabase auth entegrasyonu (web + mobile)
- ✅ Navigation sistemi kurulu (Bottom tabs + Stack navigators)
- ✅ NotdienstModal + TimeEntryModal bileşenleri mevcut
- ✅ Tema sistemi (colors.ts) mevcut

### Yapılandırma
- ✅ `son_kayit.md` dosyası oluşturuldu (bu dosya)
- ✅ Memory sistemi kuruldu (her işlem sonrası bu dosya güncellenecek)

## 2026-04-05 – Expo Go Açılmama Sorunu Teşhis & Düzeltme

### Tespit Edilen Sorunlar
- ❌ `newArchEnabled: true` → Expo Go desteklemiyor
- ❌ `expo-asset`, `expo-constants`, `expo-linking` yanlış versiyonlar
- ❌ Root `package.json` React 19 override'ı web ile çakışıyordu
- ❌ Mobile'da explicit React bağımlılığı yoktu

### Yapılan Değişiklikler
- ✅ `apps/mobile/app.json` → `newArchEnabled: false`
- ✅ `apps/mobile/package.json` → expo-asset ~12.0.12, expo-constants ~18.0.13, expo-linking ~8.0.11
- ✅ `apps/mobile/package.json` → react 19.1.0, react-dom 19.1.0 explicit eklendi
- ✅ Root `package.json` → overrides kaldırıldı (web React 18, mobile React 19 ayrı)
- ✅ `npm install` çalıştırıldı

### Kök Neden Tespit Edildi
- `@react-navigation/core` root `node_modules`'da → React 18 kullanıyor
- Mobile kodları React 19 kullanıyor → iki farklı instance → hook crash
- `next@14` React 18 zorunlu kılıyor, root override çalışmıyor

### Kesin Düzeltme (3. tur)
- 🔄 `apps/mobile/metro.config.js` → `resolveRequest` ile `react/react-dom/react-native` her zaman mobile'ın 19.1.0 node_modules'una yönleniyor (root'taki 18.3.1 tamamen bypass)
- ✅ `apps/mobile/package.json` → `react: 19.1.0` explicit var (local kopya mevcut)

### Son Durum
- Root'ta Next 14 hâlâ var (başka bir bağımlılık), Next 15 web/node_modules'a local kuruldu
- Mobile ve Web için React 19.1.0 local kopyaları mevcut
- Root'taki @react-navigation/core React 18 kullanıyor (sorun kaynağı)
- metro.config.js → resolveRequest ile react/* ve react-dom/* tüm importlar mobile local'e yönleniyor

### Sonuç
- ✅ Expo Go'da uygulama başarıyla çalışıyor!

---

## 2026-04-05 – SaaS Dönüşüm Planı (10 Adım) — Almanya & Avrupa Odaklı

### Temel Kararlar
- **Hedef Pazar:** Almanya (birincil), Avrupa (ikincil)
- **Dil:** Almanca (birincil), İngilizce (ikincil)
- **Para Birimi:** EUR (€)
- **Ödeme:** Stripe + EU VAT (MwSt) desteği
- **Uyumluluk:** DSGVO (GDPR) zorunlu
- **Veri Merkezi:** Supabase EU (Frankfurt/eu-central-1)
- **İş Hukuku:** Arbeitszeitgesetz (ArbZG), Mindestlohngesetz, Bundesurlaubsgesetz

### Almanya/AB Özel Gereksinimler
| Alan | Gereksinim |
|------|-----------|
| Hukuki | Impressum zorunlu, Datenschutzerklärung (DSGVO) |
| Çerez | Cookie Consent Banner (DSGVO uyumlu) |
| Veri | Veri silme hakkı (Recht auf Löschung), export hakkı |
| Ödeme | MwSt %19 (Almanya), AB ülkelerine göre değişken VAT |
| Çalışma Saati | Max 8 saat/gün, 48 saat/hafta (ArbZG) uyarıları |
| Asgari Ücret | Mindestlohn kontrolü (saatlik ücret uyarısı) |
| Tatil | Bundesurlaubsgesetz uyumlu tatil hesaplama |
| Dil | Tüm UI, email, PDF → Almanca |

### 10 Adımlık Yol Haritası

| # | Adım | Durum |
|---|------|-------|
| 1 | **Supabase Schema** – companies, subscriptions, invitations + RLS + EU veri merkezi | ⏳ Bekliyor |
| 2 | **Auth & Onboarding** – kayıt → plan seçimi → şirket kurulumu → çalışan daveti (Almanca) | ⏳ Bekliyor |
| 3 | **Middleware & Role Guard** – super_admin / company_admin / employee / individual route koruması | ⏳ Bekliyor |
| 4 | **Landing Page & Pricing** – Almanca satış sayfası, EUR fiyatlar, MwSt gösterimi | ⏳ Bekliyor |
| 5 | **Stripe + EU VAT** – checkout, webhook, MwSt otomatik hesaplama, Stripe Tax | ⏳ Bekliyor |
| 6 | **Company Admin Paneli** – çalışan yönetimi, ArbZG uyarıları, Mindestlohn kontrolü | ⏳ Bekliyor |
| 7 | **Super Admin Paneli** – tüm şirketler, kullanıcılar, gelir, AB ülke dağılımı | ⏳ Bekliyor |
| 8 | **DSGVO Uyumluluğu** – Cookie consent, veri silme, export, Impressum, Datenschutz sayfaları | ⏳ Bekliyor |
| 9 | **Email Sistemi** – Almanca şablonlar (davet, fatura, hoşgeldin) — Resend + EU sunucu | ⏳ Bekliyor |
| 10 | **Deploy** – Vercel EU region + EAS mobile build + .de veya .app domain | ⏳ Bekliyor |

### Sonraki Adım
- 🔜 Adım 3: Middleware & Role Guard

---

## 2026-04-05 – Adım 2 Tamamlandı: Auth & Onboarding Akışı

### Güncellenen Dosyalar
- ✅ `apps/web/src/app/(auth)/login/page.tsx` → giriş sonrası rol tespiti ile yönlendirme
  - super_admin → /superadmin
  - company_admin → /company/dashboard
  - employee/individual → /tracker
- ✅ `apps/web/src/app/(auth)/register/page.tsx` → kayıt sonrası /onboarding/type'a yönlendirme
- ✅ `apps/web/src/middleware.ts` → /onboarding rotaları public yapıldı

### Oluşturulan Dosyalar
- ✅ `apps/web/src/app/onboarding/layout.tsx` → ortak onboarding layout (STUNDLY brand)
- ✅ `apps/web/src/app/onboarding/type/page.tsx` → Tip seçimi (Einzelperson / Unternehmen)
- ✅ `apps/web/src/app/onboarding/setup/page.tsx`
  - Şirket için: ad, şehir, USt-IdNr., Bundesland
  - Bireysel için: Bundesland seçimi
  - Supabase'e companies tablosu yazılır, profil güncellenir, trial subscription açılır
- ✅ `apps/web/src/app/onboarding/done/page.tsx` → 14 gün trial konfirmasyonu + yönlendirme

### Onboarding Akışı
```
/register → /onboarding/type → /onboarding/setup → /onboarding/done
                                                          ↓
                                          /company/dashboard veya /tracker
```

---

## 2026-04-05 – Adım 1 Tamamlandı: Supabase SaaS Schema

### Oluşturulan Dosyalar
- ✅ `supabase/migrations/009_saas_companies.sql`
  - `companies` tablosu (name, slug, bundesland, vat_id, country_code, owner_id)
  - `subscriptions` tablosu (Stripe alanları, EUR, billing_address, MwSt)
  - `invitations` tablosu (token, 7 günlük expire, rol bazlı)
  - `audit_logs` tablosu (DSGVO — veri işleme kaydı)
  - `deletion_requests` tablosu (DSGVO — silme talepleri, 30 gün bekletme)
  - `profiles` tablosuna `role`, `plan`, `is_active`, `last_seen_at` eklendi
  - RLS politikaları: company_admin, super_admin, employee ayrımı
  - `handle_new_user()` trigger güncellendi (metadata'dan rol/company_id alır)
- ✅ `supabase/migrations/010_saas_plans_and_limits.sql`
  - `plan_features` tablosu (trial/individual/team/business — EUR fiyatlar)
  - Varsayılan plan verileri: Trial €0, Individual €9.99, Team €29.99, Business €79.99
  - `check_employee_limit()` fonksiyonu (plan limitini aşmayı önler)
  - `stripe_webhook_events` tablosu (webhook log)
- ✅ `packages/shared/src/types/index.ts` güncellendi
  - `UserRole`, `SubscriptionPlan`, `SubscriptionStatus`, `InvitationStatus` tipleri
  - `Company`, `Subscription`, `Invitation`, `PlanFeatures`, `BillingAddress` interface'leri
  - `Profile` genişletildi (role, plan, is_active, last_seen_at)
  - `SuperAdminStats` interface (MRR, ARR, churn)
  - TypeScript: sıfır hata ✅

---

## 2026-04-05 – Adım 10 Tamamlandı: Deploy Hazırlığı

### Güncellenen Dosyalar
- ✅ `apps/web/next.config.mjs` → HSTS header, Stripe webhook no-cache header eklendi
- ✅ `vercel.json` → fra1 (Frankfurt) region, buildCommand, outputDirectory ayarlandı
- ✅ `apps/web/.env.example` → tüm gerekli env değişkenleri belgelendi
- ✅ `DEPLOY.md` → Vercel + Supabase + Stripe + Resend + EAS adım adım deploy kılavuzu
- ✅ Root `package.json` → `@types/react@^19` + `@types/react-dom@^19` devDependencies eklendi

### TypeScript Hata Düzeltmeleri
- ✅ `apps/web/src/app/api/stripe/webhook/route.ts`
  - Stripe v22'de `current_period_start/end` ve `subscription` alanları type'dan kaldırılmış
  - `StripeSubRaw` ve `StripeInvoiceRaw` custom tipler oluşturuldu
  - `as unknown as StripeSubRaw` cast kullanıldı
- ✅ `apps/web/src/lib/stripe/server.ts`
  - `Stripe.Checkout.SessionCreateParams` bulunamıyor hatası
  - `Parameters<typeof stripe.checkout.sessions.create>[0]` ile çözüldü
- ✅ `apps/web/src/app/api/scan/route.ts`
  - `cookiesToSet` implicit any hatası → explicit any cast ile düzeltildi
- ✅ Root `@types/react@18` vs web `@types/react@19` çakışması
  - Root'a `@types/react@^19` devDependency olarak eklendi
  - `npm install` ile `layout.tsx` ReactNode/bigint hatası giderildi

### Final Durum
```
npx tsc --noEmit → 0 hata ✅
```

### 10 Adımın Özeti

| # | Adım | Durum |
|---|------|-------|
| 1 | Supabase Schema (companies, subscriptions, RLS, EU region) | ✅ Tamamlandı |
| 2 | Auth & Onboarding (kayıt, şirket kurulumu, trial) | ✅ Tamamlandı |
| 3 | Middleware & Role Guard (super_admin/company_admin/employee) | ✅ Tamamlandı |
| 4 | Landing Page & Pricing (Almanca, EUR, MwSt) | ✅ Tamamlandı |
| 5 | Stripe + EU VAT (checkout, webhook, SEPA, Stripe Tax) | ✅ Tamamlandı |
| 6 | Company Admin Paneli (çalışan yönetimi, ArbZG, Mindestlohn) | ✅ Tamamlandı |
| 7 | Super Admin Paneli (MRR/ARR, tüm şirketler/kullanıcılar) | ✅ Tamamlandı |
| 8 | DSGVO Uyumluluğu (Impressum, Datenschutz, export, silme) | ✅ Tamamlandı |
| 9 | Email Sistemi (Almanca şablonlar, Resend + EU sunucu) | ✅ Tamamlandı |
| 10 | Deploy Hazırlığı (Vercel fra1, EAS, TypeScript 0 hata) | ✅ Tamamlandı |

### Deploy Öncesi Checklist
- [ ] Supabase → EU region (Frankfurt/eu-central-1) seçildi mi?
- [ ] Vercel → fra1 region aktif mi?
- [ ] Stripe Webhook URL eklendi mi? (`/api/stripe/webhook`)
- [ ] Stripe Tax aktifleştirildi mi? (MwSt otomatik)
- [ ] Resend domain doğrulandı mı? (stundly.de)
- [ ] Impressum ve Datenschutz gerçek verilerle güncellendi mi?
- [ ] Super Admin rolü Supabase'den manuel atandı mı?
- [ ] `.env` dosyası Vercel'e eklendi mi?

---

## 2026-04-06 – KRİTİK DÜZELTME: Supabase Migration Eksikliği

### Tespit Edilen Sorun
- ❌ `profiles.role` kolonu Supabase'de yok → 009+010 migrasyonları hiç çalıştırılmamış
- ❌ `handle_new_user` trigger kayıt sırasında crash oluyordu → kayıt yapılamıyordu
- ❌ Tüm rol kontrolleri (superadmin, company_admin) çalışmıyordu

### Yapılan Düzeltme
- ✅ `supabase/migrations/011_fix_apply_saas_schema.sql` oluşturuldu
  - Tüm eksik tabloları oluşturur (companies, subscriptions, invitations, audit_logs vb.)
  - `profiles` tablosuna role, plan, is_active, last_seen_at, company_id kolonlarını ekler
  - `handle_new_user` trigger'ı günceller (email kolonu da eklendi)
  - Service role bypass RLS policy'leri eklendi
  - İdempotent (tekrar çalıştırılabilir) — `IF NOT EXISTS` ve `ON CONFLICT DO NOTHING`

### Uygulama Adımları (ZORUNLU)
1. Supabase Dashboard → SQL Editor → New Query
2. `011_fix_apply_saas_schema.sql` içeriğini yapıştır → Run
3. Başarı mesajı: `Migration 011 başarıyla tamamlandı!`
4. `/setup` sayfasına git → super_admin rolü al
5. Artık kayıt + admin panel çalışır

---

## 2026-04-06 – Superadmin: Hesap Oluşturma Sayfası

### Oluşturulan Dosyalar
- ✅ `app/api/superadmin/create-account/route.ts` → POST: Supabase admin API ile kullanıcı + firma oluşturur
  - Bireysel / Çalışan: sadece auth user + profile
  - Firma Admin: auth user + company + trial subscription + company_id bağlantısı
- ✅ `app/superadmin/create/page.tsx` → UI: rol seçimi (3 buton), form, anlık sonuç

### Güncellenen Dosyalar
- ✅ `superadmin/layout.tsx` → "➕ Hesap Oluştur" nav item eklendi

### Kullanım
`/superadmin/create` → Rol seç (Bireysel / Çalışan / Firma+Admin) → Bilgileri gir → Oluştur → Hemen giriş yapılabilir

---

## 2026-04-06 – Rol Bazlı Panel Ayrımı & Team Sayfası

### Yapılan Değişiklikler
- ✅ `Sidebar.tsx` → Role-aware: company_admin'e "Mein Team" linki, super_admin'e kırmızı "Admin Panel" linki + rol badge eklendi
- ✅ `(dashboard)/team/page.tsx` → Yeni: company_admin için normal dashboard içinde takım yönetimi (üye listesi, davet, aktif/pasif)
- ✅ `middleware.ts` → `/team` rotası COMPANY_ADMIN_PATHS'e eklendi (sadece company_admin/super_admin)
- ✅ `login/page.tsx` → company_admin girişi artık `/company/dashboard` yerine `/tracker`'a yönlendiriyor

### Panel Ayrımı
| Rol | Giriş Sonrası | Görünen Paneller |
|-----|--------------|-----------------|
| super_admin | /superadmin | Ayrı admin paneli, normal dashboard'dan kırmızı buton ile erişim |
| company_admin | /tracker | Normal sidebar + "Mein Team" linki (bireysel kullanıcılar görmez) |
| employee/individual | /tracker | Normal sidebar (Team gizli) |

---

## 2026-04-06 – Super Admin Kullanıcı Yönetim Paneli

### Oluşturulan Dosyalar
- ✅ `apps/web/src/app/setup/page.tsx` → İlk kurulum sayfası (super_admin rolü atama, giriş sorunu çözümü)
- ✅ `apps/web/src/app/api/setup/make-superadmin/route.ts` → Sadece super_admin yokken çalışan rol atama API'si
- ✅ `apps/web/src/app/api/superadmin/users/[id]/route.ts` → PATCH (rol değiştir, aktif/pasif) + DELETE (kullanıcı sil)
- ✅ `apps/web/src/app/superadmin/users/UsersTable.tsx` → Client component: arama, rol filtresi, rol dropdown, aktif/pasif toggle, silme modalı
- ✅ `apps/web/src/app/superadmin/users/page.tsx` → Güncellendi: özet kartlar + UsersTable entegrasyonu

### Güncellenen Dosyalar
- ✅ `apps/web/src/middleware.ts` → `/setup` rotası PUBLIC_PATHS'e eklendi

### Kullanıcı Yönetim Paneli Özellikleri
- Arama (isim veya e-posta)
- Rol filtresi (all / individual / employee / company_admin / super_admin)
- Rol değiştirme (dropdown, anlık güncelleme)
- Aktif/Pasif toggle (buton, renkli badge)
- Kullanıcı silme (onay modalı, geri alınamaz uyarısı)
- Özet kartlar (toplam, rol bazlı, aktif sayıları)
- Güvenlik: kendi rolünü/hesabını değiştiremez/silemez

### Giriş Akışı
```
/setup → "Beni Super Admin Yap" → /superadmin/users
```

---
> Bu dosya her işlem sonrası otomatik güncellenir. Eski kayıtlar hiçbir zaman silinmez.
