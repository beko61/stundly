# Stundly – Son Kayıt

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
