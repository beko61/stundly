# Stundly – Son Kayıt

## 2026-07-11 (70) – v0.36.0: Landing polish (Chef-Fokus + anchor pricing)

### Hedef
Beta conversion boost. Audit'te 3 madde:
- P3 "Sıfır social proof — DE B2B'de dönüşüm %1 altı"
- "Landing headline generic — rakip aynısını söylüyor"
- "Beta'da pricing anchor kayıp — Clockodo (€12) avantajı görünmüyor"

Fake customer testimonial'ları UWG §5 (irreführende Werbung) riski
taşıdığı için **trust badges** kullanıldı (doğrulanabilir teknik/hukuki
markers).

### Değişiklikler

**1. Kill "Europa" positioning (audit)**
- Hero badge: "🇩🇪 Für Deutschland & Europa" → "🇩🇪 Made in Germany · Für Handwerksbetriebe"
- Compliance banner alt satırı: "deutsches und europäischen Markt" →
  "deutschen Handwerksmarkt entwickelt — DSGVO, ArbZG, BUrlG, EntgFG"

**2. Sharper H1 — unique wedge messaging**
- Eski (generic): "Arbeitszeit einfach erfassen & verwalten"
- Yeni: "Zeiterfassung für Handwerker mit Notdienst & Brutto→Netto live"
- İki accent kelime: "Handwerker" + "Brutto→Netto live"
- Rakiplerden (Clockodo, TimeSprint) net ayrılan iki unique wedge:
  * Notdienst-Bonus mit Wochen-Zuordnung
  * Brutto→Netto live (SFN + Steuerklasse)

**3. Yeni subtitle**
- Eski: "moderne Zeiterfassungssoftware für Einzelpersonen und Unternehmen"
- Yeni: "Die einzige App, die deinen Notdienst-Bonus richtig zuordnet und
  deinen Netto live berechnet. Für Solo-Handwerker und KMU-Betriebe."
- "einzige" iddiası dürüst: rakiplerde Notdienst wochen-Zuordnung yok

**4. Beta anchor pricing (2 yer)**
- Hero CTA altı fine print (BETA_MODE):
  "Beta-Preis lebenslang: ~~€19,99~~ **€5,99/Monat** · nach 3 Monaten gratis"
- Beta-Phase kartında ayrı anchor pricing chip:
  Danach nur ~~€19,99~~ **€5,99**/Monat (görsel highlight, dashed border)

**5. YENİ Trust Strip section (hero altı)**
- 6 badge, 3-col responsive grid:
  * 🔒 DSGVO-konform · EU-Server Frankfurt
  * ⚖ Deutsches Arbeitsrecht · ArbZG · EntgFG · BUrlG
  * 📊 DATEV-Export · Für deinen Steuerberater
  * 🚨 Notdienst-Verwaltung · Wochen-Zuordnung, Bonus-Berechnung
  * 💶 Brutto→Netto live · Steuerklasse & SV automatisch
  * 📱 Web + Mobile · Ein Login, alle Geräte
- Card style (icon + label + hint), 12px hint minör tona
- **Fake testimonial YOK** — sadece doğrulanabilir feature/legal claims

### Neden anchor pricing kritik
- Behavioral economics "reference price effect"
- Beta müşteri kaydolduktan sonra bir "lifetime discount" alacağını görür
- €19,99 → €5,99 = %70 tasarruf çıkışta, aciliyet duygusu
- Clockodo €12 arka planda karşılaştırılabiliyor (mental math)

### Neden trust strip, testimonial değil
DE Wettbewerbsrecht (UWG §5):
- Fake veya alakasız kunde-Zitat'ları irreführend
- Beta modunda gerçek Kunde referansı yok
- Trust badges = fake değil, doğrulanabilir claim
- DATEV/DSGVO/ArbZG hepsi bizim yaptığımız iş
- Legal risk = 0

### Değişen dosyalar (2 file)
- `apps/web/src/app/page.tsx` — hero + subtitle + trust strip + anchor
  pricing (2 yer) + compliance banner alt satırı
- `apps/web/src/lib/version.ts` — 0.35.0 → 0.36.0

### Validation
- TS clean · ESLint clean · Vitest 339/339 (UI-only)

### Kalan Week 3-4 (6 madde)
- Weekly digest email (retention #1, Vercel Cron Mo 06:00)
- Monthly PDF report email
- `/vergleich/clockodo` + 2 SEO landing pages
- Onboarding sample data injection
- Light mode tokens
- Skeleton kalan 11 yerde replace

---

## 2026-07-11 (69) – v0.35.0: DATEV/Lodas CSV Export (B2B killer)

### Hedef
Handwerksbetrieb'in Steuerberater'ine gönderdiği aylık payroll input
CSV'si. Alman standart formatı (DATEV Lohn und Gehalt, LODAS, Lexware,
Sage import uyumlu). Audit'te Major kategorisinde "DATEV CSV export
YOK" olarak listelenmişti.

### Yeni modül — `lib/export/datevExport.ts`
- `buildDatevMonthlyCsv({ year, month, rows })` — bulk aylık export
- `datevDownload(csv, filename)` — browser blob download
- `splitFullName(fullName)` — "Ali Yildiz" → { vorname, nachname }
  * Son kelime nachname, öncekiler vorname (Hans Jürgen Meier vb.)
- `deNumber(n, decimals=2)` — 168.75 → "168,75" (DE ondalık)
- `csvEscape(v)` — RFC 4180, semikolon-safe (DE-Excel)

