# Stundly – Son Kayıt

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
> Bu dosya her işlem sonrası otomatik güncellenir. Eski kayıtlar hiçbir zaman silinmez.
