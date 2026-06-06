# Stundly — Çalışma Log Dosyası

> Bu dosya: yapılan tüm işler tarih sırasıyla. Her büyük adım sonrası güncellenir. Bir önceki sohbette nerede kaldığımızı görmek için bu dosyaya bak.

---

## 🗺️ Genel Plan (4 Faz)

```
[FAZ 1] Canlıya çıkış          ███████████░░  ~85% — neredeyse bitti
[FAZ 2] Pazarlanabilir hale    ░░░░░░░░░░░░░  0%
[FAZ 3] İlk 10 müşteri         ░░░░░░░░░░░░░  0%
[FAZ 4] Para trafik + ölçek    ░░░░░░░░░░░░░  0%
```

Şu an **FAZ 1 sonuna yaklaştık**. Sadece şu 3 maddenin halledilmesi gerek:
- Resend email (ihbar/davet mailleri için)
- Stripe Test mode (ödeme akışı için)
- Impressum/Gewerbe (yasal — pazarlamadan ÖNCE şart)

---

## 📅 2026-06-06 — Bir gün, bir milestone

### Sabah → Akşam: Workly'den Stundly'e geçiş + canlıya çıkış

**Başlangıç durumu**: Workly projesi yarım. Kod %95 yazılı (Nisan 2026 son commit), ama hiç canlıya çıkmamış. Domain yok, deploy yok, marka adı tartışmalı.

**Hedef**: Stundly markasıyla canlıya çıkmak + telefonda kullanılabilir hale getirmek.

### ✅ Tamamlanan adımlar

| # | İş | Detay |
|---|---|---|
| 1 | Supabase EU projesi kuruldu | Frankfurt region (DSGVO), 11 migration başarıyla uygulandı (009→010 atlandı çünkü sıralama bozuktu, 011 idempotent olarak hepsini tamamladı) |
| 2 | stundly.de domain alındı | €5/yıl (United-Domains). stundly.com almadık şimdilik (gelecekte) |
| 3 | GitHub repo açıldı | beko61/stundly (private). bktasyusuf-coder cached credential silindi, beko61 ile push |
| 4 | Vercel deploy | fra1 region, 4 env değişkeni (Supabase URL/anon/service_role + APP_URL), SSL otomatik |
| 5 | DNS bağlandı | United-Domains DNS: A @ 216.198.79.1 + CNAME www → vercel-dns-017 |
| 6 | Marka rebrand: Workly → Stundly | 39 dosya değişti. `@workly/*` paket scope'u korundu (npm bağımlılıkları kırılmasın) |
| 7 | PWA temeli | manifest.json + 5 ikon (192/512/180/32/16) + iOS meta tag + OpenGraph |
| 8 | Service Worker | public/sw.js (network-first, basic cache). Chrome PWA install için zorunluydu |
| 9 | Mobile layout | BottomNav aktif (Zeit·Tage·Lohn·Urlaub·Profil), sidebar mobilde gizli, padding 32→16px |
| 10 | Mobile fix turn 1 | Yatay overflow: html/body overflow-x: clip, max-width: 100vw, min-width: 0 |
| 11 | Mobile fix turn 2 | BottomNav etiket nowrap+ellipsis, Scan butonu BottomNav üstüne çıktı |
| 12 | YearPicker | 4 yıl yan yana buton → dropdown. Tracker + Salary + Calendar + Reports |
| 13 | Yazı kırılması | `overflow-wrap: anywhere` çok agresifti → `hyphens: auto` + lang="de" → Almanca tireleme (Urlaubs-antrag) |
| 14 | Cookie banner | DSGVO uyumlu, Almanca, layout root'a eklendi |
| 15 | Welcome banner | Tracker'a yeni kullanıcı için 30 saniyede ilk değer rehberi |
| 16 | WhatsApp destek butonu | Kod hazır, env'de numara eklenince aktif olur (henüz numara yok) |
| 17 | start_url fix | manifest.json: `/tracker` → `/` (login redirect olmasın, Chrome installable) |

### 🐛 Çözülen hatalar

1. **Supabase migration 009 patladı** (`column p.role does not exist`) — 011 idempotent ile çözüldü, 009-010 atlandı
2. **Yarım deploy attempts** ("stundly-web", "stundly", "stundly-app" project name çakışması) — "stundly-prod-2026" gibi unique isim
3. **vercel.json çelişkisi** (`cd ../..` root ile çakışıyordu) — sadeleştirildi, sadece `regions: ["fra1"]`
4. **Vercel build failed**: `/api/email/invite` modül-level `new Resend("")` patladı — lazy initialization
5. **Vercel 500 MIDDLEWARE_INVOCATION_FAILED** — Env değişkenleri eklenmemişti! Manuel 4 değişken ekledik, redeploy çalıştı
6. **Bottom nav "Tracker" yazısı kayıyordu** — Kısa etiketler (Zeit/Tage/Lohn) + nowrap+ellipsis
7. **Floating Scan butonu BottomNav'i kapatıyordu** — Mobile'de bottom: calc(90px + safe-area)
8. **Yatay scroll vardı telefonda** — overflow-x: clip + min-width: 0 (flex shrink fix)