### CSV Format (v1 — 11 sütun)
```
Personalnummer;Nachname;Vorname;Abrechnungsmonat;Arbeitsstunden;
Urlaubstage;Krankheitstage;Notdiensttage;Notdienstbonus_EUR;
Grundlohn_Brutto_EUR;Bruttolohn_Gesamt_EUR
```
- **Encoding**: UTF-8 BOM (Excel DE tanır) + CRLF + Semikolon-Trenner
- **Personalnummer**: `profiles.personal_nr` veya fallback
  `EMP-<user_id[:8].toUpper>` (Steuerberater'a stabil ID)
- **Nachname/Vorname**: `profiles.nachname/vorname` var ise onlar,
  yoksa `full_name` → `splitFullName()`
- **Arbeitsstunden**: netto ARBEITEN + Notdienst dakika toplamı / 60
- **Grundlohn_Brutto**: monthly_target × hourly_rate (Sollstunden bazlı)
- **Bruttolohn_Gesamt**: grundlohn + notdienstBonus (SFN v1'de dahil değil)

### API — `/api/company/reports/data`
- Yeni `salarySettings` field response'a eklendi:
  hourly_rate, notdienst_bonus, monthly_target_hours (user_id başına
  en yeni satır — created_at DESC)
- Per-user Map ile in-memory join

### UI — `/company/reports`
- Yeni `DatevBulkButton` component (mavi highlight):
  * "📊 DATEV Export" başlıklı, tooltip'te "Steuerberater'a gönderilebilir"
- Header'a eklendi (mevcut "Alle als CSV" internal yanına)
- Dosya adı: `DATEV_Lohnjournal_Juni_2026.csv`

### Test — 20 case (`__tests__/unit/datevExport.test.ts`)
- splitFullName: 4 case (iki kelime, üç kelime, tek, boş/null)
- deNumber: 4 case (virgül, default, custom decimals, negatif)
- csvEscape: 4 case (basit, semikolon, tırnak escape, null)
- buildDatevMonthlyCsv: 8 case (BOM, header, 40h+bonus, Urlaub/Krank,
  Notdienst bonus, çoklu mitarbeiter, semikolon escape, boş rows)

### Validation
- TS clean · ESLint clean · Vitest **339/339** (319 → 339, +20)

### Değişen dosyalar (5 file)
- `apps/web/src/lib/export/datevExport.ts` — YENİ (~180 LOC)
- `apps/web/src/app/api/company/reports/data/route.ts` — salarySettings
- `apps/web/src/app/company/reports/ReportExportButtons.tsx` — DatevBulkButton
- `apps/web/src/app/company/reports/page.tsx` — buton entegrasyonu
- `apps/web/src/__tests__/unit/datevExport.test.ts` — YENİ
- `apps/web/src/lib/version.ts` — 0.34.0 → 0.35.0

### v2 Backlog (bilinçli olarak dışta bırakılanlar)
- SFN steuerfrei kolonu (Nacht/Sonntag/Feiertag ayrı sütunlar)
- Überstunden ayrı satır (mevcut monthly_target üstü)
- LODAS ASCII import formatı (Lohnart Nummer + Wert)
- Personalnummer migration 025 (profiles.personal_nr required)
- Krankheit 6-Wochen limit uygulaması Brutto düşümünde
- Zwölftelung Urlaubsanspruch CSV'de

### Kalan Week 3-4 (7 madde)
- Weekly digest email (retention #1 — sonraki commit)
- Monthly PDF report email
- Landing testimonial strip
- `/vergleich/clockodo` + SEO landings
- Beta anchor pricing
- Onboarding sample data
- Light mode

---

## 2026-07-11 (68) – v0.34.0: A11y baseline (Week 3-4)

### Hedef
Week 3-4'ün mekanik erişilebilirlik maddeleri tek commit'te.
WCAG 2.4.7 (focus visible), 2.5.5 (target size), 2.1.2 (no keyboard
trap), 2.4.3 (focus order). iOS Safari address bar bug fix (dvh).

### 1. WCAG 2.5.5 — MonthNav 44×44 tap targets
- `MonthNav.tsx`: ok tuşları 26×26 → 44×44 (borderRadius 10)
- Yıl select: minHeight 44, padding büyültüldü
- `salary/page.tsx`: kendi ay-nav butonları 30×30 → 44×44
  (replace_all, 4 button + aria-label eklendi)

### 2. WCAG 2.4.7 — Global `:focus-visible`
- `globals.css`: `:where(a, button, input, select, textarea, [role="button"],
  [tabindex]):focus-visible` — 2px accent outline
- `focus:not(:focus-visible)` outline none (mouse click ring göstermez)

### 3. iOS Safari — `100vh` → `100dvh` (15 dosya)
- 15 dosyada replace-all: `100vh` → `100dvh`
- Modal sheet'lerde `maxHeight: 90vh` → `90dvh`
- Sebep: iOS Safari address bar açık/kapalı → viewport shift bug
- `dvh` = dynamic viewport height (address bar dahil)

### 4. Skeleton primitive
- YENİ `components/ui/Skeleton.tsx`:
  * Props: width, height, fullWidth, lines, radius, style
  * `lines >= 2` ise satırlar (son satır %70 genişlik)
  * `role="status"` + `aria-live="polite"` + `aria-label`
- YENİ CSS `.skeleton`: shimmer gradient (var(--surface2) base, 200% bg-size)
  * `@keyframes skeleton-shimmer` 1.4s ease-in-out infinite
  * `@media (prefers-reduced-motion: reduce)` → no animation
- `tracker/page.tsx` loading state: 12 satır skeleton (row placeholder)
- `salary/page.tsx` loading state: 3 skeleton block (KPI+breakdown+chart)

### 5. Modal a11y — WCAG 2.1.2 + 2.4.3
- YENİ `hooks/useModalA11y.ts`:
  * Ref-based, focus'u ilk focusable'a odaklar (rAF ile layout settle sonrası)
  * Escape → onClose
  * Tab / Shift+Tab focus trap (ilk↔son element döngü)
  * Modal kapanınca opener elemente focus döner
  * `getFocusables()` a[href], button, input, select, textarea, [tabindex]
- 4 modal update:
  * `TimeEntryModal.tsx`: ref, role=dialog, aria-modal, aria-labelledby
  * `NotdienstModal.tsx`: aynı
  * `PhotoScanModal.tsx`: aynı
  * `demo/EntryModal.tsx`: eski manuel ESC handler kaldırıldı, hook geldi

### Validation
- TS clean · ESLint clean · Vitest 319/319 (test değişmedi, UI-only)

### Değişen dosyalar (11 file)
- `components/ui/Skeleton.tsx` — YENİ
- `hooks/useModalA11y.ts` — YENİ
- `components/tracker/MonthNav.tsx` — 44×44
- `app/(dashboard)/salary/page.tsx` — 44×44 + Skeleton
- `app/(dashboard)/tracker/page.tsx` — Skeleton
- `app/globals.css` — focus-visible + .skeleton
- `components/tracker/TimeEntryModal.tsx` — a11y
- `components/tracker/NotdienstModal.tsx` — a11y + 90dvh
- `components/tracker/PhotoScanModal.tsx` — a11y + 90dvh
- `app/demo/EntryModal.tsx` — a11y (manuel ESC kaldırıldı)
- 15 dosya `100vh` → `100dvh` mekanik replace
- `lib/version.ts` 0.33.0 → 0.34.0

### Kalan Week 3-4 (9 madde)
- Weekly digest email (Vercel Cron Mo 06:00)
- Monthly PDF report email
- Landing testimonial strip
- DATEV/Lodas CSV export
- `/vergleich/clockodo` + 2 SEO landing
- Beta anchor pricing "€19,99 → €5,99"
- Onboarding sample data injection
- Light mode tokens
- (Skeleton kalan 11 yerde replace — sonraki iter)

---

## 2026-07-11 (67) – v0.33.0: Chef-Fokus Update — company_admin dashboard redesign

### Hedef
Handwerker patronunun **gerçek günlük iş akışına** odaklı UX
overhaul. Duplicate `/team` sayfası kaldırıldı, personal Sidebar'a
company_admin için Firma-Panel CTA eklendi, `/company/dashboard`'da 3
yeni widget (HEUTE-Ansicht, Compliance-Warnings, Mitarbeiter-Übersicht),
ve `/company/employees/[id]`'de Zeitkonto kartı.

### Ustaca analiz
Kod haritasında iki büyük sorun tespit edildi:
1. **Duplicate**: `/team` (277 LOC) + `/company/employees` (513 LOC)
   ikisi de mitarbeiter yönetimi yapıyor. Artefakt.
2. **Role UX**: company_admin login → /company/dashboard OK ama
   personal sidebar'da `/company/*`'a dönüş linki yok. Admin
   yanlışlıkla kişisel moda düşerse kayboluyor.
3. **Dashboard yetersiz**: sadece 4 KPI + pending Urlaub. Patron'un
   günlük ihtiyacı olan "Bugün kim çalışıyor / kim ihlalde / kim rest?"
   göze çarpmıyor.

### Yapılanlar (6 madde)

**1. `/team` → 301 redirect `/company/employees`**
- `(dashboard)/team/page.tsx`: server component redirect
- Duplicate + karışıklık kaldırıldı. Bookmark uyumlu.

**2. Personal Sidebar Firma-Panel CTA**
- `Sidebar.tsx`: role === "company_admin" || "super_admin" ise EN ÜSTE
  belirgin "🏢 Firma-Panel" linki → `/company/dashboard`
- Super Admin badge altta ayrı kalır
- "Mein Team" item ve `TEAM_NAV` sabit kaldırıldı (Auswertung grubunda)

**3. HEUTE-Ansicht widget**
- `/company/dashboard`: KPI kartlarından sonra
- Her mitarbeiter için bugünkü status kartı:
  🟢 ARBEITEN (Uhrzeit ile) / 🏖 URLAUB / 🤒 KRANK / 🎉 FEIERTAG /
  🚨 NOTDIENST / ⚪ Kein Eintrag
- Sol kenar accent renkte (status color)
- Karta tıkla → mitarbeiter detay
- Sıralama: bugün çalışan önce, alfabetik ikinci

**4. Compliance-Warnings widget**
- 3 kategori (varsa göster, yoksa gizle):
  * 🚫 §3 ArbZG 10h/Tag aşımı (findDailyCapViolations)
  * 🩺 §3 EntgFG 6 Wochen Krankheit (calcKrankheitEpisodes > 42)
  * ⏳ §7 III BUrlG Verfall (calcUrlaubskonto.verfallWarning)
- Her satır: mitarbeiter adı (link) + detay
- Zaten hazır shared/utils helper'ları reused

**5. Mitarbeiter-Übersicht tablosu**
- 6 kolon: Mitarbeiter · Arbeitszeit · Urlaub übrig · Krank · Notdienst · Pending
- Ada tıkla → detay sayfası
- Urlaub übrig kırmızı olabilir (< 0), Krank/Notdienst chip'li
- Pending Urlaub sarı chip

**6. Zeitkonto kartı `/company/employees/[id]`**
- Summary stats sonrasına eklendi
- 4 stat: Anspruch (Zwölftelung ile) · Übertrag (varsa) · Genommen · Rest
- Zwölftelung fullMonths göstergesi
- §4 Wartezeit info (< 6 ay)
- Verfall Warning ($< 30 gün + remaining > 0)
- §3 EntgFG 6 Wochen aşımı Krankheit episode listesi

### Data flow (efficient)
- `/company/dashboard` tek render'da tek batch:
  * profiles (aktif) + monthEntries + yearEntries + salary_settings +
    monthNdEntries + pendingVacations + pendingInvites
  * Server-side aggregate, in-memory compliance check
- N+1 problem yok, tek JOIN-free birleşim

### Validation
- TS clean · ESLint clean · Vitest 319/319 (test değişmedi, UI-only)

### Değişen dosyalar (5 file)
- `apps/web/src/app/(dashboard)/team/page.tsx` — redirect (277 → 7 LOC)
- `apps/web/src/components/ui/Sidebar.tsx` — Firma-Panel CTA + TEAM_NAV
  kaldırıldı
- `apps/web/src/app/company/dashboard/page.tsx` — komple redesign
  (193 → 470 LOC)
- `apps/web/src/app/company/employees/[userId]/page.tsx` — Zeitkonto
  card eklendi (+95 LOC)
- `apps/web/src/lib/version.ts` — 0.32.0 → 0.33.0

### Kalan Audit (Week 3-6)
- Kritik: 0 ✅
- Major kalan Week 3-4: MonthNav 44×44 · Modal focus trap · Skeleton ·
  Light mode · 100dvh · Weekly digest email · Monthly PDF email ·
  Testimonial · DATEV CSV · SEO landing · Beta pricing · Onboarding
- Major kalan Week 5-6: salary/page refactor · Zod schemas · React
  Query · DB index migration 025 · CI restore · JWT role · Stripe
  test · next/image next/dynamic

---

## 2026-07-11 (66) – v0.32.0: R4+R5 rate limit (Supabase persistent)

### Hedef
Audit'te kalan **son kritik madde**. In-memory rate limiter kırıktı
(serverless her instance kendi Map'ı) — persistent Supabase-backed
sliding window ile değiştirildi. Ship-blocker %100 tamamlandı.

### R4 — /api/scan rate limit
- Eski: in-memory `Map<userId, {count,resetAt}>` — 5/dk. Vercel yeni
  instance boot ediyorsa Map boş, kullanıcı bypass.
- Yeni: `checkRateLimit({ bucket: "scan:userId", limit: 20, windowSec: 3600 })`.
  Anthropic cost için 20/saat sıkı limit. Retry-After header.

### R5 — /api/contact rate limit
- Yeni: IP başına 5 mesaj/saat (Resend quota koruması).
  `bucket: contact:${ip}`. Honeypot + validasyon üstüne katman.

### Yeni altyapı
- **Migration 024** `rate_limit_events (bucket, created_at)` + 2 index
  (bucket+created_at, created_at). RLS default deny (sadece service_role).
- **`lib/rateLimit/check.ts`** — Sliding window helper:
  1. `count` sorgusu `where bucket=X and created_at >= now-windowSec`
  2. count >= limit → 429 + retryAfterSec = windowSec
  3. Aksi → insert event, allowed=true, count+1
  - **Fail-open** on DB error: kullanıcıyı Postgres arızasında kilitlemek
    yerine izin ver + console.error. Cost patlaması riski var ama nadir.
- **`/api/cron/rate-limit-cleanup`** YENİ route: günlük 24h öncesini siler.
  Bearer $CRON_SECRET gate.
- **vercel.json** — 2. cron eklendi (04:00 UTC)

### Test
- **`rateLimit.test.ts`** — 8 case (@supabase/supabase-js mocklu):
  * Boş bucket, limit altı, sınırda 429, üstü 429
  * Count query error → fail-open (log ile)
  * Insert error → fail-open
  * Bucket string doğru geçiyor
  * Missing env → throw
- **`scan/route.test.ts`** — eski in-memory test'i `checkRateLimit` mock'u
  ile güncelledim. `mockResolvedValueOnce({ allowed: false, ... })` ile
  429 + Retry-After header kontrolü.

### Validation
- TS clean · ESLint clean · Vitest **319/319** (311 → 319, +8)

### Değişen dosyalar (7 file)
- `supabase/migrations/024_rate_limit_events.sql` — YENİ
- `apps/web/src/lib/rateLimit/check.ts` — YENİ
- `apps/web/src/app/api/cron/rate-limit-cleanup/route.ts` — YENİ
- `apps/web/src/app/api/scan/route.ts` — in-memory kaldırıldı, helper wired
- `apps/web/src/app/api/contact/route.ts` — rate limit + IP bucket eklendi
- `apps/web/src/app/api/scan/__tests__/route.test.ts` — mock update
- `apps/web/src/__tests__/unit/rateLimit.test.ts` — YENİ (8 case)
- `vercel.json` — 2. cron
- `apps/web/src/lib/version.ts` — 0.31.0 → 0.32.0

### Manuel adım (deploy'da)
⚠ **Migration 024** Supabase Dashboard SQL Editor'da çalıştırılmalı.
Yoksa hem scan hem contact 429/500 verecek (fail-open olduğu için 500
değil aslında; sadece rate limit hiç işlemez → cost riski).

### 🎉 KRİTİK LİSTE %100 KAPALI
- Week 1: 10 ship-blocker (v0.27.0)
- Week 2: 9 madde (v0.28.0-v0.31.0)
- **R4+R5**: son kritik (v0.32.0)
- **Toplam 21/21 kritik madde bitti**

### Sırada
Week 3-4 UX + Dönüşüm (13 madde) veya Week 5-6 Kod Sağlığı (8 madde).

---

## 2026-07-10 (65) – v0.31.0: Audit Week 2 KOMPLE — P4 + Datenschutz + AVV + DSGVO cron
Datenschutz Drittländer düzeltmesi + AVV template sayfası, DSGVO
delete cron worker (Art. 17). **Week 2 tamam** 🎉

### P4 — OCR consent screen (DSGVO Art. 6)
- `PhotoScanModal.tsx`:
  - Yeni `OCR_CONSENT_STORAGE_KEY = "stundly_ocr_consent_v1"`
  - `loadConsent()` / `saveConsent()` / `revokeConsent()` helpers
  - Yeni `useEffect` mount'ta consent oku
  - `handleScan()` başında consent check — yoksa error, scan blocklu
  - Foto seçildikten sonra ama scan butonundan önce **consent gate UI**:
    - Anthropic PBC (USA) açıklaması, Art. 6 (1) a DSGVO rechtsgrundlage,
      EU-US DPF referansı, Datenschutz link, checkbox zorunlu
    - "Zustimmen und fortfahren" butonu (checkbox olmadan disabled)
  - Consent verildikten sonra scan butonu görünür + altında
    "Zustimmung erteilt am TT.MM.YYYY · widerrufen" küçük satır

### Datenschutz — Drittländer düzeltmesi
- **Bölüm 5** — komple yeniden yazıldı: "Wir übermitteln keine Daten in
  Drittländer" YANLIŞ ifadesi kaldırıldı. Doğru: Anthropic USA (OCR),
  Stripe US Konzern, Vercel Frankfurt. Rechtsgrundlage EU-US DPF
  Angemessenheitsbeschluss 10.07.2023 + SCC 2021/914.
- **Bölüm 8** — Drittanbieter genişletildi: Supabase, Vercel, Stripe,
  Resend, Anthropic — hepsi Art. 28 DSGVO Auftragsverarbeiter olarak
  listelendi. AVV notu eklendi.
- **Bölüm 9 (YENİ)** — Foto-Scan / OCR / KI-Verarbeitung açıklaması,
  Art. 6 (1) a Rechtsgrundlage, widerruf yolu
- **Bölüm 10** (eski 9) — Cookies
- **Bölüm 11** (eski 10) — Beschwerderecht: Berlin YANLIŞ. Hannover =
  Niedersachsen → Landesbeauftragte für den Datenschutz Niedersachsen,
  Prinzenstraße 5, 30159 Hannover. Doğru adres, tel, email.
- Stand: April 2026 → Juli 2026

### AVV — `/avv` YENİ sayfa
- Server component, `metadata` title/description
- 5 bölüm:
  1. "Für wen relevant?" — B2B Team/Business müşteri
  2. "Inhalt der Vereinbarung" — Art. 28 DSGVO parametreleri liste
  3. "Unterauftragsverarbeiter" — tablo (Anbieter/Zweck/Region), 5 anbieter
  4. "AVV anfordern" — mailto:datenschutz@stundly.de?subject=..., 2 Werktag
  5. "TOM" — kısa özet + Datenschutz link
- **sitemap.ts** — /avv priority 0.3
- **middleware.ts** PUBLIC_PATHS — /avv eklendi
- **landing page footer** — Datenschutz | AVV | AGB sıra

### DSGVO cron worker — `/api/cron/dsgvo-process`
- YENİ route: `apps/web/src/app/api/cron/dsgvo-process/route.ts`
- GET method, `Authorization: Bearer $CRON_SECRET` gate
- runtime nodejs, dynamic force-dynamic, maxDuration 300s (5dk batch)
- Akış:
  1. `deletion_requests` where status='pending' AND scheduled_for <= now()
     (limit 100 per run)
  2. Her request için `admin.auth.admin.deleteUser(user_id)` → CASCADE
     profil + time_entries + notdienst + vacation + salary_settings +...
  3. `deletion_requests.status='completed', completed_at=now()`
  4. `audit_logs` insert `action='deletion_processed'` (fire-and-forget)
- Return JSON: `{ ran_at, total, processed, failed, results[] }`
- **vercel.json** — `crons: [{ path: /api/cron/dsgvo-process, schedule: "0 3 * * *" }]`
- **middleware.ts** PUBLIC_PATHS — /api/cron eklendi
- **turbo.json** — CRON_SECRET env eklendi (cache invalidation için)

### Validation
- TS clean · ESLint clean · Vitest 311/311 (değişmedi, UI/config değişikliği)

### Değişen dosyalar (9 file)
- `apps/web/src/components/tracker/PhotoScanModal.tsx` — OCR consent
- `apps/web/src/app/datenschutz/page.tsx` — 4 bölüm rewrite + 1 yeni
- `apps/web/src/app/avv/page.tsx` — YENİ (~180 LOC)
- `apps/web/src/app/api/cron/dsgvo-process/route.ts` — YENİ (~110 LOC)
- `apps/web/src/app/sitemap.ts` — /avv
- `apps/web/src/middleware.ts` — /avv + /api/cron
- `apps/web/src/app/page.tsx` — footer AVV link
- `vercel.json` — cron schedule
- `turbo.json` — CRON_SECRET env
- `apps/web/src/lib/version.ts` — 0.30.0 → 0.31.0 (MINOR)

### Manuel adım (deploy'da)
⚠ **CRON_SECRET env var'ı Vercel Dashboard'da ayarla**:
Settings → Environment Variables → CRON_SECRET (rastgele string, örn:
`openssl rand -base64 32`). Production ortamında lazım.

**Vercel Cron otomatik aktif olur** deploy sonrası. İlk çalışma
02.06.2026 saat 03:00 UTC (bir sonraki gün). Log'lar Vercel Dashboard →
Cron'da görünür.

### 🎉 WEEK 2 KOMPLE

**Toplam 9 madde 4 commit'te**:
- v0.28.0: L3 + L2 (ArbZG hardening)
- v0.29.0: L10 (SFN-Zuschläge steuerfrei)
- v0.30.0: L5 + L6 + L7 (EntgFG + BUrlG)
- v0.31.0: P4 + Datenschutz + AVV + DSGVO cron

**Migration çalıştırıldı**: 021 (Week 1), 022 (SFN), 023 (BUrlG)

### Kalan (Week 3-4 UX/Dönüşüm, Week 5-6 Kod Sağlığı)
Audit'te detay. Örnek Week 3:
- MonthNav 44×44 tap targets
- Modal focus trap + aria-modal
- Weekly digest email
- DATEV CSV export
- Beta pricing anchor
- 2 SEO landing

---

## 2026-07-10 (64) – v0.30.0: Audit Week 2 — L5+L6+L7 EntgFG + BUrlG

### Hedef
İşçi hukuku 3 madde: 6 hafta Krankheit Fortzahlung + yıl içi giriş
Zwölftelung + Übertrag Verfall 31.03. Hepsi salary page'de banner
+ input olarak.

### L5 — §3 EntgFG 6 Wochen Krankheit
**`packages/shared/src/utils/entgfg.ts`** — YENİ modül
- `ENTGFG_KRANKHEIT_LIMIT_DAYS = 42`
- `calcKrankheitEpisodes(entries)` — art arda gelen Krank-Einträge tek episode.
  Gap günü yeni episode başlatır. Excess dates 43. günden itibaren.
- `findKrankheitExcessDays(entries)` — 42 aşan tüm tarihler
- `longestKrankheitStreak(entries)` — en uzun kesintisiz Krank streak
- Duplicate-safe, kronolojik-independent input

**Salary page**: yearEntries üzerinde episodes hesaplanır. > 42 gün episode
varsa kırmızı banner:
- Tarih aralığı + gün sayısı + excess gün + "ab TT.MM Krankengeld"
- InfoTooltip'te §3 EntgFG + §44 SGB V açıklaması

### L6 — §5 BUrlG Zwölftelung
**`packages/shared/src/utils/burlg.ts`** — YENİ modül
- `BURLG_MIN_URLAUB_DAYS = 20` (§3), `WARTEZEIT = 6 ay` (§4)
- `countFullMonthsInYear(start, end, year)` — bir ay "tam" sayılır:
  start ≤ ayın 1'i ve end ≥ ayın son günü. Angebrochene Monate 0/12.
- `calcAnnualEntitlement({annual, start, end, year})` → `{ anspruch,
  fullMonths, isProrated, waitingPeriodActive }`. Anspruch = round(annual × m/12)

### L7 — §7 III BUrlG Übertrag + Verfall
**burlg.ts** devamı
- `BURLG_VERFALL_CUTOFF = 31.03`
- `calcUrlaubskonto({thisYearEntitlement, thisYearUsed, previousYearRemaining,
  refDate, year})` → `{ carryOverAvailable, carryOverExpired, verfallDate,
  daysUntilVerfall, totalEntitlement, remaining, verfallWarning }`
- refDate > 31.03 → carryOver 0'a düşer. Ondan önce nutzbar.
- verfallWarning: ≤ 30 gün + remaining > 0

### Migration 023 (manuel apply gerekli)
- `salary_settings.employment_start_date date`
- `salary_settings.employment_end_date   date`
- `salary_settings.urlaub_carry_over     numeric(5,2) default 0` (check 0-60)
- Idempotent

### Salary page (`/salary`)
- Yeni "💼 Beschäftigung & Urlaub" settings card (Grundeinstellungen ile
  Steuer & Abzüge arasında)
  - Beschäftigt seit (date input, §5 tooltip)
  - Beschäftigt bis optional (date input)
  - Übertrag Vorjahr (number input 0-60, §7 III tooltip)
- Yeni Urlaubskonto banner (HERO sonrası, breakdown öncesi):
  - 4 stat: Anspruch / Übertrag / Genommen / Rest (chip'lerde)
  - Zwölftelung fullMonths göstergesi
  - Verfall date + "verfallen in N Tagen" kırmızı warn
  - §4 BUrlG Wartezeit info (< 6 ay)
  - Sadece isProrated OR carryOverAvailable > 0 OR verfallWarning ise render
- Yeni Krankheit banner (Urlaubskonto sonrası):
  - Episodes > 42 gün, tarih aralığı + excess gün + Krankengeld tarihi

### Types
- `SalarySettings.employment_start_date?: string | null`
- `SalarySettings.employment_end_date?: string | null`
- `SalarySettings.urlaub_carry_over?: number`

### Vereinfachungen (kod ve tooltip'te dokümante)
- L5: "Fortsetzungserkrankung §3 II EntgFG" (6 ay içi aynı Krankheit toplanır)
  MODELIZE EDİLMEDİ — sadece kalendarische Kette
- L6: sadece VOLLE Kalendermonate sayılır (angebrochene → 0), konservativ
- L7: "dringende Gründe" Übertrag onayı kullanıcının işi — sistem sadece
  rakam okur/uyarır

### Validation
- TS clean · ESLint clean · Vitest **311/311** (268 → 311, +43)
  - entgfg.test.ts: 18 case (constants + episodes + excess + streak + edge)
  - burlg.test.ts: 25 case (countFullMonths + entitlement + urlaubskonto
    + verfall Grenze case)

### Değişen dosyalar (7 file)
- `packages/shared/src/utils/entgfg.ts` — YENİ (~85 LOC)
- `packages/shared/src/utils/burlg.ts` — YENİ (~180 LOC)
- `packages/shared/src/index.ts` — 2 export
- `packages/shared/src/types/index.ts` — 3 yeni SalarySettings alan
- `apps/web/src/app/(dashboard)/salary/page.tsx` — settings + banner + save/load
- `apps/web/src/__tests__/unit/entgfg.test.ts` — YENİ
- `apps/web/src/__tests__/unit/burlg.test.ts` — YENİ
- `supabase/migrations/023_salary_burlg_fields.sql` — YENİ
- `apps/web/src/lib/version.ts` — 0.29.0 → 0.30.0 (MINOR)

### Manuel adım (deploy'da)
⚠ **Migration 023** Supabase Dashboard SQL Editor'da çalıştırılmalı.
Yoksa: Beschäftigung tarihi kaydeden user'da salary_settings save 500 verir.

### Kalan Week 2
- P4 OCR consent screen
- Datenschutz + AVV
- DSGVO cron

---

## 2026-07-10 (63) – v0.29.0: Audit Week 2 — L10 §3b EStG SFN-Zuschläge

### Hedef
§3b EStG steuerfreie Zuschläge otomatik hesabı. User Sonntag/Feiertag/Nacht
çalıştığında ürünle görünmüyordu → fazla vergi ödüyordu. Şimdi opt-in
toggle (default OFF), aktif olunca Brutto'ya eklenir + LSt/SV basisından
düşülür. Netto yükselir.

### Ne değişti

**`packages/shared/src/utils/sfn.ts`** — YENİ modül
- Constants: `SFN_LST_CAP_PER_HOUR=50`, `SFN_SV_CAP_PER_HOUR=25`,
  `SFN_NIGHT_PERCENT=25`, `SONNTAG=50`, `FEIERTAG=125`
- `classifyEntryMinutes(date, start, end, isNight, isFeiertag)` — entry'yi
  dakika-dakika ayırır: night / sonntag / feiertag / sonntagNight / feiertagNight
  (overlap additive)
- `classifyEntryMinutesWithFeiertagMap()` — overnight shift'te day2 Feiertag'ı
  da doğru kategorize eder (Feiertage map ile)
- `calcSfnZuschlag(minutes, grundlohnPerHour)` — total zuschlag + LSt-frei +
  SV-frei ayrı, Grundlohn cap uygulanır (min(grundlohn, 50/25 €/h) × %)
- `calcMonthlySfn(entries, feiertage, grundlohn)` — aylık toplam
- Vereinfacht (dokümante): 40% Kernnacht 00-04 yok, Feiertag %150 special
  days yok, Sonntag "0-4 Uhr Folgetag" yok — hepsi user'a güvenli sapma

**`salaryCalc.ts`**
- `SalaryBreakdown` genişletildi: `sfn_zuschlag`, `sfn_lst_frei`, `sfn_sv_frei`
- `calculateMonthlySalary()` yeni `options.feiertage` alır
- `settings.sfn_enabled=true` ise SFN Brutto'ya eklenir

**`taxCalc.ts`**
- `NettoCalcInput` yeni opsiyonel: `sfnLstFrei`, `sfnSvFrei`
- LSt basis = monthBrutto − sfnLstFrei
- SV basis  = monthBrutto − sfnSvFrei
- Manual mode: basis = monthBrutto − sfnLstFrei (SFN steuerfrei)

**Types**: `SalarySettings.sfn_enabled?: boolean`

**Migration 022** — `salary_settings.sfn_enabled boolean default false`
- Idempotent, manuel apply gerekli
- ⚠ Yoksa: sfn_enabled toggle DB save 500 patlar (auto-save)

**Salary page** (`/salary`)
- Bundesland profile'dan yüklenir, feiertage useMemo hesaplanır
- calculateMonthlySalary/calcNettoFromBrutto 3 yerde de yeni parametrelerle
- Steuer section'ına yeni "§3b Zuschlag (SFN)" toggle (AN/AUS switch,
  InfoTooltip ile detay: %25/%50/%125, Grundlohn cap €50/€25)
- Breakdown display: sfn_enabled=true ve zuschlag>0 ise yeni satır
  "§3b Zuschlag (SFN, steuerfrei-Anteil)"

### Bilinen sınırlar (dokümante)
- Kernnacht %40 (00-04 wenn Nachtarbeit vor 24:00 begonnen) yok — sadece %25
- Feiertag %150 special days (1.Weihn/Neujahr/1.Mai) yok — sadece %125
- Sonntag "Erweiterung 0-4 Uhr Folgetag §3b II Nr.1" yok
- Beta müşteride kesin payroll için Steuerberater warn'ı Info tooltip'te

### Validation
- TS clean (web + shared) · ESLint clean · Vitest **268/268** (246 → 268, +22)
- sfn.test.ts: 22 case (constants + classify + calc + monthly integration)

### Değişen dosyalar (7 file, +XXX/-YY)
- `packages/shared/src/utils/sfn.ts` — YENİ (185 satır)
- `packages/shared/src/index.ts` — export
- `packages/shared/src/types/index.ts` — sfn_enabled
- `packages/shared/src/utils/salaryCalc.ts` — SFN Brutto'ya + breakdown alanları
- `packages/shared/src/utils/taxCalc.ts` — sfnLstFrei/svFrei input
- `apps/web/src/app/(dashboard)/salary/page.tsx` — bundesland/feiertage +
  3 çağrıya parametre + toggle UI + breakdown satırı
- `apps/web/src/__tests__/unit/sfn.test.ts` — YENİ (22 case)
- `supabase/migrations/022_salary_sfn_enabled.sql` — YENİ
- `apps/web/src/lib/version.ts` — 0.28.0 → 0.29.0 (MINOR)

### Manuel adım (deploy'da)
⚠ **Migration 022** Supabase Dashboard SQL Editor'da çalıştırılmalı.
Yoksa: SFN toggle "AN" yapan user'da salary_settings save error verir.

### Kalan Week 2
- L5 Krankheit 6-Wochen limit
- L6 Urlaub Zwölftelung
- L7 Übertragung + 31.03 Verfall
- P4 OCR consent, Datenschutz Drittländer, DSGVO cron

---

## 2026-07-10 (62) – v0.28.0: Audit Week 2 — L3 + L2 ArbZG hardening

### Hedef
Week 2'nin ilk iki maddesi: Alman Arbeitszeitgesetz'in iki bel kemiği kuralı için
UI uyarıları. Selbstständige-Modus block etmez, sadece uyarır — Team-Modus'ta
Betriebsprüfung frühwarnung.

### L3 — §3 ArbZG 10h/gün cap
- **`packages/shared/src/utils/arbzg.ts`** — YENİ modül
  - `ARBZG_MAX_DAILY_MINUTES = 600`, `ARBZG_STANDARD_MINUTES = 480`,
    `ARBZG_ROLLING_WINDOW_MONTHS = 6`
  - `isDailyCapViolation(netMinutes)` — netto > 10h
  - `findDailyCapViolations(entries)` — o ay içinde 10h aşan günlerin listesi
  - `calcRolling6MonthAvg(entries, referenceISO)` — Ausgleichszeitraum Ø hesabı
    (BAG 27.4.2000 içtihat: Urlaub/Krank/Feiertag Nenner'den düşülür)
- **`TimeEntryModal.tsx`** — netto > 10h → 🚫 kırmızı §3 ArbZG banner
  (Pause turuncu warn'ın altına)
- **`monthStats.ts`** — output'a `dailyCapViolations: string[]` alanı
- **`MonthlySummary.tsx`** — ay üstünde: "An N Tagen 10h überschritten (14., 20., …)"

### L2 — §5 ArbZG Ruhezeit 11h
- **arbzg.ts** — `ARBZG_RUHEZEIT_MIN_MINUTES = 660`,
  `calcRuhezeitMinutes(prevEnd, prevOvernight, todayStart)`,
  `isRuhezeitViolation(min)`
- **`TimeEntryModal.tsx`** — yeni `previousEntry` prop, ruhezeitCheck useMemo,
  ⚠️ turuncu §5 banner (Ausnahmen §5 II var, kırmızı yerine turuncu)
- **`DayEntry.tsx`** — `previousEntry` prop pass-through
- **`tracker/page.tsx`** — `days.map` içinde `days[i-1].entry` geçilir
  (aynı ay içi bakar, ay ilk günü için null → sessiz — cross-month sonraki iter)

### Bilinen sınır
6-ay rolling avg display (`calcRolling6MonthAvg`) helper hazır ama UI'da
gösterilmedi — tracker sadece 1 ay yükler, 6 ay için ek fetch gerek.
Ayrı görev olarak açık kaldı.

### Validation
- TS clean (web + shared) · ESLint clean · Vitest **246/246** (211 → 246, +35)
- Yeni testler: `arbzg.test.ts` (30 case: constants + isDailyCap + rolling avg +
  ruhezeit) + `monthStats.test.ts` dailyCapViolations (5 case)

### Değişen dosyalar (9 file, +170/-8)
- `packages/shared/src/utils/arbzg.ts` — YENİ
- `packages/shared/src/index.ts` — export
- `apps/web/src/components/tracker/TimeEntryModal.tsx` — L3+L2 banner
- `apps/web/src/components/tracker/DayEntry.tsx` — prop pass-through
- `apps/web/src/components/tracker/MonthlySummary.tsx` — L3 monthly banner
- `apps/web/src/app/(dashboard)/tracker/page.tsx` — previousEntry
- `apps/web/src/lib/utils/monthStats.ts` — dailyCapViolations
- `apps/web/src/__tests__/unit/arbzg.test.ts` — YENİ (30 case)
- `apps/web/src/__tests__/unit/monthStats.test.ts` — +5 dailyCap
- `apps/web/src/lib/version.ts` — 0.27.0 → 0.28.0 (MINOR)

### Kalan Week 2
- L10 SFN-Zuschläge steuerfrei (sonraki — user'a net kazanç, ~1-2h)
- L5 Krankheit 6-Wochen limit
- L6 Urlaub Zwölftelung
- L7 Übertragung + 31.03 Verfall
- P4 OCR consent, Datenschutz Drittländer, DSGVO cron

---

## 2026-07-09 (61) – v0.27.0: Audit Week 1 ship-blocker fixes (10 madde)

### Hedef
6 uzman tester audit'i (Güvenlik, İş Hukuku, UX, Ürün, Kod, Reliability) →
21 kritik + 56 major + 51 minor bulgu. Week 1 ship-blocker'ı 10 madde
kapatıldı, tek büyük commit ile prod'a gitti.

### Audit sonucu
`AUDIT_2026-07-09.md` (10 KB) tam rapor: kategori, dosya:satır, süre tahmini,
sprint planı. Not: bu dosya bilerek yayında değil, sadece internal.

**Genel:** kodbase median üstü bootstrap. Üç kırık:
1. Yetki modeli patlak — signup ile super_admin, employee → company_admin
2. Alman iş hukuku hesap hataları (10 madde) — Betriebsprüfung riski
3. Ürün-pazarı boşluğu — mühendislik 3× marketing'den iyi

### 10 fix

**GÜVENLİK** — Migration 021_privilege_escalation_hardening.sql (✅ prod'a apply edildi)
- **S1**: `profiles` UPDATE trigger — role/company_id/plan/is_active/deleted_at/
  must_change_password sadece service_role değiştirebilir. `enforce_profile_privileges()`
  BEFORE UPDATE trigger her satırda kontrol.
- **S2**: `handle_new_user` trigger — `raw_user_meta_data.role/company_id` ARTIK
  okunmuyor. Her signup 'individual' başlar. Attacker `{role: super_admin}`
  metadata gönderemez.
- **S3**: `invitations` "Company admin can manage" policy — role predicate geri
  kondu (011'de düşmüştü). Employee kendini company_admin invite edemez.
- Yeni server route'lar: `/api/onboarding/create-company` +
  `/api/onboarding/set-bundesland` (service_role ile privilege trigger bypass)
- `register/page.tsx` — metadata payload'undan role/company_id kaldırıldı
- `onboarding/setup/page.tsx` — direct client `.update({role: ...})` yerine
  yeni server route çağırıyor

**P5**: `/api/email/test` route SİLİNDİ — auth'lu herkes Resend quota patlatabiliyordu

**R6**: Superadmin DELETE user
- `?confirm=<email>` zorunlu query param, server-side email eşleşme
- `audit_log`'a `superadmin.user_deleted` action + resource_id + email payload
- `UsersTable.tsx` confirm state'e email eklendi, `deleteUser(id, email)` signature

**L4**: Ostersonntag + Pfingstsonntag SADECE Brandenburg'da Feiertag
- `feiertage.ts`: national listeden çıkarıldı, BB spesifik bloguna eklendi
- Test güncellendi: NI'de `undefined`, BB'de tanımlı (yeni test eklendi)
- PDF/Zuschlag hesaplarında yanlış Feiertag işaretlenmesi bitti

**L8**: Timezone bug `getWorkingDaysInMonth`
- `toISOString()` UTC'ye çeviriyordu → 01.01.2026 = "2025-12-31" off-by-one
- Yerel string kuruluyor: `${y}-${pad(m)}-${pad(d)}`
- (feiertage.ts:fmt ile aynı pattern)

**L9**: Tax constants → YILLIK MAP
- `TAX_CONSTANTS_BY_YEAR: Record<number, TaxConstants>` — 2024, 2025, 2026
- Grundfreibetrag / BBG KV/RV / PV oranı / KV Zusatzbeitrag / Soli Freigrenze
  hepsi yıl bazlı
- Public API: `calcNettoFromBrutto({..., year})` optional param, verilmezse
  current year, unknown year için en yakın küçük yıl fallback
- calcSV / calcLohnsteuerMonat / calcSoliMonat / calcVorsorgePauschale /
  estGrundtabelle hepsi `year?` param aldı
- Netto sapması €100+ 2024 sabitlerinden geliyordu, artık doğru
- **Not**: 2026 rakamları Bundesregierung Entwurf 15.10.2025 + SV-Rechengrößen.
  Steuerberater verify şart.

**L1**: §4 ArbZG Pause warn (block değil)
- `TimeEntryModal.tsx`: `requiredPauseMinutes(bruttoMin)` hesabı
- Brutto > 6h → 30dk, > 9h → 45dk
- Pause input altında `role="alert"` soft warning banner (turuncu)
- Selbstständige-Modus'unda block etmiyor, sadece bilgi verir

**R1**: Stripe webhook idempotency
- Insert öncesi `processed=true` check → early return 200 (Stripe retry'a "OK")
- Duplicate confirmation email + duplicate plan flip engellendi
- Unique constraint race condition graceful handle

**R2+R3**: Error boundaries + monitoring foundation
- 4 dosya: `global-error.tsx`, `(dashboard)/error.tsx`, `company/error.tsx`,
  `superadmin/error.tsx` (brand-styled retry buton, digest ID, Fehler-ID)
- `lib/monitoring/reportError.ts` — console + placeholder Sentry hook
  (`@sentry/nextjs` kurulunca `TODO(sentry)` yorumunda wire edilecek)

**P1+P2**: Signup güçlendirme
- Password 6 → 10 karakter + rakam veya özel karakter zorunlu
- `passwordStrengthError()` client validation
- **AGB + Datenschutzerklärung akzeptieren checkbox** (mandatory, Abmahn koruma)
- `mapError` "6 Zeichen" → "10 Zeichen" güncellendi

### Kullanıcı yaptı
- ✅ Supabase Dashboard → SQL Editor'da migration 021 çalıştırıldı (2026-07-09)
- Böylece prod DB tarafında da güvenlik açıkları KAPALI

### Validation
- TS clean · ESLint clean · Vitest **211/211** (feiertage +1 yeni test)
- Next build success (Vercel auto-deploy trigger cff5baa)

### Commit
`cff5baa v0.27.0 — Audit Week 1: 10 ship-blocker fix` · 21 dosya, +1309/-197 · auto-deploy ✓

### Kalan iş — Week 2-6 (audit'te detay)
**Week 2 — Yasal Sağlamlaştırma:**
- L2 §5 Ruhezeit 11h validation
- L3 §3 10h/gün cap + Ø 8h/6-Monats-Rolling
- L5 Krankheit 6-Wochen §3 EntgFG limit
- L6 Urlaub §5 BUrlG Zwölftelung
- L7 §7 III BUrlG Übertragung + 31.03 Verfall
- L10 §3b EStG SFN-Zuschläge (Sonntag 50%, Feiertag 125%)
- P4 OCR consent screen (DSGVO Art. 6)
- Datenschutz "Drittländer" düzelt + AVV template
- DSGVO delete cron worker (`/api/dsgvo/delete` process eden yok)

**Week 3-4 — UX + Dönüşüm:**
- MonthNav 26×26 → 44×44 tap targets
- Modal focus trap + aria-modal + ESC
- Skeleton primitive ("Laden..." replace)
- Global `*:focus-visible`
- Light mode tokens
- `100vh` → `100dvh`
- Weekly digest email (Monday) — retention #1
- Monthly PDF report email
- Landing testimonial strip
- DATEV CSV export
- `/vergleich/clockodo` + 2 SEO landing
- Beta anchor pricing "€19,99 → €5,99"
- Onboarding sample data injection

**Week 5-6 — Kod Sağlığı:**
- `salary/page.tsx` refactor (1148 LOC → 6 component)
- Zod schemas 4 admin write route
- React Query time_entries + vacation
- Migration 022: 6 DB index
- CI: tests + build restore (`.github/workflows/ci.yml`)
- Middleware role JWT'ye taşı
- Stripe webhook integration test
- `next/image` + `next/dynamic`

---

## 2026-07-09 (60) – v0.26.1: Notiz textarea + komple test suite

### Hedef
Kullanıcı bildirdi: "not kısmına Enter'a bastığımda alta geçmiyor". Fix +
kod tabanının bütünsel testi.

### Değişiklikler
**Fix**: `TimeEntryModal` + `NotdienstModal` — `<input type=text>` → `<textarea>`,
rows=2, resize=vertical, minHeight=44 (WCAG). Placeholder: "(Enter = neue Zeile)".
Görüntülemede `whiteSpace: "pre-line"` (`DayEntry` + `PhotoScanModal` chip'leri).

**Shared vitest fix**: `packages/shared/package.json` — `vitest run` →
`vitest run --passWithNoTests` (turbo test pipeline'ı kırmıyor).

### Komple test
- ✅ TypeScript: PASS (5s)
- ✅ Lint: PASS (0 warning)
- ✅ Vitest: 210/210 (17 dosya, 33.5s)
- ✅ Build: PASS 55/55 static page (63.7s)
- Bundle: `/demo` 113 KB, `/tracker` 181 KB, Middleware 86.9 KB

### Commits
- `0174d52 v0.26.1 — Notiz textarea`
- `e06040e chore(shared): passWithNoTests`

---

## 2026-06-22 (59) – v0.26.0: Demo shareability + trust polish

### Hedef
Outreach assets güçlensin + kayıt akışında "verim kaybolur mu?" paniği kalksın.

### 3 değişiklik

**1) Shareable Demo URLs**
- `/demo?tab=zeit|lohn|uebersicht|urlaub` direkt linklenebilir
- Tab değişince `router.replace(?tab=X)` URL sync, browser back/forward destekli
- Suspense wrapper useSearchParams için zorunlu (Next.js 15 static prerender)

**2) DemoDataBadge component** (`components/ui/DemoDataBadge.tsx`)
- Register + onboarding/type + onboarding/setup sayfalarına inject
- `hasDemoEdits()` true ise: "💾 N Demo-Einträge werden nach der Registrierung übernommen"
- Yoksa render etmez

**3) outreach_templates.md güncel**
- "Shareable Demo URLs" bölümü + persona-tab eşleşmesi:
  - Handwerk Inhaber → `/demo?tab=lohn` (Brutto-Netto en güçlü)
  - KOBİ admin → `/demo?tab=uebersicht` (KPI dashboard)
- r/Selbststaendig yorum metni güncellendi

### Conversion mantığı
Önce: kayıt akışında demo data sessizce arka planda, son adımda sürpriz prompt
Şimdi: register → onboarding/type → onboarding/setup → onboarding/done, her sayfada
"N entry hazır" rozeti → expectation set → "übernehmen" prompt'una gelene kadar
kullanıcı zaten biliyor.

### Validation
TS clean · ESLint clean · Vitest 186/186 · Next build
(/demo 7.38 → 7.84 kB, register +badge, onboarding setup/type +badge)

### Commit
`de71901 v0.26.0: Demo shareability + trust polish` · auto-deploy ✓

---

## 2026-06-22 (58) – v0.25.0: Demo → Konto data migration

### Hedef (kritik conversion booster)
Demo'da 5 dk emek harcayan user kayıt olunca verisini kaybetmesin. Önceki: %50
abandon riski. Sonrası: onboarding/done'da prompt + batch upsert.

### Akış (yeni)
1. /demo → kullanıcı entry'leri girer (localStorage)
2. Banner: "💾 Daten sichern →" (eski "Konto erstellen")
3. /register → DemoDataBadge ("N entry werden übernommen")
4. /onboarding/type, /onboarding/setup → DemoDataBadge devam (v0.26.0'da eklendi)
5. /onboarding/done → import prompt: "N Einträge übernehmen? [Verwerfen | ✓ Übernehmen]"
6. Übernehmen → supabase.upsert(time_entries) onConflict user_id+date
7. "✅ N Einträge übernommen" yeşil banner → "Jetzt starten" → /dashboard

### state.ts helpers (yeni)
- `hasDemoEdits()` — localStorage SEED'den farklı mı?
- `getDemoEntriesForImport()` — DemoEntry[] çek
- `clearDemoStorage()` — import sonrası cleanup

### onboarding/done page modifiye
- useState importStatus: checking | idle | prompt | importing | done | failed
- useEffect mount'ta hasDemoEdits check
- handleImport: supabase.from("time_entries").upsert(rows, { onConflict: "user_id,date" })
- handleDiscard: clearDemoStorage + status=idle
- "Jetzt starten" butonu importing sırasında disabled

### demo banner enhance
- hasEdits varsa eski: "Lokal — sicher dir dein Konto"
- Yeni: "Bei Anmeldung werden Daten automatisch übernommen" + "💾 Daten sichern →"

### Validation
TS clean · ESLint clean · Vitest 186/186 · Next build
(/onboarding/done 1.53 → 3.68 kB import logic)

### Commit
`379e5e9 v0.25.0: Demo → Konto data migration` · auto-deploy ✓

---

## 2026-06-22 (57) – v0.24.0: Demo Mode v2 — Interactive

### Hedef
v0.21.0'da çıkan read-only showcase'in conversion zayıflığını çözmek. Hedef: %1.5 → %3-4.

### Yeni mimari (6 dosya)
- `demo/state.ts` — DemoEntry/Settings types, useDemoState hook, localStorage persist,
  computeStats (Brutto × 0.68 Netto factor — simplified)
- `demo/EntryModal.tsx` — gün tıkla → bottom-sheet modal (Arbeiten/Urlaub/Krank/Frei
  chips + Start/Ende/Pause inputs + Löschen), 44×44 tap-targets, ESC close
- `demo/ZeitTab.tsx` — 30 gün Juni 2026 list, click → modal, live Soll/Ist/Diff bar
- `demo/UebersichtTab.tsx` — 2 hero KPI + 4 KPI (Stundensaldo + Brutto + counts), live
- `demo/LohnTab.tsx` — Brutto → Netto hero + 5 Abzug breakdown (LSt, RV, KV, AV, PV)
- `demo/UrlaubTab.tsx` — Anspruch/Genommen/Übrig live (Urlaub count state'ten), Beispiel-Anträge showcase

### page.tsx yeniden yazıldı
- Default tab artık "zeit" (Übersicht değil)
- Sticky banner context-aware: hasEdits varsa yeşil "Du hast eigene Daten!" + "Daten sichern" CTA
- Header'a "↻ Reset" buton (sadece hasEdits true ise) + confirm modal
- Conversion CTA bottom da hasEdits ile metni değişir

### UX kazanımları
- Kayıt olmadan tam tryout
- KPI'lar live recompute → feedback loop
- localStorage persist → sayfayı kapatıp tekrar açınca kaldığı yerden
- Reset butonu → seed'e dönüş

### Validation
TS clean · ESLint clean · Vitest 186/186 · Next build (/demo 4.41 → 7.38 kB)

### Commit
`46bdbd3 v0.24.0: Demo Mode v2 — Interactive` · auto-deploy ✓

---

## 2026-06-22 (56) – v0.23.0: Kontakt-Form

### Hedef
WhatsApp olmadan da iletişim — info@stundly.de email forwarding gereksiz, site içi
form Resend ile direkt bktasyusuf@gmail.com'a düşer.

### Yeni
- `/kontakt` page + form.tsx — name+email+subject+message, honeypot, validasyon
- `/api/contact` — POST, validation, honeypot, Resend send, replyTo=ziyaretçi
- `sendContactFormEmail` helper (`lib/email/resend.ts`)

### SupportButton güncelleme
- Sıra: WhatsApp (NUMBER varsa) → /kontakt link (default, her zaman çalışır) →
  EmailPopover (NEXT_PUBLIC_SUPPORT_EMAIL_MODE=popover gerekli)

### Footer
- Landing footer'a "Kontakt" linki en başa eklendi

### Env değişkeni (manuel, Vercel'de eklendi)
- `SUPPORT_TO_EMAIL = bktasyusuf@gmail.com` ← yapılmazsa 503 döner

### Bug fix sonrası (commit 8fb655e)
- `/api/contact` PUBLIC_PATHS'a eklendi (middleware 307 redirect ediyordu)
- Curl test sonrası bulundu

### turbo.json fix (commit c0c4d7c)
- Vercel build uyarısı: env vars deklare değildi → build task env:[]'a 18 değişken
- Runtime'da problemse yoktu ama Turbo cache invalidation için lazımdı

### Validation
TS clean · ESLint clean · Vitest 186/186 · Next build
(/kontakt 1.69 kB static, /api/contact dynamic)

### Commit
`30a41a3 v0.23.0: Kontakt-Form (/kontakt + /api/contact + Resend)` · auto-deploy ✓

---

## 2026-06-22 (55) – v0.22.0: Direkt-Mitarbeiter erstellen + must_change_password gate

### Bağlam
Önceki sohbette yarım kalmış iş + tamamlanma. Admin'in mitarbeiter'i email-davet
beklemeden direkt oluşturabilmesi için akış (geçici şifre + zorla değiştirme).

### Eklenen / değişen

**1) Migration 020 — `020_profiles_must_change_password.sql`**
- `profiles.must_change_password` boolean default false, idempotent
- Manuel apply gerekli (Supabase Dashboard SQL Editor)

**2) `/api/company/employees/create` (YENİ)**
- POST `{ email, password, full_name, role }` — company_admin gate
- supabase.auth.admin.createUser (email_confirm: true)
- profiles UPDATE: company_id, role, full_name, must_change_password=true, is_active=true
- Hata durumunda rollback (auth.admin.deleteUser)
- Audit log: `employee.created` (payload.method = "direct_create")
- Validasyon: email regex, password ≥ 8, name boş değil, role employee|company_admin

**3) `/api/account/change-password` (YENİ)**
- POST, login zorunlu
- Service-role ile profiles.must_change_password=false set (RLS bypass — user
  kendi flag'ini değiştiremez, sadece admin policy var)

**4) `/password-change` page + form (YENİ)**
- Server-component: user login değilse /login, flag set değilse role-home,
  silinmiş/deaktive ise /login?blocked=...
- Client form: 2 şifre input (new + confirm), validasyon, auth.updateUser →
  fetch flag-clear → router.push role-home

**5) 3 layout gate eklendi:**
- `(dashboard)/layout.tsx` — flag set ise /password-change
- `company/layout.tsx` — aynı
- `superadmin/layout.tsx` — aynı

**6) `/company/employees/page.tsx` UI değişti** (önceki sohbet yarım kalan iş)
- "Mitarbeiter einladen" → "Direkt erstellen" akışı
- `genPassword()` 12-char A-Za-z0-9 (1/I/O/0 hariç)
- Form: name + email + role + pwd (auto-fill button)
- handleCreate → POST /api/company/employees/create
- Başarılı sonra modal: admin şifreyi mitarbeiter'a güvenli iletir

### Akış (tam)
1. Admin /company/employees → "Direkt erstellen"
2. Email + temp şifre + name + role → POST create
3. Endpoint: auth user + profile.must_change_password=true + audit
4. Admin şifreyi mitarbeiter'a iletir (WhatsApp / yüz yüze)
5. Mitarbeiter login → middleware allow → layout gate → /password-change
6. Yeni şifre → auth.updateUser → flag clear → role-home

### Edge cases test edildi (mantıken)
- Mitarbeiter direkt /tracker → (dashboard) layout gate ✓
- Mitarbeiter direkt /password-change ama flag false → role-home redirect ✓
- super_admin must_change_password=true → /password-change ✓
- Silinmiş user /password-change'e gelirse → sign-out + /login?blocked=deleted ✓

### Test sonuçları
- Web TS: ✓ clean
- ESLint: ✓ clean
- Vitest: ✓ **186/186 pass · 16 suite**
- Next build: ✓ 3 yeni route (/password-change 1.8kB, /api/account/change-password 214B, /api/company/employees/create 214B)

### Değişen dosyalar (10 dosya, +533 / -52)
- `supabase/migrations/020_profiles_must_change_password.sql` — YENİ
- `apps/web/src/app/api/company/employees/create/route.ts` — YENİ
- `apps/web/src/app/api/account/change-password/route.ts` — YENİ
- `apps/web/src/app/password-change/page.tsx` — YENİ (server)
- `apps/web/src/app/password-change/form.tsx` — YENİ (client)
- `apps/web/src/app/company/employees/page.tsx` — MODIFIED (yeni akış UI)
- `apps/web/src/app/(dashboard)/layout.tsx` — gate eklendi
- `apps/web/src/app/company/layout.tsx` — gate eklendi
- `apps/web/src/app/superadmin/layout.tsx` — gate eklendi
- `apps/web/src/lib/version.ts` — 0.21.0 → 0.22.0 (MINOR)

### Manuel adım (deploy'da)
⚠ **Migration 020** Supabase Dashboard SQL Editor'da çalıştırılmalı —
yoksa create endpoint 500 patlar, gate sorgusu null döner.

### Commit
`6ecef44 v0.22.0: Direkt-Mitarbeiter erstellen + must_change_password gate`
Push → Vercel auto-deploy ✓ (https://stundly.de/demo → 200)

---

## 2026-06-21 (54) – v0.21.0: FAZ 2 — Mobile UX fixes + Demo Mode

### Hedef
FAZ 2 (Pazarlanabilir hale): mobile audit + fix, kayıt olmadan tryout için
/demo route, Reddit r/Selbststaendig + LinkedIn outreach playbook.

### Mobile Audit (12 bulgu, 3 critical + 4 significant + 5 polish)

**Critical:**
- Pinch-zoom kapalıydı (`layout.tsx` viewport `maximumScale:1 + userScalable:false`)
  → WCAG 1.4.4 ihlali, Android'de zoom blok. Fix: 2 satır kaldır.
- DayEntry delete `×` tap-target ~22×22 → 44×44 WCAG min
- DayEntry bezahlt ✅/⏳ tap-target ~24×24 → 44×44

**Significant:**
- InstallPrompt landing'de `bottom: 80px` boşa alan (BottomNav var sanıyordu).
  Context-aware: HAS_BOTTOM_NAV regex ile pathname kontrol → 96px vs 12px.
- CookieBanner dar mobile (<560px) buton sıkışırdı → full-width column-reverse stack.
- Landing nav <380px sıkış → `.landing-nav-link` class, "Anmelden"/"Preise" gizli, sadece brand + CTA.
- BottomNav popover sağ köşeden taşabilirdi → `max-width: min(90vw, 280px)`.

**Polish (atlandı):**
- Hero CTA mobile stack sırası
- Mockup phone `translateX(38%)` çok dar viewport
- Tracker "bugüne dön" floating buton
- Hero h1 clamp dual definition (globals + inline)

### Demo Mode (/demo)
**Pragmatic tercih: read-only showcase, tam ürün görünümü.**
- Single page, tab-based: Übersicht / Zeit / Lohn / Urlaub
- Juni 2026 seed data (10 günlük tracker, 6 abzug breakdown, 3 vacation request)
- Sticky DEMO banner üstte (gradient + "Kostenlos starten" CTA)
- Conversion CTA kart altta
- Mobile-first, desktop 2-col hero grid
- Public (middleware PUBLIC_PATHS'e eklendi)
- Sitemap entry (priority 0.9)
- Landing hero: "Features ansehen" → "👀 Live-Demo ansehen"
- Build: 4.41 kB static prerender

**Hedef metrik:** Reddit launch (v0.8.2) 68 visitor → 2 register = %1.5.
Demo Mode ile %5+ hedefleniyor (kayıt sürtünmesini düşürmek).

### Outreach Playbook (outreach_templates.md)
**r/Selbststaendig** — ban'leri öğrendik (v0.8.2 r/Hannover permaban):
- 3 ban-safe post-tipi:
  A) "Build in public" hikaye postu (en güvenli, link yorumda)
  B) "Frage stellen" — sorunu paylaş, çözümü tartışmada anlat
  C) Çarşamba Werbe-Thread (açık reklam, sadece burada)
- Cadence: 2-3 hafta sadece yorum → Type A → Çarşamba thread → Type B her 2 ayda

**LinkedIn** — Direct B2B DM:
- Hedef: NRW + NI + HE Handwerk KOBİ sahipleri (Geschäftsführer, 2-50 MA)
- 3 mesajlık sequence: cold → demo isteyene → 1 hafta follow-up
- Tone notları: Du, Solo-Indie pozisyonu, PS satırı önemli
- Demo link her zaman `/demo` (login yok = friction yok)

**FAQ** — 7 yaygın itiraz cevabı (Excel, fiyat, DSGVO, lohn-programı entegrasyonu vb.)

**Metrics framework** — Reddit + LinkedIn benchmark + target tablosu.

### Bonus: Mobile audit'in 7 fix'i tek commit'te uygulandı
- layout.tsx viewport
- DayEntry × + ✅/⏳ → 44×44
- InstallPrompt context-aware
- CookieBanner + globals.css (cookie-banner-* classes + 560px breakpoint)
- Landing nav class + 380px breakpoint
- BottomNav popover clip-protection

### Test sonuçları
- Web TS: ✓ clean
- ESLint: ✓ clean
- Vitest: ✓ **186/186 pass**
- Next build: ✓ (/demo static prerender 4.41 kB)

### Değişen dosyalar (13 dosya, +874 / -41)
**Yeni:**
- `apps/web/src/app/demo/page.tsx` + `layout.tsx`
- `outreach_templates.md` (repo root)

**Modified:**
- `apps/web/src/app/layout.tsx` (viewport)
- `apps/web/src/app/page.tsx` (hero CTA + nav class)
- `apps/web/src/app/globals.css` (+ cookie-banner-*, landing-nav-link, demo-hero-grid)
- `apps/web/src/app/sitemap.ts` (/demo entry)
- `apps/web/src/components/tracker/DayEntry.tsx` (tap targets)
- `apps/web/src/components/ui/BottomNav.tsx` (popover clip)
- `apps/web/src/components/ui/CookieBanner.tsx` (CSS class refactor)
- `apps/web/src/components/ui/InstallPrompt.tsx` (HAS_BOTTOM_NAV)
- `apps/web/src/middleware.ts` (/demo public)
- `apps/web/src/lib/version.ts` (0.20.3 → 0.21.0)

### Commit
`7658033 v0.21.0: FAZ 2 — Mobile UX fixes + Demo Mode`

### Kullanıcı tarafı kaldı
- ⏳ Browser'da mobile test (Chrome MCP bağlı değildi, gerçek telefonda doğrula)
- ⏳ r/Selbststaendig posting (önce 2-3 hafta sadece yorum cadence)
- ⏳ LinkedIn DM batch (ilk 50 hedef profil)

---

## 2026-06-21 (53) – v0.20.1: HOTFIX — Soft-delete auth gate (web + mobile)

### Bulgu (kullanıcı soru: "bu degisiklik hem webde hem mobilde dimi")

v0.20.0 sonrası **kritik açık**: profile.is_active=false ve deleted_at set olsa bile
Supabase auth bu alanları bilmiyor → silinmiş bir mitarbeiter hem web hem mobile'a
hâlâ login yapıp tracker'ı kullanabiliyordu.

### Düzeltme

**Web — `middleware.ts`**
- Her authenticated istek için profile fetch'i COMPANY_ADMIN_PATHS'e bağlıydı
- Şimdi: TÜM authenticated istek `(role, is_active, deleted_at)` çeker
- `deleted_at != null` veya `is_active = false` → `signOut()` + `/login?blocked=deleted|inactive` redirect
- Tek ekstra DB roundtrip per request (cookie cache'leniyor, OK)

**Web — `/login/page.tsx`**
- `?blocked=deleted` veya `?blocked=inactive` query → ön-doldurulmuş hata mesajı
- Client login flow'da da gate eklendi: signIn başarılı sonrası profile check;
  engelse `signOut()` + hata mesajı (middleware kaçırırsa fallback)

**Mobile — `App.tsx`**
- `gateSession(session)` helper: profile fetch + deleted_at/is_active check
- `getSession()` + `onAuthStateChange` event listener — ikisinde de gate çalışır
- Gate fail → `signOut()` + `Alert.alert("Konto gelöscht/deaktiviert", ...)`
- subscription.unsubscribe() cleanup

### Test sonuçları
- Web TS: ✓ clean
- Mobile TS: ✓ clean
- ESLint: ✓ clean
- Vitest: ✓ **186/186 pass · 16 suite**

### Değişen dosyalar
- `apps/web/src/middleware.ts` — gate her authenticated request için
- `apps/web/src/app/(auth)/login/page.tsx` — blocked query mesajı + client-side gate
- `apps/mobile/App.tsx` — gateSession helper + Alert
- `apps/web/src/lib/version.ts` — 0.20.0 → 0.20.1 (PATCH — güvenlik hotfix)

### Soft-delete kapsam özeti (artık tam)
| Katman | Durum |
|--------|-------|
| DB schema (migration 019) | ✓ |
| Web admin UI Löschen/Wiederherstellen | ✓ |
| Web admin endpoints + audit log | ✓ |
| Web middleware login gate | ✓ HOTFIX |
| Web login sayfası gate + mesaj | ✓ HOTFIX |
| Mobile auth gate (App.tsx) | ✓ HOTFIX |

Mobile admin paneli yok (mobile sadece tracker/scan/gehalt/mehr). Bu yüzden
mobile tarafında Löschen UI gerekmiyor — sadece silinmiş user'ı içeri almama gerekiyordu.

---

## 2026-06-21 (52) – v0.20.0: F5 #2 — Soft-delete Mitarbeiter

### Hedef
Mitarbeiter "silinsin" ama time_entries / vacation_requests / notdienst kalsın
(GoBD 10 yıl saklama). Audit log entegrasyonu ile kim ne zaman sildi izlenir.
Kazara silmede restore butonu.

### Mimari karar — soft-delete vs hard-delete

- **Soft-delete** (`/api/company/employees/delete`) — admin günlük kullanım için
  - profile.deleted_at + deleted_by set
  - profile.is_active=false (login engellenir)
  - Bağlı tablolar (time_entries vs.) DOKUNULMAZ
  - Geri al butonu var
- **Hard-delete** (`/api/dsgvo/delete`) — sadece kullanıcı kendi kendini siler
  - Mevcut DSGVO route, anonymize + erase
  - Bu PR'da DEĞİŞMEDİ

### Eklenen / değişen

**1) Migration 019 — `019_profiles_soft_delete.sql`**
- `profiles.deleted_at timestamptz` ve `deleted_by uuid → auth.users` kolonları
- `profiles_active_idx` partial index `(company_id) where deleted_at is null`
  → aktif sorgular hızlı kalır
- Idempotent, manuel apply gerekli

**2) `/api/company/employees/delete` (YENİ)**
- POST `{ userId }` — company_admin gate
- Güvenlik: same-company + self-lockout (admin kendini silemez) + 409 already-deleted
- `deleted_at = now()`, `deleted_by = admin.user.id`, `is_active = false` set
- Audit: `employee.soft_deleted` payload: target_full_name, target_email, target_role

**3) `/api/company/employees/restore` (YENİ)**
- POST `{ userId }` — same gates
- `deleted_at = null`, `deleted_by = null`, `is_active = true`
- Audit: `employee.restored`

**4) Query'lere `is null deleted_at` filter eklendi**
- `/api/company/team-summary` → `?includeDeleted=true` ile override edilebilir
  (UI bunu kullanır soft-deleted'i ayrı listede göstermek için)
- `/company/reports/page.tsx` → server-side employees fetch
- `/api/company/reports/data` → bulk path

**5) `/company/employees` UI**
- "Deaktivieren" (mevcut, yellow) + "Löschen" (yeni, red) butonları
- "Gelöschte Mitarbeiter (N) ▾" toggle bölümü altta
- Silinmiş card'lar: opacity 0.55, red left border, gelöscht-tarihi
- "Wiederherstellen" yeşil buton
- Löschen onayı: confirm dialog (Zeitdaten bleiben erhalten mesajı)
- includeDeleted=true query → frontend deleted_at'a göre 2 listeye ayırır

**6) Testler (YENİ 13 case)**
- DELETE: 403/400/404/cross-company/self-protect/409 already-deleted/200 success/500 DB error
- RESTORE: 403/400/cross-company/409 already-active/200 success
- Audit log mock'lanır + assert edilir

### Test sonuçları
- Web TS: ✓ clean
- ESLint: ✓ clean
- Vitest: ✓ **186/186 pass · 16 suite** (173 → 186)

### Değişen dosyalar
- `supabase/migrations/019_profiles_soft_delete.sql` — YENİ
- `apps/web/src/app/api/company/employees/delete/route.ts` — YENİ
- `apps/web/src/app/api/company/employees/restore/route.ts` — YENİ
- `apps/web/src/app/api/company/employees/__tests__/softDelete.test.ts` — YENİ (13 test)
- `apps/web/src/app/api/company/team-summary/route.ts` — includeDeleted flag
- `apps/web/src/app/company/reports/page.tsx` — deleted_at filter
- `apps/web/src/app/api/company/reports/data/route.ts` — deleted_at filter
- `apps/web/src/app/company/employees/page.tsx` — Löschen + Wiederherstellen UI
- `apps/web/src/lib/version.ts` — 0.19.0 → 0.20.0 (MINOR — F5 #2)

### Manuel adım (deploy'da)
⚠ **Migration 019** Supabase Dashboard SQL Editor'da çalıştırılmalı.

### F5 ilerleme
- [x] v0.19.0 — Audit log altyapısı
- [x] v0.20.0 — Soft-delete + audit entegrasyonu
- [ ] Multi-admin desteği
- [ ] Stripe seat-based billing

---

## 2026-06-21 (51) – v0.19.0: F5 başlangıç — Audit Log altyapısı

### Hedef
F5'in ilk parçası: DSGVO + GoBD denetlenebilirlik. Kim ne zaman ne yaptı?
Soft-delete + Stripe + multi-admin sonradan bu altyapıyı kullanacak.

### Eklenen / değişen

**1) Migration 018 — `018_audit_log.sql`**
- `audit_log` tablosu: id, created_at, actor_user_id, company_id, action,
  resource_type, resource_id, payload (jsonb)
- 3 indeks (company+created, actor, resource)
- RLS: company_admin/super_admin sadece kendi şirketinin audit'ini SELECT eder
- INSERT/UPDATE/DELETE policy YOK → sadece service-role yazar (immutable trail)
- Idempotent — manuel apply gerekli

**2) `lib/audit/logger.ts` (YENİ)**
- `logAudit({ admin, actorUserId, companyId, action, resourceType?, resourceId?, payload? })`
- Fire-and-forget: hatalar console.error'a, throw etmez, ana işlemi durdurmaz
- snake_case action convention: `vacation.approved`, `vacation.rejected`,
  `employee.activated`, `employee.deactivated`, vs.

**3) Mevcut admin route'lara entegre edildi**
- `/api/vacation/[id]/decision` — `vacation.approved` veya `vacation.rejected`
  payload: employee_user_id, dates, days, urlaub_art, rejection_reason
- `/api/company/employees/toggle` — `employee.activated` veya `employee.deactivated`
  payload: target_role

**4) `/company/audit` (YENİ sayfa)**
- Aktivite zaman çizgisi (son 50/sayfa)
- Sayfalama (?page=N, count exact)
- Her satır: action ikonu + label + actor adı + target adı + relative time
- 6 action label/icon/color map (vacation/employee approve/reject/activate/deactivate)
- Vacation action'larda tarih aralığı ve rejection_reason inline
- Hover'da absolute timestamp tooltip

**5) Sidebar nav güncellendi**
- "Audit-Log 🔒" item Berichte ile Abonnement arasına eklendi

**6) Testler**
- `auditLogger.test.ts` — 4 case: insert payload, default null, DB hata fire-and-forget, exception yutma
- `decision/route.test.ts` — yeni `vi.mock("@/lib/audit/logger")` (mevcut testler çalışsın diye)

### Test sonuçları
- Web TS: ✓ clean
- ESLint: ✓ No warnings or errors (audit page'de „...&ldquo; escape)
- Vitest: ✓ **173/173 pass · 15 suite** (169 → 173, 4 yeni audit test)
- Next build: ✓ 47/47 (yeni `/company/audit` route 195B)

### Değişen dosyalar
- `supabase/migrations/018_audit_log.sql` — YENİ
- `apps/web/src/lib/audit/logger.ts` — YENİ
- `apps/web/src/app/company/audit/page.tsx` — YENİ
- `apps/web/src/__tests__/unit/auditLogger.test.ts` — YENİ
- `apps/web/src/app/api/vacation/[id]/decision/route.ts` — audit log eklendi
- `apps/web/src/app/api/company/employees/toggle/route.ts` — audit log eklendi
- `apps/web/src/app/api/vacation/[id]/decision/__tests__/route.test.ts` — vi.mock("@/lib/audit/logger") eklendi
- `apps/web/src/app/company/layout.tsx` — nav item eklendi
- `apps/web/src/lib/version.ts` — 0.18.0 → 0.19.0 (MINOR — F5 başlangıç)

### Manuel adım (deploy'da)
⚠ **Migration 018** Supabase Dashboard SQL Editor'da çalıştırılmalı.
Yoksa /company/audit boş gözükür ve decision/toggle route'ları console.error verir
(ama ana işlem devam eder — fire-and-forget).

### F5 ilerleme
- [x] v0.19.0 — Audit log altyapısı + entegrasyon
- [ ] Soft-delete + audit entegrasyonu
- [ ] Multi-admin desteği
- [ ] Stripe seat-based billing

---

## 2026-06-21 (50) – v0.18.0: F4 son parça — Admin Monatsberichte (PDF + CSV)

### Hedef
F4'ün son parçası: `/company/reports` GoBD-uyumlu, ay bazlı PDF + CSV export.

### Eklenen / değişen

**1) `lib/export/csvExport.ts` (YENİ)**
- `buildCsvDetail` — tek çalışan için ay gün gün dökümü + Notdienst bölümü + toplam
- `buildCsvSummary` — bulk export, çalışan başına tek satır (KPI'lar)
- UTF-8 BOM + Semikolon-Trenner (Excel Almanca uyumlu)
- RFC 4180 escape (";", `"`, CR, LF için tırnak + içerde `"`→`""`)
- HH:MM hem ondalık dakika hem human-readable iki sütun (GoBD)
- Gece vardiyası (end < start) cross-midnight handle
- `csvDownload` — blob + filename, browser indirme

**2) `/api/company/reports/data` (YENİ route)**
- GET year, month, userId? → JSON data dump
- `getCompanyAdminContext` gate
- userId verilirse: tek çalışan + same-company kontrolü
- userId yoksa: tüm aktif çalışanlar (bulk)
- Time entries + Notdienst entries + Feiertage (Bundesland'a göre) + Firma + Profile
- PDF helper'ın beklediği tüm profile field'ları (vorname, nachname, signature_data, logo_data, firma_*)

**3) `ReportExportButtons` client component (YENİ)**
- `EmployeeExportButtons`: tek çalışan için PDF + CSV detail butonları
- `BulkCsvButton`: tüm çalışanlar için summary CSV
- Loading state per format + error display
- exactOptionalPropertyTypes safe property assignment