### 📦 Son commit'ler

```
18150ce feat(mobile): unified YearPicker dropdown across salary/calendar/reports + manifest start_url fix
233aa0c feat(mobile): year dropdown (single visible) + service worker (Chrome installable PWA)
82ab5dd fix(mobile): shorter bottom-nav labels (Zeit/Tage/Lohn) + nowrap + lift scan button
ac99f25 fix(mobile): aggressive overflow-x clip + flex shrink + word-wrap
631a451 feat(mobile): bottom nav + responsive paddings + iOS-friendly modals
a602886 feat(pwa): add manifest, icons (svg+png), iOS meta tags, OpenGraph
505e879 feat: tracker welcome banner + WhatsApp button moved to bottom-left
d468920 Initial commit: Workly SaaS — Almanya odakli Arbeitszeiterfassung platformu
```

---

## ⏳ Kalan iş listesi

### 🔴 FAZ 1 son adımlar (bu hafta)

- [ ] **Impressum + Gewerbe** — Yasal zorunluluk. Kullanıcı kararı bekliyor (firmam yok, adres gizli istiyor → Gewerbe açmak veya virtual office almak gerek)
- [ ] **Resend email kurulumu** — info@stundly.de'den davet/onay/fatura emaili. resend.com hesap + DNS doğrulama
- [ ] **Stripe Test mode** — 3 ürün + price ID + webhook URL

### 🟠 FAZ 2: Pazarlanabilir hale (sonraki hafta)

- [ ] Demo video (60sn ekran kaydı)
- [ ] Sosyal kanıt rozetleri (DSGVO, Made in Germany)
- [ ] Yıllık fiyat indirimi (%20 indirim, cash flow)
- [ ] Landing'de ekran görüntüleri / mockup

### 🟡 FAZ 3: İlk 10 müşteri (1 ay)

- [ ] Beta tester pozisyonlama (ömür boyu %50 indirim, ilk 20)
- [ ] Birebir WhatsApp onboarding desteği (Stundly'e WhatsApp numarası eklenince)
- [ ] Testimonial topla

### 🟢 FAZ 4: Para trafik (2 ay)

- [ ] Google Ads test bütçesi €100 (Arbeitszeiterfassung kostenlos)
- [ ] Facebook Almanya'daki Türkler grupları (€0)
- [ ] LinkedIn KOBİ sahipleri direkt mesaj (€60 Premium)
- [ ] Kazanan kanalı 10x bütçeyle ölçeklendir

---

## 💡 Stratejik notlar

### Native App (App Store / Google Play) ne zaman?

**Şu an**: PWA yeterli (ana ekrana ekle çalışır, native app gibi açılır).

**Native app gerek olabilir**: 
- Müşteri sayısı 50+ olunca (App Store'da görünürlük)
- Push notification çok kritik olduğunda (iOS PWA push limitli)
- "App Store rozeti" prestij için
- `apps/mobile/` (Expo React Native) zaten mevcut — sadece EAS build + store onayı kaldı

**Maliyet**: 
- Apple Developer hesabı: $99/yıl
- Google Play hesabı: $25 tek seferlik
- EAS Build: ücretsiz başlangıçta
- Store onayı süresi: 1-2 hafta her biri

**Tavsiye**: Önce PWA ile 5-10 beta kullanıcı topla, geri bildirim al, ürünü stabilize et. Sonra native app yatırımı yap.

### Hangi sayfa mobil için en kritik?

1. **Tracker** — günlük kullanım, en sık açılan (önce optimize)
2. **Lohn** — sonuç görme, motivasyon
3. **Kalender** — geçmiş kontrol
4. **Urlaub** — ara sıra
5. **Profil/Settings** — bir kez kurulum

### 5 çalışan deneyiminden ders

Önceki sohbette: kullanıcı 5 çalışanına `internettesiz kullanim.html`'i denetti, "zor" deyip reddettiler. Bu **#1 ürün önceliği**: basit + telefonda çalışan + tek tıkla işlem. Şu ana kadar bu doğrultuda:
- Welcome banner (rehber)
- "Monat befüllen" tek-tık tüm ay
- Mobile bottom nav (5 sekme yerine sidebar 8 link)
- Cookie banner sade
- Yıl seçici dropdown (4 buton yerine)