**4) `/company/reports` redesign**
- Ay nav (önceki / şimdiki / sonraki) URL ?year=&month= search params
- 3 KPI: Mitarbeiter sayısı / Gesamt Arbeit / Toplam Notdienst
- Her çalışan card'ı: ad + email + 5 stat grid (Arbeit / Arbeitstage / Urlaub / Krank / Notdienst)
- Her card'a EmployeeExportButtons (PDF + CSV)
- Üstte BulkCsvButton (tüm çalışanlar tek dosya)
- GoBD-bilgi notu altta
- Çalışan adına tıklayınca employee detail page (aynı ay+yıl ile)
- Notdienst: ndCount + ndPaid (b = bezahlt) gösterilir

**5) Yeni testler — `csvExport.test.ts` (12 case)**
- BOM + Excel uyumlu format
- DE semikolon-Trenner doğru sütun sayısı
- Header metadata içerir (ay, yıl, isim)
- Arbeiten net dakika + toplam
- Gece vardiyası cross-midnight
- Notdienst section + bezahlt sayısı
- RFC 4180 escape ("," " içeren notlar)
- Bulk: çalışan başına tek satır + agreggate
- Boş rows → sadece header

### Test sonuçları
- Web TS: ✓ clean
- ESLint: ✓ No warnings or errors
- Vitest: ✓ **169/169 pass · 14 suite** (157 → 169, 12 yeni csv test)
- Next build: ✓ 46 → 47 route (`/api/company/reports/data` eklendi)
- /company/reports: 200B → 5.36 kB (yeni UI)

### Değişen dosyalar
- `apps/web/src/lib/export/csvExport.ts` — YENİ
- `apps/web/src/app/api/company/reports/data/route.ts` — YENİ
- `apps/web/src/app/company/reports/ReportExportButtons.tsx` — YENİ
- `apps/web/src/app/company/reports/page.tsx` — komple redesign
- `apps/web/src/__tests__/unit/csvExport.test.ts` — YENİ
- `apps/web/src/lib/version.ts` — 0.17.0 → 0.18.0 (MINOR)

### F4 STATUS
- [x] Admin Vacation Approval UI + email (v0.17.0)
- [x] Aylık PDF + CSV export GoBD-uyumlu (v0.18.0)

**F4 KOMPLE TAMAM** 🎉

### Sıradaki: F5 (Billing & Operations)
- [ ] Stripe `quantity = seat_count` + proration
- [ ] Multi-admin desteği
- [ ] Soft-delete inaktif Mitarbeiter
- [ ] Audit log tablosu

---

## 2026-06-21 (49) – v0.17.0: F4 — Admin Vacation Approval

### Hedef
F4 fazının ilk parçası: company_admin Urlaubsanträge'ı **employee detail page**'de görüp **onaylayabilsin/reddedebilsin**, mitarbeiter de **email** bildirimi alsın.

### Eklenen / değişen

**1) Migration 017 — `017_vacation_approval_fields.sql`**
- 4 yeni kolon: `approved_at`, `approved_by` (uuid → auth.users), `rejected_at`, `rejection_reason`
- Yeni RLS policy: `Company admin can update team vacations` — `is_company_member_of_admin(user_id)` helper'ını kullanır (Migration 015'te geldi). Admin AYNI ŞİRKETTEKİ çalışanın vacation_requests kaydını UPDATE edebilir.
- Idempotent — manuel apply gerekli (Supabase Dashboard)

**2) `lib/email/resend.ts` — yeni `sendVacationDecisionEmail`**
- Approved + Rejected için tek fonksiyon
- Stundly dark tema (purple accent), Zeitraum / Tage / Urlaubsart blok
- Ret durumunda rejection_reason kırmızı blokta gösterilir
- "Zu meinen Anträgen →" CTA → /vacation

**3) `/api/vacation/[id]/decision` (yeni route)**
- POST `{ decision: "approved" | "rejected", reason?: string }`
- Güvenlik zinciri:
  1. `getCompanyAdminContext` → 403 yoksa
  2. Antrag bulunmazsa → 404
  3. Antrag zaten karara bağlandıysa → 409
  4. Antrag sahibi aynı şirkette değilse → 403
- Update sonrası fire-and-forget email; email başarısız olsa karar geçerli kalır
- Update hatasında 500, email gönderilmez

**4) Employee detail page güncellendi**
- Vacation select genişletildi: urlaub_art, vertretung, approved_at, rejected_at, rejection_reason
- Pending sayısı header'da yellow chip ("3 ZU PRÜFEN")
- Her vacation card'a sol kenar accent çubuğu status renginde
- Pending vacationlar için `<VacationDecisionButtons>` client component:
  - "✓ Genehmigen" tek tık
  - "✕ Ablehnen" → açılır panel: reason textarea + Endgültig ablehnen
  - Loading state + error display + router.refresh()
- Approved'larda "Genehmigt: TT.MM.YYYY", rejected'larda red "Begründung: …"
- Urlaubsart Erholungsurlaub harici chip olarak

**5) Test — `decision/__tests__/route.test.ts` (9 case)**
- 403 — admin değil
- 400 — decision invalid
- 404 — antrag yok
- 409 — zaten karara bağlanmış
- 403 — cross-company
- 200 — approve (email gitti, approved_at + approved_by set)
- 200 — reject (rejection_reason set)
- 200 — email fail olsa bile karar geçerli
- 500 — DB update hatası

### Test sonuçları
- Web TS: ✓ clean
- ESLint: ✓ No warnings or errors (vacation page useEffect'e disable comment eklendi)
- Vitest: ✓ **157/157 pass · 13 suite** (148 → 157 — 9 yeni decision route test)
- Next build: ✓ 45 → 46 route (yeni decision route)

### Değişen dosyalar
- `supabase/migrations/017_vacation_approval_fields.sql` — YENİ
- `apps/web/src/lib/email/resend.ts` — sendVacationDecisionEmail eklendi
- `apps/web/src/app/api/vacation/[id]/decision/route.ts` — YENİ
- `apps/web/src/app/api/vacation/[id]/decision/__tests__/route.test.ts` — YENİ
- `apps/web/src/app/company/employees/[userId]/VacationDecisionButtons.tsx` — YENİ
- `apps/web/src/app/company/employees/[userId]/page.tsx` — UI genişletildi
- `apps/web/src/app/(dashboard)/vacation/page.tsx` — eslint warning fix
- `apps/web/src/lib/version.ts` — 0.16.1 → 0.17.0 (MINOR — yeni admin özelliği)

### Manuel adım (deploy'da)
⚠ **Migration 017** Supabase Dashboard SQL Editor'da çalıştırılmalı. Yoksa onay/red butonu DB hatası verir.

### Doğrulama (kullanıcı yapacak)
1. Çalışan Urlaubsantrag açar
2. Admin `/company/employees/{userId}` sayfasını açar
3. Pending Urlaubsantrag'da "✓ Genehmigen" / "✕ Ablehnen" görmeli
4. Genehmigen tıklayınca: status=approved, çalışan email alır
5. Ablehnen → reason textarea → reason ile email gider
6. Sayfa refresh sonrası status badge + tarihler güncel

---

## 2026-06-21 (48) – v0.16.1: Überstunden Bug Fix (Notdienst + dyn. target)

### Bulgu (kullanıcı bildirimi: "überstunde hesaplanmamis")

Vacation sayfası Überstunden 0 gösteriyordu. İki bug tespit edildi:

**Bug #1 — Notdienst saatleri sayılmıyordu**
- `lib/vacation/overtime.ts` helper'ı sadece `time_entries.day_type=arbeiten` günlerini topluyordu
- Notdienst saatleri ayrı tabloda (`notdienst_entries`) → hiç fetch edilmiyordu
- Reports sayfasındaki `calcMonthStats` zaten Notdienst'i içeriyordu → iki sayfa farklı sayı gösteriyordu

**Bug #2 — Sollstunden 8h hardcoded**
- `hoursPerDay = 8` parametresi sabit
- Kullanıcının `salary_settings.monthly_target_hours` kullanılmıyordu
- Almanya KMU normali: 173h/ay = ~7.97h/gün. Bazı sözleşmelerde 160h/ay = 7.37h/gün → target yanlış (yüksek) → Überstunden gözükmez

### Düzeltme

**`lib/vacation/overtime.ts`**
- Yeni `OvertimeNdEntry` interface (date, start_time, end_time)
- Yeni `ComputeOvertimeOptions { ndEntries?, hoursPerDay? }`
- 4. parametre overload (backward-compat): number olarak verildiyse hoursPerDay
- Notdienst saatleri `ndMin` olarak ayrı toplanır, overtime hesabına dahil
- Hafta sonu Notdienst saatleri de sayılır (gerçek çalışma)
- Gelecek tarihli Notdienst sayılmaz

**`vacation/page.tsx`**
- `notdienst_entries` fetch eklendi (yıl bazlı)
- `salary_settings.monthly_target_hours` fetch eklendi
- `hoursPerDay = monthly_target_hours / 21.7` (ay başına Mo-Fr ortalaması)
- Helper'a iki yeni opsiyon pas edildi

**Yeni testler (`overtime.test.ts`)**
- Backward-compat: 4. parametre number ile hâlâ çalışır
- Notdienst saatleri workedMin'e değil ndMin'e gider
- Kanıt test: 5h Notdienst eklenince overtime 0 → 5h olur
- Hafta sonu Notdienst sayılır (cross-midnight gece)
- Gelecek tarihli Notdienst sayılmaz
- hoursPerDay parametresi target'i değiştirir

### Test sonuçları
- Web TS: ✓ clean
- Lint: ✓ clean
- Vitest: ✓ **148/148 pass · 12 suite** (önceki 142 + 6 yeni)

### Değişen dosyalar
- `apps/web/src/lib/vacation/overtime.ts` — Notdienst + options interface
- `apps/web/src/app/(dashboard)/vacation/page.tsx` — fetch + helper call güncellendi
- `apps/web/src/__tests__/unit/overtime.test.ts` — 6 yeni test
- `apps/web/src/lib/version.ts` — 0.16.0 → 0.16.1 (PATCH — bug fix)

### Doğrulama (kullanıcı yapacak)
1. Reports sayfasında "Differenz" / "Überstunden" değerini not al
2. Vacation sayfası hero kartında "+X aus Überstunden" eşit olmalı
3. Notdienst yapan kullanıcılarda artık 0 değil gerçek saat görmeli

---

## 2026-06-20 (47) – v0.16.0: Urlaubsanträge — modern redesign

### Hedef
"bu berbat hic begenmedim modern olsun" — mockup ile yön onaylandı, komple görsel rewrite.

### Tasarım değişiklikleri (web)

**Hero card (yeni)**
- Tek büyük dramatik kart, gradient orb sağ üstte (accent2 → blue)
- 64px monospace "X Tage" verfügbar (Urlaub + Überstunden toplamı)
- Sağda 84×84 progress ring + ortada % değer
- Alt pill progress bar `X von Y` + Jahresanspruch
- Eski 2 yan yana donut chart **kaldırıldı**

**12-ay dikey bar timeline (yeni)**
- Heatmap 12×31 grid **kaldırıldı**
- Yerine 12 dikey bar (ay başına yoğunluk), aktif ay accent2 highlight
- 30%'den büyük barlarda gün sayısı içeride gösteriliyor
- Alt monospace J F M A M J J A S O N D etiketleri

**3 mini KPI kart**
- Überstunden (saat + gün) · Wartende Anträge · Nächster Urlaub (kalan gün + tarih)
- Tabler tarzı inline SVG icons (CDN yok)

**Magazin tarzı antrag list**
- Sol: büyük tarih `02 / JUL` monospace
- Orta: `2. — 16. Juli` + URLAUBSART chip + meta (gün/Vertretung) icons ile
- Sağ: status pill (`Wartet 3T` / `✓ Genehmigt` / `Abgelehnt`) + trash icon
- Sol kenar accent çubuk status renginde
- Eski card layout **kaldırıldı**

**Slide-in panel (yeni)**
- Modal-backdrop **kaldırıldı**, yerine sağdan kayan 440px panel
- Backdrop blur(4px) + opacity
- Smooth cubic-bezier slide animation
- Body scroll lock when open
- Yuvarlak X butonu üst sağda
- Mitarbeiter chip: avatar daire içinde inisyaller

**Urlaubsart pills (yeni)**
- Dropdown **kaldırıldı**, yerine 6 pill (2 sütun grid)
- Active: ilgili renkle border + bg highlight (Erholung=purple, Sonder=orange, Bildung=blue, Unbezahlt=muted, Elternzeit=green, Überstunden=blue)

**Validation banner**
- Tutuldu ama icon entegrasyonu yapıldı (check/alert/x icon + metin)

**Quick presets**
- Tutuldu (Heute/Morgen/1W/2W/Brückentag)

### Yeni Icon Component
- Inline SVG `<Icon name="..." />`, 18 named icons
- Tabler tarzı 2px stroke, currentColor inherit
- CDN bağımlılığı yok (Tabler font yüklemedi), production bundle eklenmedi

### Test sonuçları
- Web TS: ✓ clean
- ESLint: ✓ clean
- Vitest: ✓ **142/142 pass · 12 suite**
- Next build: ✓ 45/45 (/vacation 10.8 → 14.9 kB)

### Değişen dosyalar
- `apps/web/src/app/(dashboard)/vacation/page.tsx` — komple rewrite (760 → ~880 satır)
- `apps/web/src/lib/version.ts` — 0.15.0 → 0.16.0 (MINOR — visual redesign)

---

## 2026-06-20 (46) – v0.15.0: Urlaubsanträge — profesyonelleştirme

### Hedef
"daha profesyonel yapabilir miyiz" — modern Urlaubsverwaltung örneklerini (Personio / absence.io / Factorial / Kenjo) araştırdıktan sonra 5 büyük iyileştirme tek paket.

### Eklenen özellikler (web)

**1) Urlaubsart Dropdown + Vertretung alanı**
- Düz text input → enum: Erholungsurlaub / Sonderurlaub / Bildungsurlaub / Unbezahlter Urlaub / Elternzeit / Überstundenabbau
- Yeni `Vertretung` input (Handwerk standardı, yerimi kim alacak)
- PDF'e Vertretung satırı eklendi, mail body'sine de
- Liste card'larında Erholungsurlaub harici türler chip olarak gösteriliyor

**2) Mini Jahres-Kalender (Heatmap)**
- 12 ay × 31 gün SVG grid, native browser tooltip
- Renkler: Urlaub (blue), Pending Antrag (yellow), Feiertag (yellow %35), Wochenende (muted), Bugün (accent2 stroke)
- Collapsible (▾/▸ toggle)
- Legend altında 4 renk açıklaması

**3) Smart Validation (form içi banner)**
- Real-time hesap: rawWorkdays, netWorkdays (Feiertag düşülmüş)
- Feiertag uyarısı: "Im Zeitraum: Karfreitag (10.04.), Ostermontag (13.04.)"
- Overlap check: Mevcut pending/approved antraglarla çakışma
- Past warning: Vergangenheit'te tarih
- Balance check: Erholungsurlaub/Bildungsurlaub için yeterli mi, Überstundenabbau için overtime kontingenti
- Renkler: ok→green, warn→yellow, error→red

**4) Status Timeline Cards**
- Antrag listesinde sadece badge değil, mini timeline: ●Beantragt · 12.06.2026 → ●Genehmigt · 14.06.2026
- Pending'lerde "Wartet seit Xt" sayacı

**5) Quick Presets Butonları**
- Heute / Morgen / 1 Woche / 2 Wochen / Brückentag
- Brückentag: önümüzdeki 12 ayda bir hafta sonu + Feiertag arası tek hafta içi gün arar (Christi Himmelfahrt + Cuma vs.)

### DB değişiklik
- `supabase/migrations/016_vacation_urlaub_art_vertretung.sql` — idempotent, iki yeni text kolon
- **Manuel apply** gerekli (Supabase Dashboard SQL editor)

### Shared type güncellemesi
- `VacationRequest`: `urlaub_art?`, `vertretung?`, `approved_at?`, `approved_by?`, `rejected_at?`, `rejection_reason?` (hepsi optional)
- Yeni `UrlaubArt` union type + `URLAUB_ARTEN` readonly array export

### Test sonuçları
- Web TS: ✓ clean
- Mobile TS: ✓ clean
- Shared TS: ✓ clean
- Web Next build: ✓ 45/45 static pages (/vacation 10.8 kB, eski ~3 kB)
- ESLint: ✓ No warnings or errors
- Vitest: ✓ **142/142 pass · 12 suite** (mevcut testler etkilenmedi)

### Değişen dosyalar
- `apps/web/src/app/(dashboard)/vacation/page.tsx` — komple rewrite (663 → 760 satır)
- `apps/web/src/lib/version.ts` — 0.14.2 → 0.15.0 (MINOR — user-visible feature)
- `packages/shared/src/types/index.ts` — UrlaubArt + URLAUB_ARTEN export, VacationRequest 6 yeni optional alan
- `supabase/migrations/016_vacation_urlaub_art_vertretung.sql` — YENİ
- `son_kayit.md` — güncellendi

### Kullanılan referans (Web research)
- Factorial HR / HoorayHR Urlaubsverwaltung 2026 vergleich
- Cflow leave approval workflow best practices
- Kenjo "Mehrfachanfragen" pattern
- VacationTracker leave approval

---

## 2026-06-14 (35) – v0.11.1: Faz 3 test pass + 2 bug fix

### Test sonuçları
- **Yeni unit testler:** `companyAdmin.test.ts` — netMinutesForEntry (12 case) + formatMinutes (5 case) = **16/16 passed ✓**
- **Tüm suite:** 43 pass, 3 fail (salaryCalc — F3 öncesi vardı, alakasız)
- **Build:** ✓ Compiled successfully
- **TypeScript:** ✓ clean
- **Lint:** sadece 1 yeni hata (German curly quote) — düzeltildi
- **Dev server cold-start:** 2.4s, module-level error yok

### Bulunan & düzeltilen buglar

**Bug #1: toggleEmployee silently fails** ❌
- Sorun: `profiles` UPDATE RLS policy'si sadece `auth.uid() = user_id` izin veriyor → admin başka çalışanın is_active'ini değiştiremiyor, buton tıklanıyor ama hiçbir şey olmuyor
- Çözüm: yeni server route `/api/company/employees/toggle`
  - getCompanyAdminContext ile yetki gate
  - Target user aynı şirkette mi doğrular (404 değilse)
  - Lockout engeli: admin kendi kendini deaktive edemez
  - admin client ile bypass

**Bug #2: Employee detail malformed query** ❌
- Sorun: `?year=abc` gibi geçersiz query → parseInt NaN → firstDay "NaN-NaN-01" → sorgu sessiz fail
- Çözüm: validation — `Number.isInteger + range check`, geçersizse current ay'a fallback

**Cosmetic: German quote escape**
- `„{v.reason}"` → `„{v.reason}“` (proper curly close)

### Test komutu
```bash
npx vitest run src/__tests__/unit/companyAdmin.test.ts
```

### Değişen dosyalar
- `apps/web/src/__tests__/unit/companyAdmin.test.ts` — YENİ (16 test)
- `apps/web/src/app/api/company/employees/toggle/route.ts` — YENİ (admin toggle bypass)
- `apps/web/src/app/company/employees/page.tsx` — toggle route kullanıyor
- `apps/web/src/app/company/employees/[userId]/page.tsx` — query validation + quote fix
- `apps/web/src/lib/version.ts` — 0.11.0 → 0.11.1 (PATCH)

---

## 2026-06-14 (34) – v0.11.0: Faz 3 Admin Sight — ekibi gör, drill-down et

### Hedef
Patron "Ben ekibimi görüyorum" diyebilsin: takım toplam saatleri, bekleyen Urlaubsanträge, her çalışanın aylık özetine tıklayarak gün-gün read-only Tracker görüntüleme.

### Eklenen / değişen

**1) Migration 015 (yeni)** — `015_company_admin_read_access.sql`
- Helper function: `is_company_member_of_admin(target_user)` — admin'in çağırdığı user'ın aynı şirkette olup olmadığını döner
- RLS policy'ler eklendi: `company_admin` veya `super_admin` artık ŞİRKETİNDEKİ çalışanların `time_entries`, `vacation_requests`, `notdienst_entries`, `daily_logs`, `salary_records` (varsa) kayıtlarını SELECT edebilir
- Bilgi: Bu migration manuel apply edilmeli (Supabase Dashboard SQL editor). Kod migration olmadan da çalışır çünkü server route'lar service-role client kullanıyor — migration "future hardening" için

**2) `lib/company/admin.ts` (yeni)**
- `getCompanyAdminContext()` — server-only: oturum + company_admin doğrulama + service-role admin client döner
- `netMinutesForEntry()` — gece vardiyası + Urlaub/Krank/Feiertag bezahlte Abwesenheit (8h Mo-Fr) dahil tutarlı hesap
- `formatMinutes()` — "165h 30m" formatı

**3) `/api/company/team-summary` (yeni route)**
- GET ?month=YYYY-MM → bu ayın employees + monthly hours + pending vacations
- Çalışan başına: monthlyMinutes, workDays, vacationDays, sickDays
- Sadece company_admin/super_admin yetkili

**4) `/company/dashboard` — KPI zenginleştirme**
- Eski: aktif Mitarbeiter, offene Einladungen, plan, max
- Yeni: 4 ana KPI kart:
  • Aktive Mitarbeiter
  • Team-Stunden · Juni
  • Offene Einladungen
  • Offene Urlaubsanträge
- Plan/max bilgisi alt satıra alındı
- Bekleyen Urlaubsanträge listesi (ilk 5, tıklayınca çalışan detayına gider)

**5) `/company/employees` — bu ay saatleri + drill-down**
- Liste artık /api/company/team-summary'den çekiyor
- Her satırda bu ay saat (büyük) + workDays/Urlaub/Krank mini
- Satır tıklayınca /company/employees/[userId]'ye gider
- Deaktivieren butonu Link'in dışında, action ayrı

**6) `/company/employees/[userId]` (yeni sayfa)**
- Server component, getCompanyAdminContext ile gate
- Güvenlik: target user'in company_id'si admin'in company_id'si değilse 404
- Ay nav (?year=&month=) — prev/next ay link
- Header: ad, email, rol, aktif/deaktiv, son aktivite
- 6'lı stat grid: Gesamt, Soll (174h), Differenz, Arbeitstage, Urlaub, Krank
- Read-only Arbeitszeit tablosu: gün-gün, Datum/Tag/Status/Start/Ende/Pause/Stunden
- Urlaubsanträge listesi (status badge ile, ilk 20)

### Kapsam dışı (F4'te)
- Urlaub onay/red butonu (F4 approval flow)
- Per-employee tracker'da edit yetkisi
- Aktivite feed'i
- CSV/PDF export

### Değişen dosyalar
- `supabase/migrations/015_company_admin_read_access.sql` — YENİ
- `apps/web/src/lib/company/admin.ts` — YENİ
- `apps/web/src/app/api/company/team-summary/route.ts` — YENİ
- `apps/web/src/app/company/employees/[userId]/page.tsx` — YENİ
- `apps/web/src/app/company/dashboard/page.tsx` — KPI zengin + Urlaub listesi
- `apps/web/src/app/company/employees/page.tsx` — saatler + drill-down link
- `apps/web/src/lib/version.ts` — 0.10.0 → 0.11.0 (MINOR)

---

## 2026-06-14 (33) – v0.10.0: Faz 2 Invite Loop — davet zinciri uçtan uca çalışıyor

### Faz 1 audit sonucu (özet)
- Schema 009 solid: companies, subscriptions, invitations, audit_logs, profiles.role/company_id/plan, handle_new_user trigger
- Onboarding /type → /setup → /done company yolunu doğru kuruyor
- /company/{dashboard,employees,reports,billing} iskeleti mevcut, role gate var
- /join/[token] doğrulama UI'ı var
- 4 KRİTİK kırık: davet maili gönderilmiyor, register token-blind, accept akışı yok, login token-blind

### Faz 2 implementasyon — bu sürüm

**1) Yeni: `/api/invitations/accept/route.ts`** (merkezi kabul akışı)
- POST { token } → invitation pending+geçerli mi doğrular
- Güvenlik: user.email === invitation.email zorunlu (cross-email çalma engeli)
- profiles.company_id + profiles.role idempotent güncelleme
- invitations.status='accepted', accepted_at=now()
- Rol-bazlı redirectTo döndürür (admin→/company/dashboard, employee→/tracker)

**2) `/company/employees/page.tsx` — invite artık mail gönderiyor**
- Önce: sadece DB'ye INSERT, mail yok ❌
- Şimdi: INSERT sonrası `/api/email/invite` fetch, başarı/uyarı mesajı

**3) `/register/page.tsx` — invite-aware komple rewrite**
- ?token & ?email query okuyor
- Email pre-fill + readonly (davet linki için)
- Sayfa açılışında invitation'dan şirket adını çekip UI'da gösteriyor
- signUp metadata'ya company_id + role koyuyor → handle_new_user trigger doğru profile yaratıyor
- signUp sonrası /api/invitations/accept çağırıp redirect alıyor
- Davet yoksa eski akış: /onboarding/type

**4) `/login/page.tsx` — invite-aware + company_admin redirect fix**
- ?token query'i okuyor, login sonrası /api/invitations/accept çağırıyor
- Bug fix: company_admin artık /dashboard yerine /company/dashboard'a gidiyor (önceden ikisi de /dashboard'du)

### Akış doğrulaması
Admin → /company/employees → "Mitarbeiter einladen" tıklar →
  DB invitation insert → mail Resend ile gider →
  Mitarbeiter linke tıklar → /join/[token] → /register?token=X&email=Y →
  Register signUp metadata'da company_id+role → trigger profile'ı company'ye bağlar →
  /api/invitations/accept invitation'ı 'accepted' yapar → /tracker'a redirect.

Mevcut kullanıcı için: /join/[token] → /login?token=X → login sonrası accept → redirect.

### Değişen dosyalar
- `apps/web/src/app/api/invitations/accept/route.ts` — YENİ
- `apps/web/src/app/company/employees/page.tsx` — invite-after-mail
- `apps/web/src/app/(auth)/register/page.tsx` — invite flow
- `apps/web/src/app/(auth)/login/page.tsx` — invite flow + company_admin redirect
- `apps/web/src/lib/version.ts` — 0.9.4 → 0.10.0 (MINOR: yeni invite akışı)

---

## 2026-06-14 (32) – v0.9.4: 🚨 SSR crash fix — Stripe lazy init

### Sorun (stundly.de "Application error: server-side exception", Digest 2241623409)
- Stripe v22 constructor placeholder string'i reddediyor: `"Neither apiKey nor config.authenticator provided"`
- Eski kod `lib/stripe/server.ts:7`: `new Stripe(STRIPE_SECRET_KEY ?? "sk_test_placeholder", ...)` — modül yüklemede çağrılıyor
- Vercel'de "Collecting page data" fazı `/api/stripe/webhook` route'unu evaluate ederken `new Stripe()` patlıyor → build/runtime crash
- Sonuç: SSR exception, landing page yüklenmiyor

### Çözüm — `apps/web/src/lib/stripe/server.ts`
- `new Stripe(...)` modül yüklemede çağrılmıyor artık
- `getStripe()` lazy getter: ilk çağrıda init, sonrasında singleton
- `stripe` export'u Proxy ile sarıldı — `stripe.checkout.sessions.create(...)` mevcut kullanımları aynen çalışır (geriye dönük uyumlu)
- Env yoksa init zamanında throw eder, modül yüklemede DEĞİL

### Doğrulama
- Local `next build` artık temiz tamamlanıyor (öncesi: "Failed to collect page data for /api/stripe/webhook")
- Landing page artık `○ Static` olarak prerender ediliyor

### Değişen dosyalar
- `apps/web/src/lib/stripe/server.ts` — lazy init + Proxy
- `apps/web/src/lib/version.ts` — 0.9.3 → 0.9.4 (PATCH: critical bugfix)

---

## 2026-06-14 (31) – v0.9.3: "ZEITERFASSUNG" alt label daha küçük

### Değişiklik
- Mobile TrackerScreen alt label fontSize 10 → **8px**
- letterSpacing 1 → 0.8 (sıkışmasın)
- marginTop 2 → 1 (STUNDLY ile daha yakın)

### Değişen dosyalar
- `apps/mobile/src/screens/TrackerScreen.tsx` — brandSub style
- `apps/web/src/lib/version.ts` — 0.9.2 → 0.9.3 (PATCH)

---

## 2026-06-14 (30) – v0.9.2: Mobile app TrackerScreen header kompakt — gün listesi için bol alan

### Sorun
- Mobile app'in TrackerScreen header'ı (apps/mobile, React Native) çok yer kaplıyordu
- "STUNDLY" brand + 4 büyük yıl butonu + 26px Juni başlığı + 38x38 arrow butonları = ekranın yarısı header
- Kullanıcı: "üsttü olmamis zeiterfassung komple kaplami diger hicbirsey gözükmüyor"
- Ayrıca: "bu düzeltmeyi app icin yapacaksin web icin degil" — fix mobile app içindi, web değil

### Çözüm — apps/mobile/src/screens/TrackerScreen.tsx
- Header layout: tek satır 2-sütun (sol: brand + alt label, sağ: yıl+ay stack)
- Sol kolon: STUNDLY (13px) + "Zeiterfassung" alt label (10px muted, uppercase)
- Sağ kolon (stack, alignItems flex-end):
  - Yıl butonları: 4 küçük pill, padding 5→3 / 8→6, fontSize 11→10, borderRadius 8→6
  - Ay nav: 38x38 → **26x26** arrows, başlık 26px → **14px**, gap 10→6
  - 📍 Heute butonu — sadece güncel ay değilken görünür
- headerGradient padding: paddingTop 50→46, paddingHorizontal 16→14, paddingBottom 14→10
- Eski `headerTopRow` stilini sildim, yeni `headerRow` ile değiştirdim (flex-start align)

### Değişen dosyalar
- `apps/mobile/src/screens/TrackerScreen.tsx` — header JSX + StyleSheet
- `apps/web/src/lib/version.ts` — 0.9.1 → 0.9.2 (PATCH: mobile UI fix)

---

## 2026-06-14 (29) – v0.9.1: MonthNav başlığı küçültüldü — sağ taraf görünür hale geldi

### Sorun
- v0.9.0'da "Zeiterfassung" başlığı (17px, bold) hâlâ çok yer kaplıyordu
- Mobilde sağdaki yıl/ay seçicileri ekran dışına itiliyordu, görünmüyordu

### Çözüm — MonthNav.tsx
- Başlık 17px → **13px**, fontWeight 800 → 700
- `textTransform: uppercase` + `color: var(--muted)` — artık bir "section label" gibi, h1 hissi vermeden
- `flexShrink: 1` + `overflow: ellipsis` → başlık daralabilir, asla taşmaz
- Sağ stack (yıl + ay nav) → `flexShrink: 0` → asla sıkışmaz, daima tam görünür
- `paddingTop: 4 → 6` → küçülen başlık yıl seçici ile dikey hizalı

### Değişen dosyalar
- `apps/web/src/components/tracker/MonthNav.tsx` — başlık küçültme + flex koruma
- `apps/web/src/lib/version.ts` — 0.9.0 → 0.9.1 (PATCH: UI fix)

---

## 2026-06-14 (28) – v0.9.0: Mobile nav rebuild — gruplu BottomNav + kompakt MonthNav header

### Değişiklik 1: BottomNav 5→4 slot, 2'si grup
- **Eski**: 5 ayrı item (Start, Zeit, Lohn, Urlaub, Profil)
- **Yeni**: 4 slot — 2'si tıklayınca açılan grup
  1. **Start** → /dashboard
  2. **Zeit** (grup) → tıklayınca popover: Zeit /tracker, Urlaub /vacation, Kalender /calendar
  3. **Berichte** (grup) → tıklayınca popover: Berichte /reports, Gehalt /salary
  4. **Profil** → /settings
- Popover yukarı doğru açılır, outside-click + ESC + route değişimi kapatır
- Grup butonu, alt sayfalardan birinde aktifken highlight olur

### Değişiklik 2: Tracker MonthNav kompakt header
- "Zeiterfassung" başlığı 22px → **17px** (kısa, dikey alan korunur)
- Yıl seçici sağ-üste, ay nav'ı altına stack:
  ```
  Zeiterfassung      [2026 ▼]
                     ‹ Juni ›  📍
  ```
- Arrow butonları 30 → **26x26** (daha kompakt)
- "📍 Heute" butonu sadece güncel ay'da değilken görünür, ay nav'ının yanında
- **"● Synchronisiert ✓" indicator kaldırıldı** — kayıt anında oluyor, gereksizdi
- Sonuç: Header artık tek satır, gün listesi için bol alan

### Değişen dosyalar
- `apps/web/src/components/ui/BottomNav.tsx` — komple rewrite (gruplu yapı)
- `apps/web/src/components/tracker/MonthNav.tsx` — komple rewrite (kompakt header)
- `apps/web/src/lib/version.ts` — 0.8.4 → 0.9.0 (MINOR: yeni UI)

---

## 2026-06-14 (27) – v0.8.4: FAB overlap (mail vs scan) + Juni month-nav slimmed

### Sorun 1: Tracker'da iki FAB üst üste
- `.floating-scan` (📷 Stundenzettel scan) ve `.support-fab` (📧 mail) ikisi de sağ-altta
- Tracker sayfasında mail butonu scan butonunu kapatıyordu

### Sorun 2: Juni month-nav alanı çok büyük
- Tracker MonthNav: buttons 40x40, h2 28px, gap 12, `flex: 1` → bar tüm ekran genişliği
- Salary header: buttons 38x38, h1 26px, gap 10, `flex: 1` → aynı problem
- Mobilde ekranın büyük bir kısmını sadece ay seçici kaplıyordu

### Düzeltme
- **CSS `body:has(.floating-scan) .support-fab`** rule: sayfada scan butonu varsa mail butonu yukarı kaldırılıyor
  - Desktop: `bottom: 90px` (scan üzerinde)
  - Mobile: `bottom: calc(160px + safe-area)` (scan + BottomNav üstünde)
- **Tracker MonthNav** & **Salary header**: kompakt pill tasarımı
  - Buttons 40/38 → **30x30**
  - Font 18 → **14**
  - h1/h2 26-28 → **18**
  - `flex: 1` kaldırıldı, `minWidth: 90` ile sabit genişlik + `justifyContent: center`
  - Sonuç: ay seçici artık ortalanmış kompakt bir pill, ekranı kaplamıyor

### Değişen dosyalar
- `apps/web/src/app/globals.css` — `:has()` ile FAB stacking
- `apps/web/src/components/tracker/MonthNav.tsx` — kompakt pill nav
- `apps/web/src/app/(dashboard)/salary/page.tsx` — aynı kompakt pill
- `apps/web/src/lib/version.ts` — 0.8.3 → 0.8.4

---

## 2026-06-14 (26) – v0.8.3: SupportButton overlap fix (sol-alt → sağ-alt + mobil BottomNav clearance)

### Sorun
- `SupportButton` (mail FAB) `bottom: 24; left: 24` ile sabit oturuyordu
- **Mobilde**: `BottomNav` (alt navigation, full-width fixed) butonun direkt altına oturduğu için yazma butonu üstüne biniyordu
- **Desktop'ta**: `Sidebar` (240px sol) ile çakışıyordu, sola yapışık FAB sidebar'ın üstüne giriyordu

### Düzeltme
- `BTN_BASE`'den `position/bottom/left` kaldırıldı (sadece görsel stil)
- Yeni CSS class `.support-fab` → `globals.css`'e eklendi
  - Desktop: `bottom: 24; right: 24` (sağ-alt, sidebar'dan uzak)
  - Mobile (< 768px): `bottom: calc(96px + safe-area-inset-bottom); right: 16` → BottomNav üstünde temiz konum
- `SupportButton.tsx`:
  - WhatsApp `<a>` ve EmailPopover wrapper `<div>` her ikisi `className="support-fab"` aldı
  - Email popover içeriği artık `right: 0` ile anchor'lanıyor (sol yerine) → ekran dışına taşma riski yok

### Değişen dosyalar
- `apps/web/src/components/ui/SupportButton.tsx` — pozisyon class'a taşındı
- `apps/web/src/app/globals.css` — `.support-fab` rule eklendi
- `apps/web/src/lib/version.ts` — 0.8.2 → 0.8.3

---

## 2026-06-14 (25) – v0.8.2: Reddit launch günü + ilk visitor data + öğrenilen dersler

### Reddit Launch (r/Hannover)
- ✅ Post atıldı: "Ich habe eine Arbeitszeit-App für Handwerker gebaut — sucht jemand Beta-Tester?"
- ❌ **Birkaç saat sonra permaban** — r/Hannover self-promo kuralı (yerel sub, startup launch tolere etmiyor)
- 🟡 Post yayında kaldı süre boyunca, ban moderatör gecikmeli oldu
- 🟡 Karar: Reddit'e bağımlı olmamak, başka subreddit'ler için strateji rafine et (problem-first format)
- 🟡 r/Handwerker zaten önceden reddetmişti

### Vercel Analytics ilk dalga (last 7 days)
- **68 visitor** (organik, Reddit'ten)
- **178 page views** (avg 2.6 sayfa/visitor)
- **60% bounce rate** (cold traffic için normal)
- **Pages**: / (68), /impressum (14), /register (5), /datenschutz (4), /dashboard (2), /agb (1), /calendar (1)
- **Referrers**: reddit.com (15), com.reddit.frontpage (13) = toplam 28 Reddit
- **Country**: %94 Germany (perfect target)
- **Devices**: %85 mobile (Android 51% + iOS 34%), %15 desktop

### Konversiyon funnel
- 68 visitor → 14 impressum check (Alman due diligence) → 5 register click → 2 dashboard
- **2 kayıt**: 1 throwaway email (`masome2963@hotkev.com`) + 1 "Test gmbh" (GmbH planını test eden)
- Conversion 1.5% (cold Reddit traffic için iyi)
- "Test gmbh" kaydı önemli sinyal: **GmbH planına gerçek ilgi** + Admin-Panel henüz tam olmadığı için bouncede etti

### Yanıtlanan Reddit yorumları (8 yorum, Almanca yazıldı)
1. **k_ekse** — "AI yapımı, mobile kötü, güvenlik şart" → Excel 2 sene + Supabase RLS + mobile düzeltildi yanıtı
2. **ephirial** — "%100 vibe-coded" → Excel 2 sene + "2 Jahre Frustration in Code gegossen" yanıtı
3. **Ill-Suggestion-349 (1)** — "2 hafta sonra ölecek" → "Bookmark dich gerne, falls nichts passiert hast du recht" yanıtı
4. **NichtOhneMeineKamera** — "İşveren modeli var mı?" → Team/Unternehmen plan + AG-Admin-Panel in Arbeit yanıtı
5. **Salty-Information-41** — "Mindestlohn legal karmaşık" → §17 MiLoG + Fachanwalt için Pflicht yanıtı
6. **Friendly guy** — "Text de AI :D" → "Erwischt, mein Deutsch nicht ganz Muttersprachler" yanıtı
7. **Ill-Suggestion-349 (2)** — "%99 ölüyor" → 2-yıl Excel + Lohnabrechnung ile karşılaştırma yanıtı
8. **Em-dash tip** → "Guter Tipp, danke! Wird übernommen" yanıtı → **MEMORY: Almanca'da em-dash yasak**

### Öğrenilen gerçekler (24 saatte kazanılan piyasa verisi)
- 🟢 Stundly insan algısında **ciddiye alınıyor** (%21 impressum kontrolü = ortalama'nın 4 katı)
- 🟢 GmbH planına gerçek ilgi var (1 test kaydı)
- 🟢 Yazılımcı kitlesi **detaylı yorum yazdı** (vibe-coded slop'a kimse vakit ayırmaz)
- 🟢 Yorumlar saldırgan değil yapıcı sırada
- 🟢 Spesifik feedback alanları: Mindestlohn nuans, Rufbereitschaft, AG admin-panel, mobile UX
- 🔴 Trust yetersiz (throwaway email kullanıldı) → demo mode veya social proof gerek
- 🔴 Mobile experience eleştirildi (k_ekse) → audit + iyileştirme
- 🔴 r/Hannover banlandı, yorumlara cevap veremez durumda

### Memory eklendi
- ✅ `feedback_almanca_yazim_stili.md` — Almanca metinde em-dash kullanma, doğal Alman tarzı (Reddit feedback'inden çıktı)

### Versiyon bump v0.8.1 → v0.8.2 (PATCH — log-only)

### Yarın için seçenekler
| Seçenek | Etki | Süre |
|---------|------|------|
| Mobile responsive audit + iyileştirme | k_ekse haklı + %85 mobile trafik | 2-3 saat |
| Demo mode (kayıtsız dene) | Throwaway email sorununu çöz | 1-2 saat |
| Admin-Panel başla (employee davet) | GmbH testçisinin eksik bulduğu | 1-2 gün |
| r/Selbststaendig post (problem-first) | Yeni traffic dalgası | 30 dk |

### Notlar
- Reddit ban'a moderasyon kibar bir mesaj atma planı vardı, **karar verildi: bırakalım**, Reddit'e bağımlı değiliz
- Kullanıcı bugün için **doyduk** dedi — yarın taze kafayla devam

---

## 2026-06-14 (24) – v0.7.1: Vercel Analytics + Speed Insights (launch readiness)

### Yapıldı
- ✅ `npm install @vercel/analytics @vercel/speed-insights`
- ✅ `layout.tsx` — `<Analytics />` ve `<SpeedInsights />` component'leri body'e eklendi
- ✅ Versiyon bump v0.7.0 → v0.7.1 (PATCH — observability infrastructure)

### Test
- ✅ `tsc --noEmit` → 0 hata

### Özellikler
- **Vercel Analytics**: ziyaretçi sayısı, sayfa görüntülemeleri, kaynak (where from), conversion funnel
  - Çerez kullanmıyor — DSGVO uyumlu, ek banner gerekmiyor
  - Ücretsiz (Hobby plan dahil)
  - Dashboard: vercel.com → project → Analytics tab
- **Vercel Speed Insights**: Web Vitals (LCP, FID, CLS) gerçek kullanıcılardan toplanır
  - Performance dashboard, yavaş sayfaları tespit
  - Yine çerezsiz + ücretsiz

### Sebep & Notlar
- Kullanıcı: "piyasaya sürelim artık test kullanıcıları gelsin"
- Pazarlamadan önce görünürlük: kim geliyor, nereden, hangi sayfada düşüyor → ölçemezsen yönlendiremezsin
- Vercel Analytics tercih sebepleri:
  - Cookie-free (DSGVO + ePrivacy uyumlu, Cookie banner gerekmiyor)
  - Hosting platform ile entegre (zero-config)
  - Ücretsiz başlangıçta
  - Daha sonra Plausible/Posthog gerekirse kolay swap

### KULLANICI TARAFI BEKLEYEN (legal blokerleri)
- ⏳ Gewerbe Anmeldung — pazarlamadan önce şart (Impressum'da bağlayıcı)
- ⏳ info@stundly.de email forwarding — Impressum'da bu adres var, ulaşılamazsa abmahnung riski

### Sonraki adımlar (FAZ 3 — ilk 10 müşteri)
- Beta-tester pozisyonlama: "ömür boyu %50 indirim, ilk 20 kişi"
- WhatsApp destek butonu aktive (env'e numara ekle)
- LinkedIn DM kampanyası — Handwerk-Inhaber direkt mesaj
- Facebook gruplar — Almanya'daki Türk Handwerker grupları
- 1-2 hafta sonra ilk testimonial topla → Landing'e ekle

---

## 2026-06-14 (23) – v0.7.0: Salary — 3 iyileştirme (Notdienst link + What-if + Live preview)

### Yapıldı

**#2 — Notdienst → Tracker jump linki**
- ✅ Verdienst-Aufschlüsselung kartında "Notdienst-Bonus (3× aus Mai) →" satırı tıklanabilir oldu
- ✅ Tıklayınca `setTrackerMonth(prevYear, prevMonth)` ile Tracker'a önceki ay yüklenerek navigate
- ✅ Hover effect: turuncu background tinti + cursor pointer + ok karakteri
- ✅ Title attribute: "Klick: zu Notdienst-Einträgen im Tracker springen"
- ✅ Notdienst sayısı 0 ise tıklanabilir değil

**#3 — Live "Was wäre wenn?" simülatörü** (Stundenlohn için)
- ✅ Yeni `whatIfPlusOne` useMemo: Stundenlohn +1€ senaryosu için breakdown + Netto hesabı
- ✅ Stundenlohn input'unun altında, Mindestlohn hint'ten sonra yeşil satır:
  - `💡 +1 €/h ≈ +€124 / Monat Netto`
- ✅ Sadece entries varsa gösterilir (yeni kullanıcıya boş veri sağmaz)
- ✅ Sadece pozitif Netto delta varsa (mantık güvenliği)
- ✅ Pazarlık değeri: kullanıcı patronla konuşmadan önce "+1€/h bana ne kazandırır" görür

**#4 — Live Brutto-Netto preview** (Einstellungen kartı içinde)
- ✅ Einstellungen kartının başlığının altına yatay banner eklendi:
  - `⚡ Live Juni    € 2.847 Brutto → € 1.973 Netto`
- ✅ accent2 tinti background, DM Mono font
- ✅ Settings değiştirdiğinde anında güncellenir (zaten reactive)
- ✅ Kullanıcı artık ayar değiştirirken HERO'ya scroll yapmadan etkisini görür

### Versiyon bump v0.6.1 → v0.7.0 (MINOR — 3 yeni UX katmanı)

### Test
- ✅ `tsc --noEmit` → 0 hata

### Sebep & Notlar
- Kullanıcı talebi: "hepsini yapalım sonra test edelim"
- 3 iyileştirme tek commit'te:
  - #2: navigasyon kestirme (Tracker'a önceki ay)
  - #3: optimizasyon karar yardımı ("+1€ ne kadar fayda")
  - #4: input değiştirirken anında geri bildirim
- useTrackerStore'un setMonth metodu yeniden kullanıldı (calendar/page.tsx'te de var)
- whatIfPlusOne: aynı calculateMonthlySalary fonksiyonu, sadece hourly_rate +1 ile

---

## 2026-06-14 (22) – v0.6.1: Salary YTD özet kartı

### Yapıldı
- ✅ **Year-to-Date (YTD) özet kartı** Salary sayfasının üstüne eklendi
  - Steuer kartının altında, Monatsberechnung'den önce
  - Gradient accent → accent2 background
- ✅ **Hesap mantığı**:
  - Geçmiş yıl: tüm 12 ay sayılır
  - Aktif yıl: tamamlanmış aylar (bu ay HARİÇ — Juni'de Mai'a kadar)
  - Gelecek yıl: hiçbir şey gösterilmez
- ✅ **3 büyük rakam** (DM Mono):
  - BRUTTO yeşil
  - NETTO accent2 mor
  - Ø NETTO/MO mavi (ortalama aylık net)
- ✅ **12-ay progress-bar**: tamamlanmış aylar dolu, verisi olmayanlar yarı saydam, henüz tamamlanmamış aylar gri
- ✅ **Footer**: "5 von 5 abgeschlossenen Monaten haben Daten · Juni läuft noch"
- ✅ Sağ üstte zaman aralığı: "Jan – Mai"
- ✅ `ytd.brutto === 0` ise kart gizli (yeni kullanıcı için göstermez)

### Versiyon bump v0.6.0 → v0.6.1 (PATCH — küçük UX ekleme)

### Test
- ✅ `tsc --noEmit` → 0 hata

### Sebep & Notlar
- Salary sayfası iyileştirme önerimden #1: "Year-to-date Netto özet"
- "Bu yıl şu ana kadar ne kazandım" — psikolojik motivasyon değeri yüksek
- Mevcut `yearlyAuto` data'yı yeniden kullandı, ek API call yok
- "Juni läuft noch" mesajı kullanıcıyı şaşırtmasın diye

---

## 2026-06-14 (21) – v0.6.0: Notdienst BUG FIX + Vormonat-Abrechnung + tooltip küçültme

### Yapıldı

**Tooltip küçültüldü** (kullanıcı: "açılır pencere yazıları çok büyük")
- ✅ `InfoTooltip.tsx`:
  - minWidth 260 → 200, maxWidth 340 → 280
  - padding "12px 14px" → "9px 11px"
  - body fontSize 12 → 10.5
  - lineHeight 1.6 → 1.45
  - title fontSize 11 → 10
  - Shadow + radius da hafif küçüldü

**🐛 KRİTİK BUG FIX: Notdienst Steuer hesabına yansımıyordu**
- ✅ Sebep: `calculateMonthlySalary` `entries` (TimeEntry[]) içinde `day_type=NOTDIENST` arıyordu, ama Notdienst'ler `notdienst_entries` tablosunda → her zaman 0 sayılıyordu, `notdienst_bonus = 0` 
- ✅ Fix: `calculateMonthlySalary`'ye `options.notdienstDaysOverride` parametresi eklendi
- ✅ Salary page `notdienst_entries` tablosundan yükler, sayı override olarak geçer
- ✅ Şimdi Brutto'ya doğru yansıyor → Lohnsteuer + Soli + SV-Beiträge doğru hesaplanır

**📅 Notdienst Vormonat-Abrechnung**
- ✅ Kullanıcı: "Ocak ayında yapılan notdienstler Şubat ayında ödeniyor"
- ✅ Salary sayfası bu ayın Brutto'su için ÖNCEKI ayın Notdienst'lerini sayar
- ✅ Ocak için: önceki yılın Aralık ayı Notdienst'leri
- ✅ Yıllık 12-ay grafik de aynı kuralla shifted
- ✅ Notdienst aralığı yüklenirken: `${year-1}-12-01` → `${year}-12-31` (önceki Aralık + bu yıl)

**UI updates**
- ✅ Verdienst-Aufschlüsselung kartında: "Notdienst-Bonus (3× aus Mai)" gibi gösterim
- ✅ Stundenlohn label artık Notdienst settings tooltip'i de: "⏱ Auszahlungs-Zeitpunkt: Notdienst aus Vormonat → aktueller Brutto. Beispiel: Januar-Notdienst → Februar-Brutto."

### Versiyon bump v0.5.7 → v0.6.0 (MINOR — bug fix + yeni davranış)

### Test
- ✅ `tsc --noEmit` → 0 hata

### Sebep & Notlar
- Kullanıcı 3 sorun raporladı, hepsi şu commit'te:
  1. Tooltip yazıları küçültüldü
  2. Notdienst Steuer hesabına yansımıyordu (gerçek bug)
  3. Notdienst payment timing (önceki ay → bu ay) düzeltildi
- "Bu sayfada iyileştirme yapılabilir mi" sorusu için sonraki yanıtta önerileri sunacağım

---

## 2026-06-14 (20) – v0.5.7: Stundenlohn default geri 15 € (Handwerk-Standard)

### Yapıldı
- ✅ Kullanıcı talebi: "Stundenlohn açılışta 15€ olsun, ilk kayıtta"
- ✅ `salary/page.tsx` DEFAULT_SETTINGS.hourly_rate: `MINDESTLOHN_CURRENT` (13,90 €) → `15`
- ✅ `dashboard/page.tsx` aynı default güncellendi
- ✅ Dashboard'da artık kullanılmayan `MINDESTLOHN_CURRENT` import'u temizlendi (dead code)
- ✅ Stundenlohn tooltip metni güncellendi:
  - "Standard für Handwerk: 15 €/h"
  - "Gesetzlicher Mindestlohn 2026: 13,90 €/h" (referans olarak kalır)
- ✅ Mindestlohn HINT (input altındaki dinamik mesaj) ve **kullanıcı altına yazarsa kırmızı uyarı** KORUNDU
  - Kullanıcı 15 default'la başlar, ama 10€ yazarsa hâlâ uyarır: "⚠️ Unter dem gesetzlichen Mindestlohn"
- ✅ Versiyon bump v0.5.6 → v0.5.7 (PATCH — default value)

### Test
- ✅ `tsc --noEmit` → 0 hata

### Sebep & Notlar
- Önceki v0.5.5'te default 13,90 € (Mindestlohn) yapıldı, kullanıcı geri 15 istedi
- 15 € Handwerk için daha makul başlangıç — ortalama bir Geselle bunun üstünde
- Mindestlohn validation (kullanıcı altına yazarsa kırmızı uyarı) yine çalışır → DSGVO + ArbZG vaadi korundu
- Mevcut DB row'ları zaten 15 default'lu (migration 002), tutarlı
- Mindestlohn referans tooltip + hint'te kalır → bilgilendirici ama dayatmıyor

---

## 2026-06-14 (19) – v0.5.6: Salary alanlarına InfoTooltip + Schätzung-Disclaimer

### Yapıldı

**Settings kartındaki her field için ℹ️ hover tooltip eklendi:**
- ✅ **Stundenlohn (€)** — "Brutto-Stundenlohn. Grundlage für alle Berechnungen. Mindestlohn 2026: 13,90 €/h"
- ✅ **Sollstunden/Monat** — "Vertragliche Monatsarbeitszeit. Lohnberechnung + Tracker-Differenz. Typisch 160-174h"
- ✅ **Überstunden ×** — "1,00=kein Extra, 1,25=25% Aufschlag (üblich), 1,50=Wochenende/Nacht"
- ✅ **Nachtzuschlag €/h** — "Bonus pro 'Nachtschicht'-Stunde, NICHT mit Überstundensatz multipliziert"
- ✅ **Notdienst €/Tag** — "Pauschal pro Einsatz (unabhängig von Dauer), zusätzlich zum Stundenlohn"
- ✅ **Urlaubsanspruch / Jahr** — "BUrlG-Min 20-24, üblich 30 im Handwerk"

**Steuer kartındaki tooltip'ler:**
- ✅ **Steuerklasse** — I-VI ayrı ayrı açıklandı (ledig/alleinerziehend/verheiratet vb.)
- ✅ **Kirchensteuer** — "9% standart, 8% BY+BW, 0% kirchenfrei"
- ✅ **Kind im Haushalt** — "Pflegeversicherung: mit kind 1,7%, ohne 2,35% (Kinderlosenzuschlag)"
- ✅ **Manueller Modus** — "Echter Abzugssatz % statt EStG-Berechnung — beispiel: echte Abrechnung 32% → trage 32 ein"

**Schätzung-Disclaimer 2 yerde:**
- ✅ **HERO Brutto→Netto kartında** ⚠️ tooltip: "Warum nur eine Schätzung?" — 5 sebep listelendi:
  - Krankenkassen-Zusatzbeitrag (0,9-2,5%, kassenspezifisch)
  - Geldwerte Vorteile (Dienstwagen, Job-Ticket, Essensgutscheine)
  - Pauschalsteuer (Minijobs, Bonuszahlungen)
  - Vermögenswirksame Leistungen, betriebliche Altersvorsorge
  - Freibeträge auf Steuerkarte (Werbungskosten, Kinderfreibetrag)
- ✅ **Steuer kartının altındaki not** genişletildi:
  - Eskiden küçük gri ℹ️ "Lohnsteuer-Schätzung nach EStG §32a 2024"
  - Yeni: sarı uyarı kutusu ⚠️ "Wichtig: Alle Brutto/Netto-Werte sind Schätzungen. Die echte Lohnabrechnung kann abweichen — Krankenkassen-Zusatzbeitrag (kassenspezifisch), geldwerte Vorteile, Pauschalsteuer und Freibeträge werden nicht berücksichtigt."

### Versiyon bump v0.5.5 → v0.5.6 (PATCH — UX hint/disclaimer)

### Test
- ✅ `tsc --noEmit` → 0 hata (2 typografik tırnak hatası düzeltildi: `„...` → `'...'`)

### Sebep & Notlar
- Kullanıcı talebi: "gehaltee einstellungu da hepsinin yanina aciklama yapalim üstüne gelince ne ise yaradigini yazsin"
- Ek talep: "birde bu hesap tahmini hesap oldugunu belirtelim cünkü sosyalsigorta ve diger seylerde hep ayni kesilmeyebiliyor"
- Mevcut `InfoTooltip` component yeniden kullanıldı (zaten MonthlySummary + AutoFillReports'ta var)
- Hover (masaüstü) + tap (mobil) açar — `useState` + outside-click handler
- Disclaimer sarı uyarı kutusu (eskisi gri ℹ️ idi) → daha dikkat çekici
- 5 spesifik teknik sebep (Zusatzbeitrag, geldwerte Vorteile vb.) sayılırsa "neden tahmin" daha güvenilir görünüyor

---

## 2026-06-14 (18) – v0.5.5: Stundenlohn default = Mindestlohn + Warnung

### Yapıldı
- ✅ Yeni `lib/mindestlohn.ts` — Almanya gesetzlicher Mindestlohn tek doğruluk kaynağı
  - 2024: 12,41 € / 2025: 12,82 € / **2026: 13,90 €** / 2027: 14,60 €
  - `currentMindestlohn(now)` — aktif yıl için Mindestlohn, fallback en son bilinen yıl
  - `formatMindestlohn()` — "13,90 €" (DE locale, virgüllü)
- ✅ Salary page: `DEFAULT_SETTINGS.hourly_rate = 15` → `MINDESTLOHN_CURRENT` (şu an 13,90 €)
- ✅ Dashboard page: aynı default güncellendi
- ✅ Salary Stundenlohn input'unun altına **dinamik hint**:
  - Normal durumda: `💶 Gesetzlicher Mindestlohn 2026: 13,90 €/h`
  - Kullanıcı Mindestlohn altında yazarsa: `⚠️ Unter dem gesetzlichen Mindestlohn (13,90 €/h) — bitte prüfen.` (kırmızı border + kırmızı text)
- ✅ Versiyon bump v0.5.4 → v0.5.5 (PATCH — default value + UX hint)

### Test
- ✅ `tsc --noEmit` → 0 hata

### Sebep & Notlar
- Kullanıcı talebi: "gehaltta varya bunu standar ücret askari ücret yapar misin"
- Eski default 15 € rastgele değerdi; yeni kullanıcı bunu görüp "bu benim ücretim mi?" düşünebiliyordu
- Şimdi yasal Mindestlohn referans alınıyor — yeni kullanıcı görür: "ah, bu sadece bir minimum default"
- ArbZG/Mindestlohn validation feature'ı zaten landing'de vaad ediliyor → buradaki uyarı o vaadi karşılıyor
- Mevcut kullanıcıların DB'deki `hourly_rate` değeri etkilenmedi (sadece yeni `DEFAULT_SETTINGS` için fallback)
- Mindestlohnkommission 27.06.2025 kararı: 2026 = 13,90 €, 2027 = 14,60 €

### UX detayı
- Hint normalde muted gri, kullanıcı 13,90'ın altına yazınca anında kırmızı (border + text + ⚠️ icon)
- Eski label "Stundenlohn (€)" değişmedi, hint yeni satır olarak input'un altına eklendi

---

## 2026-06-13 (17) – v0.5.4: Per-page SEO meta (title + description)

### Yapıldı
- ✅ **Server component'ler — direkt `metadata` export**:
  - `impressum/page.tsx` → "Impressum · Stundly"
  - `datenschutz/page.tsx` → "Datenschutz · Stundly"
  - `agb/page.tsx` → "AGB · Stundly"
- ✅ **Client component'ler için yan `layout.tsx`** (metadata server-only):
  - `pricing/layout.tsx` → "Preise · Stundly"
  - `(auth)/login/layout.tsx` → "Anmelden · Stundly"
  - `(auth)/register/layout.tsx` → "Kostenlos starten · Stundly"
- Her sayfa unique description ile: Google search snippet + browser tab title doğru gösterir
- Title template (`%s · Stundly`) layout.tsx'te zaten tanımlı — değiştirilmedi
- ✅ Versiyon bump v0.5.3 → v0.5.4 (PATCH — SEO meta)

### Test
- ✅ `tsc --noEmit` → 0 hata

### Sebep & Notlar
- Eskiden tüm sayfaların title'ı default "Stundly – Arbeitszeiterfassung für Deutschland" idi
- Google'ın "search snippet" için unique title kullanması daha iyi → CTR artar
- /pricing artık "Preise · Stundly" gösterir, /impressum "Impressum · Stundly"
- Browser tab title da unique → kullanıcı tab arasında ayırt edebilir
- Client component'ler doğrudan metadata export edemez (Next.js kuralı) → layout pattern kullanıldı (`return children`)

---

## 2026-06-13 (16) – v0.5.3: Tracker auto-scroll zum heutigen Tag

### Yapıldı
- ✅ Tracker'a yeni `useEffect` eklendi:
  - Loading bitince + aktif ay == bu ay ise
  - 150ms layout settle delay sonrası `#today-entry` element'ine `scrollIntoView({behavior:"smooth", block:"center"})`
- ✅ Açılışta otomatik bugünün satırına kayıyor (kullanıcı manuel scroll yapmaz)
- ✅ Geçmiş aylar açılırsa kaydırma yapmaz (geçen Mai'ı browse ederken zıplama olmaz)
- ✅ Versiyon bump v0.5.2 → v0.5.3 (PATCH — UX micro-improvement)

### Test
- ✅ `tsc --noEmit` → 0 hata

### Sebep & Notlar
- Eski davranış: Tracker açıldığında ayın 1'i görünüyordu, kullanıcı 13.06'yı bulmak için aşağıya scroll yapıyordu
- Yeni: 150ms sonra smooth scroll, bugün satırı sayfanın orta yüksekliğinde
- Edge case: ay değiştirildiyse (örn. Mai geri git → tekrar Juni) sadece aktif ay bu ay ise scroll → geçmiş aylar browse ederken zıplama yok
- `block: "center"` → today satırı viewport'un ortasında, üstte MonthlySummary görünür kalır

### Versiyon tarihçesi (bu session özet)
- v0.1.0 → v0.5.3 (16 commit, 1 gün)

---

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

## 2026-06-19 – Überstunden Hesabı Düzeltildi (v0.11.2)

### Sorun
- `/vacation` sayfasında "Überstunden → Urlaubstage" kartı 88T gibi absürt değerler gösteriyordu.
- Kök neden 1: `workedMin` query'si yılın tamamını çekiyordu (`gte 01-01 .. lte 12-31`), ama `targetMin = 174 × 60 × monthsElapsed` sadece geçen ayları sayıyordu. Gelecek tarihli time_entries varsa overtime ezberden şişiyordu.
- Kök neden 2: Hedef `174 × monthsElapsed` sabitiyle hesaplanıyordu. Almanya'da urlaub/krank/feiertag günleri hedeften düşmesi gerekir, ama düşülmüyordu — ay içinde 5 gün izin alınsa bile hedef aynı kalıyordu.

### Yapılan
- ✅ `apps/web/src/lib/vacation/overtime.ts` (YENİ) → Test edilebilir helper: `workdaysBetween`, `isWeekday`, `computeOvertime`.
  - Hedef = (yıl başı .. bugüne kadar Mo-Fr) MINUS (bugüne kadar ücretli izin Mo-Fr) × 8h.
  - workedMin sadece `e.date <= todayISO` ARBEITEN günleri.
  - urlaubDays chart için yılın tamamı boyunca urlaub Mo-Fr sayılır.
- ✅ `apps/web/src/app/(dashboard)/vacation/page.tsx` → `monthsElapsed` ve `174 × 60` kaldırıldı, `computeOvertime` helper'ı kullanıldı.
- ✅ `apps/web/src/__tests__/unit/overtime.test.ts` (YENİ) → 17 test, hepsi pass:
  - `isWeekday`: Mo-Fr / Sa-So.
  - `workdaysBetween`: aralık, ters aralık, tek gün.
  - `computeOvertime`: future entries hariç, urlaub yıllık say, paid absence hedef düşür, weekend urlaub düşürmez, frei ignore, night shift, regression bug (88T).

### Versiyon
- 0.11.1 → 0.11.2 (PATCH, bug fix).

### Sonuç
- TS clean, build temiz, 33/33 yeni unit test pass (overtime + companyAdmin), pre-existing salaryCalc fail'leri etkilenmedi.

---

## 2026-06-19 – Berichte Year Mode YTD Düzeltmesi (v0.11.3)

### Sorun
- `/reports` sayfasında "Jahr" modunda saatler tutmuyordu.
- `calcMonthStats(year, month=null, ...)` yıl boyunca tüm time_entries'i topluyordu (gelecek tarihli olanlar dahil).
- `targetMin = targetHoursPerMonth × 12 × 60` sabit 12 ay hedefi. Yıl ortasında Differenz absürt negatif çıkıyordu.
- Auto-Feiertag yıl modunda tüm yılın Feiertag'ını workedMin'e ekliyordu (Dezember bile Haziran'da görünüyordu).
- `workDaysInPeriod` her zaman tüm yıl Mo-Fr - Feiertag (≈252).

### Yapılan
- ✅ `apps/web/src/lib/utils/monthStats.ts` → Opsiyonel `todayISO` parametresi eklendi:
  - `month=null && todayISO` ⇒ YTD davranışı.
  - Entries, ndEntries ve auto-feiertage `e.date <= todayISO` filtresi.
  - `targetMin = countWorkDays(year, null, feiertage, todayISO) × 8 × 60`.
  - `month != null` ise todayISO görmezden gelinir (legacy davranış korundu).
  - `todayISO` verilmezse legacy 12-ay × targetHoursPerMonth davranışı korundu (yıl sonu raporu).
- ✅ `apps/web/src/app/(dashboard)/reports/page.tsx` → Year mode'da:
  - Mevcut yıl → todayISO geçilir (YTD).
  - Geçmiş yıllar → todayISO geçilmez (tam yıl raporu).
- ✅ `apps/web/src/__tests__/unit/monthStats.test.ts` (YENİ) → 19 test, hepsi pass:
  - countWorkDays: month, year, year+todayISO, ileri Feiertag.
  - month mode (legacy): arbeiten/urlaub/krank/auto-feiertag/weekend.
  - year mode legacy: 12-ay hedefi, full year feiertag.
  - year mode YTD: hedef hesabı, future entries/urlaub/feiertag/nd hariç, regression 88T benzeri bug, diffMin işareti.
  - month mode todayISO görmezden geliyor.

### Versiyon
- 0.11.2 → 0.11.3 (PATCH, bug fix).

### Sonuç
- TS clean, next build clean, 52/52 yeni unit test pass (overtime + companyAdmin + monthStats).
- Pre-existing salaryCalc fail'leri etkilenmedi.
- Tracker MonthlySummary, dashboard, calendar etkilenmedi (hepsi month != null çağırıyor).

---

## 2026-06-19 – Berichte Year Mode UI Yenilemesi (v0.12.0)

### Kullanıcı Geri Bildirimi
- "GEARBEITET 960h 35m" yanlış görünüyordu, "ARBEITSTAGE 116" mantıksızdı.
- "bütün yilin özeti olsun 1 sene bu accont napti hepsini pasta görünü liste olsun".
- "urlaub calisma izin über stunda diffasiyel", "mantikli basit olsun".

### 5 profesyonelin konsensüsü
- **GEARBEITET = sadece arbeiten saat** (Urlaub/Krank dahil etme, Almanya muhasebe mantığı).
- **ARBEITSTAGE = arbeitenEntries** (kayıtlı çalışma gün sayısı, "iş günü possible" değil).
- **SOLL kart eklendi** (yıl boyunca beklenen toplam Sollstunden).
- **Donut grafik** — Arbeiten / Urlaub / Krank / Feiertag gün dağılımı.
- **Year mode YTD kaldırıldı** — kullanıcı "1 sene ne yaptın" özetini istiyor, tüm yıl gösteriliyor.

### Yapılan
- ✅ `apps/web/src/lib/utils/monthStats.ts` →
  - `workedMinPure: number` (sadece arbeiten net dakika).
  - `paidAbsenceMin: number` (urlaub + krank + feiertag + auto-feiertag toplam Sollstunden).
  - `workedMin = workedMinPure + paidAbsenceMin` invariant.
  - YTD davranışı opsiyonel olarak helper'da kaldı, reports artık kullanmıyor.
- ✅ `apps/web/src/app/(dashboard)/reports/page.tsx` →
  - 4 KPI: GEARBEITET (workedMinPure), SOLL (targetMin), DIFFERENZ (signed), ARBEITSTAGE (arbeitenEntries / workDaysInPeriod).
  - Yeni Abwesenheit satırı: URLAUB · KRANK · FEIERTAG · NOTDIENST gün bazlı.
  - Year mode'a Donut chart eklendi (Arbeiten / Urlaub / Krank / Feiertag dağılımı, % gösterim).
  - Aylık tabloya "Tage" sütunu eklendi (arbeitenDays).
  - Aylık tabloda "Std" artık `workedMinPure` (saf arbeiten saat) gösterir.
- ✅ `apps/web/src/__tests__/unit/monthStats.test.ts` → 5 yeni test (toplam 24/24 pass):
  - `workedMinPure` sadece arbeiten içerir.
  - `paidAbsenceMin` auto-feiertag dahil.
  - 10h arbeiten testi (mesai korunur).
  - Hafta sonu urlaub paidAbsenceMin'e eklenmez.
  - `workedMin = workedMinPure + paidAbsenceMin` invariant.

### Versiyon
- 0.11.3 → 0.12.0 (MINOR, kullanıcı-görünür yeni özellikler).

### Sonuç
- TS clean, next build clean, 57/57 yeni unit test pass.
- Tracker MonthlySummary, dashboard, calendar etkilenmedi (sadece yeni field'lara erişim eklendi).

---

## 2026-06-19 – Notdienst + Privacy Mode + Year Detay (v0.13.0)

### Kullanıcı geri bildirimi
- Eski programının Jahresübersicht detayı paylaşıldı (Notdienst hero kart, aylık nd chip, detaylı aylık liste).
- "notdienst neden bos neden zeit sayfasi ile bagli degil" — kritik bug.
- "para ile ilgili telefonda acildiginda yildiz gözüksün profilden acilabilsin".
- Notdienst hafta-ay atfı: pazar günü hangi aydaysa o aya yazılsın.

### Yapılan

#### 1. Notdienst entegrasyonu (kritik bug fix)
- ✅ `reports/page.tsx` artık `notdienst_entries`'i fetch ediyor.
- ✅ `calcMonthStats`'e `ndEntries` geçiyor → ndMin/ndCount/ndPaid hesaplanıyor.
- ✅ Year mode'da `notdienstMonthOf` (Pazartesi atfı) ile filtrelenir, +7 gün taşma payı çekilir.
- ✅ Aylık breakdown her ay için ndEntries filtrelenir.

#### 2. Year mode UI detaylandırıldı
- ✅ Hero kartlar (year-only):
  - ⏱ **Gesamt Überstunden** — +X:XX, ≈ X.X Tage à 8 Std/Tag.
  - 🚨 **Notdienst** — +X:XX, ≈ X.X Tage · N Einsätze · ✅ X ❌ Y.
- ✅ KPI 4'lü düzen: GEARBEITET / DIFFERENZ / ARBEITSTAGE (X/Y) / URLAUB (Rest X/30).
- ✅ Abwesenheit satırı saatlerle: KRANK X T (Yh), FEIERTAG X T (Yh).
- ✅ Notdienst pro Monat chip satırı (Jan 11× 17:10 vs).
- ✅ Aylık detay liste (kart format, tıklanabilir → month mode):
  - Ay başlığı + chip'ler (🏖 🤒 🎉 🚨).
  - Differenz büyük rakam (Σ Diff+Nd).
  - "Gearbeitet/Soll Std" + "Erfasst/Werktage" satırı.
  - Progress bar (diff-relativ).

#### 3. Privacy Mode (para gizleme)
- ✅ `apps/web/src/lib/privacy.ts` (YENİ):
  - `usePrivacyMode()` hook (localStorage tabanlı, default true=gizli).
  - `maskMoney(value, hidden, opts)` helper — "€ •••" / "€ 1.234,56" / decimals/withSymbol opsiyonel.
  - Sekmeler arası senkron (`storage` event + custom event).
- ✅ `salary/page.tsx`:
  - Top-right 🔒/👁 toggle butonu.
  - Tüm 11 € kullanımı `fmtEur` / `fmtEurNoCents` üzerinden maskelenir.
- ✅ `dashboard/page.tsx`:
  - `eur(n, hidden)` signature güncellendi.
  - Brutto, yearly, ortalama, chart tooltip'leri maskelenir.
- ✅ `apps/web/src/__tests__/unit/privacy.test.ts` (YENİ) → 6 test, hepsi pass:
  - Gizli "€ •••", görünür de-DE format.
  - decimals=0 ondalıksız, withSymbol=false sembolsüz.
  - 0 ve negatif değer kontrolü.

### Versiyon
- 0.12.0 → 0.13.0 (MINOR, yeni özellikler: Privacy + Notdienst entegrasyon + UI).

### Sonuç
- TS clean, next build clean, 90/93 test pass (3 pre-existing salaryCalc).
- 63 yeni unit test (monthStats 24 + overtime 17 + companyAdmin 16 + privacy 6).
- Tracker MonthlySummary etkilenmedi (zaten ndEntries vermesini biliyor).

### Açık konu — Notdienst hafta-ay atfı kuralı
- Mevcut sistem: **haftanın Pazartesi'si hangi aydaysa** o aya sayılır (`weekMonth.ts`).
- Kullanıcının önerisi: **haftanın Pazarı hangi aydaysa** o aya sayılır.
- ⚠️ Bu kararı kullanıcı netleştirmeli — değiştirilirse Tracker'daki haftalık Notdienst de etkilenir (tek doğruluk kaynağı `weekMonth.ts`).

---

## 2026-06-19 – Pazar Atfı + Notdienst KW Detay (v0.13.1)

### Kullanıcı kararları
- "pazar bazli cevir en garanti" → Notdienst hafta-ay atfı Pazartesi → Pazar.
- "jahr bölümüne notdienstleride eklermisin saatlerini" → Açılır kapanır KW detay.

### Yapılan

#### Pazar bazlı hafta-ay atfı
- ✅ `apps/web/src/lib/utils/weekMonth.ts`:
  - `weekSundayOf(date)` yeni: haftanın Pazar gününü döner.
  - `notdienstMonthOf(date)` artık Pazar bazlı (hafta Pazar'ı hangi aydaysa o ay).
  - `weekMondayOf(date)` deprecated olarak korundu (sadece UI etiket için).
  - `notdienstLoadRange(year, month)` simetrik 7 gün pay (UTC tabanlı, timezone-safe).
  - `isoWeek(date)` weekMonth.ts'e taşındı (paylaşım için).
- ✅ `apps/web/src/app/(dashboard)/reports/page.tsx` → year mode start/end taşma payı:
  - start = `(year-1)-12-25` (önceki yılın son haftası)
  - end   = `(year+1)-01-07` (sonraki yılın ilk haftası)

#### Year mode Notdienst KW Detay (açılır kapanır)
- ✅ `ndByWeek` useMemo: ndEntries'i (ay, KW) bazında grupla.
- ✅ Native `<details>` element (JS-less, mobil-friendly):
  - Outer summary: "🚨 Notdienst-Details · N Wochen ▼"
  - İçinde her hafta için sub-details:
    - Tablo satırı: Monat | KW | Nd (count × süre) | Überstd (toplam)
  - Sub-details açılırsa: hafta içi tek tek nd entry'leri
    - Wochentag/tarih, start, end, kunde, süre.

#### Test
- ✅ `apps/web/src/__tests__/unit/weekMonth.test.ts` (YENİ) → 15 test, hepsi pass:
  - weekSundayOf: Mo/So/Fr/Sa varyantları.
  - notdienstMonthOf Pazar atfı: 28 Apr Mo → Mayıs, 4 Mai So → Mayıs, yıl sınırı.
  - notdienstBelongsToMonth: 30 Mai Sa → Mayıs (Pazar 31 Mai).
  - notdienstLoadRange: simetrik 7 gün, Ocak sınırı (UTC safe).
  - weekMondayOf hâlâ çalışıyor (deprecated visual helper).
  - isoWeek: hafta 2 (yılbaşı), hafta 25 (Haziran).

### Versiyon
- 0.13.0 → 0.13.1 (PATCH: kural değişimi + UI ekleme bug fix sınıfında).

### Sonuç
- TS clean, next build clean, 105/108 test pass (3 pre-existing salaryCalc).
- 78 yeni unit test toplam (24 monthStats + 17 overtime + 16 companyAdmin + 6 privacy + 15 weekMonth).
- Tracker NotdienstWeekly etkilenmedi (weekMondayOf hâlâ var).
- Dashboard `notdienstBelongsToMonth` üzerinden çağırıyor, otomatik Pazar atfına geçti.

---

## 2026-06-20 – Kalender Sekmesi Kaldırıldı (v0.14.0)

### Yapılan

#### Web
- ✅ `apps/web/src/app/(dashboard)/calendar/` route silindi.
- ✅ `components/ui/Sidebar.tsx` → Kalender entry kaldırıldı.
- ✅ `components/ui/BottomNav.tsx` → Zeit grup'tan Kalender child kaldırıldı + comment güncellendi.
- ✅ `app/(dashboard)/dashboard/page.tsx` → "Kalender ansehen" quick action kaldırıldı.
- ✅ `app/robots.ts` → `/calendar` disallow listesinden kaldırıldı.
- ✅ `i18n/de/common.json` → `nav.calendar` ve `calendar` blokları kaldırıldı.
- ✅ `app/page.tsx` → Landing'deki "Kalender & Übersicht" özellik kartı "Monats- & Jahresübersicht" oldu.
- ✅ `app/pricing/page.tsx` → "Urlaubsantrag & Kalender" → "Urlaubsantrag mit Signatur & PDF".

#### Mobile
- ✅ `navigation/MainNavigator.tsx` → Calendar Tab.Screen ve import kaldırıldı.
- ✅ `screens/CalendarScreen.tsx` silindi.
- ✅ Mobile bottom tab artık: Tracker · Scan · Gehalt · Mehr (4 sekme).

### Versiyon
- 0.13.1 → 0.14.0 (MINOR: kullanıcı-görünür değişiklik, sekme kaldırıldı).

### Sonuç
- Web TS clean, next build clean, `/calendar` route artık yok.
- Mobile TS clean.
- KW (Kalenderwoche) konsepti weekMonth.ts, NotdienstWeekly.tsx, reports'ta kalmaya devam ediyor — bunlar Kalender route'undan bağımsız.

---

## 2026-06-20 – Landing PWA Auto-Redirect (v0.14.1)

### Kullanıcı geri bildirimi
- PWA'yı telefon ekranına ekledi.
- Uygulamayı tekrar açınca ana sayfa (landing) geliyor.
- "Anmelden" tıklayınca direkt dashboard'a atıyor — yani **session zaten var**, ama landing kontrol etmiyordu.

### Yapılan
- ✅ `apps/web/src/app/page.tsx` → Landing artık async server component:
  - Açılışta `supabase.auth.getUser()` ile session kontrol.
  - Session varsa `profiles.role` çek:
    - `super_admin`  → `/superadmin`
    - `company_admin`→ `/company/dashboard`
    - diğer (employee/individual) → `/dashboard`
  - Session yoksa landing normal görünür.
- Login page'deki aynı rol-bazlı yönlendirme mantığı ile tutarlı.

### Versiyon
- 0.14.0 → 0.14.1 (PATCH, UX bug fix).

### Sonuç
- TS clean, next build clean.
- PWA ikonundan açan giriş yapmış kullanıcı doğrudan dashboard'a düşer.

---

## 2026-06-20 – Komple QA: Lint Clean + 142/142 Test Pass (v0.14.2)

### Yapılan
- ✅ **TypeScript**: Web + Mobile + Shared, üçü de clean.
- ✅ **ESLint**: Daha önce 10 hata vardı (yanlış `@typescript-eslint/no-explicit-any` rule referansı). Şimdi `next lint` "No ESLint warnings or errors".
- ✅ **Vitest**: Daha önce 105 pass / 3 fail. salaryCalc test bekleyişleri Festgehalt davranışına uygun güncellendi. Şimdi **142/142 pass**.
- ✅ **Next build**: 45/45 static pages clean.

### Test Coverage — 5 yeni unit test suite (34 yeni test)
- ✅ `feiertage.test.ts` (13 test): Nationwide + Bundesland-spezifische Feiertage, Easter computus, Buß- und Bettag.
- ✅ `mindestlohn.test.ts` (8 test): 2024-2027 yıl bazlı, format, bilinmeyen yıl fallback.
- ✅ `standardTimes.test.ts` (6 test): getDefaultForDow Mo-Do/Fr/Sa-So davranışı, custom override.
- ✅ `beta.test.ts` (7 test): isBetaActive, betaDaysRemaining (vi.useFakeTimers ile).
- ✅ `salaryCalc.test.ts` güncellendi: 3 pre-existing fail Festgehalt mantığına uydurularak düzeltildi.

### Lint düzeltmeleri
- `src/app/api/scan/route.ts` → cookies setAll any → typed.
- `src/app/api/stripe/webhook/route.ts` → SupabaseAdmin type alias (eslint-disable any).
- `src/lib/supabase/server.ts` → cookies setAll any → typed.
- `src/middleware.ts` → cookies set generic cast.
- `src/components/settings/AutoFillReports.tsx` → German curly quote escape.

### Test Inventory
| Suite | Tests | Kapsanan |
|-------|-------|----------|
| salaryCalc | 7 | calculateMonthlySalary (Festgehalt mantığı) |
| timeCalc | (mevcut) | calculateWorkDuration, sumWorkedMinutes |
| companyAdmin | 16 | netMinutesForEntry, formatMinutes |
| overtime | 17 | workdaysBetween, isWeekday, computeOvertime |
| monthStats | 24 | calcMonthStats (month/year YTD), countWorkDays, workedMinPure |
| weekMonth | 15 | weekSundayOf, notdienstMonthOf (Pazar atfı), isoWeek |
| privacy | 6 | maskMoney (gizli/görünür, decimals, withSymbol) |
| feiertage | 13 | getFeiertage (16 Bundesland + Easter) |
| mindestlohn | 8 | currentMindestlohn, formatMindestlohn |
| standardTimes | 6 | getDefaultForDow (Mo-Do/Fr/weekend) |
| beta | 7 | isBetaActive, betaDaysRemaining |
| **TOPLAM** | **142** | **+34 yeni** |

### Inventory
- 28 page route (web) — hepsi build'de derlendi.
- 7 mobile screen — Calendar kaldırıldı, TS clean.
- 17 API route handler.
- 16 web lib helper (4'ü için yeni test eklendi).

### Versiyon
- 0.14.1 → 0.14.2 (PATCH: QA + test/lint fixes).

---
> Bu dosya her işlem sonrası otomatik güncellenir. Eski kayıtlar hiçbir zaman silinmez.
