# Stundly – Güncellemeler & Yol Haritası

Son güncelleme: 2026-04-06

---

## ✅ YAPILDI

### Altyapı & Teknik
- Turborepo monorepo yapısı (web + mobile + shared)
- Supabase auth entegrasyonu (web + mobile)
- Next.js 15 + React 19 yapılandırması
- Expo Go React bağımlılık çakışması çözüldü
- `@supabase/ssr` webpack bundle sorunu çözüldü
- Hydration hatası (tarayıcı extension) çözüldü
- TypeScript 0 hata
- Supabase migration 011 (kritik eksik schema düzeltildi)

### Veritabanı Schema
- `companies`, `subscriptions`, `invitations`, `audit_logs`, `deletion_requests` tabloları
- `plan_features` tablosu (Trial/Individual/Team/Business — EUR)
- `profiles` tablosuna `role`, `plan`, `is_active`, `last_seen_at`, `company_id` eklendi
- RLS politikaları (role bazlı)
- `handle_new_user` trigger (kayıt anında profil oluşturma)

### Web Uygulaması — Sayfalar
- Landing page (Almanca, pricing, feature showcase)
- Login / Register (hata mapping, email onayı desteği)
- Onboarding akışı (type → setup → done)
- Dashboard: Tracker, Calendar, Salary, Vacation, Reports, Settings
- Company Admin paneli (dashboard, employees, billing, reports)
- Super Admin paneli (dashboard, users, companies, hesap oluştur)
- `/setup` ilk kurulum sayfası
- `/team` firma çalışan yönetimi sayfası
- DSGVO sayfaları (Impressum, Datenschutz)
- Pricing sayfası

### Rol Sistemi
- Middleware route koruması (super_admin / company_admin / employee / individual)
- Sidebar rol bazlı menü (company_admin → Team linki, super_admin → Admin Panel butonu)
- Login sonrası role göre yönlendirme

### Super Admin Özellikleri
- Kullanıcı listesi (arama, filtre, rol değiştirme, aktif/pasif toggle, silme)
- Hesap oluşturma (bireysel / çalışan / firma+admin)
- Şirket listesi
- MRR/ARR dashboard

### Diğer
- Stripe checkout + webhook + portal
- Email sistemi (Resend, Almanca şablonlar)
- DSGVO veri export/silme API
- AI scan (fotoğraftan saat girişi, Claude Haiku)
- Almanya tatil hesaplama (Feiertage, Bundesland bazlı)
- Desktop responsive tasarım
- Vercel fra1 (Frankfurt) deploy yapılandırması

---

## ⏳ YAPILACAKLAR

### 🔴 Öncelikli (Şu an çalışmıyor)
- [ ] **Supabase migration 011 çalıştır** → Kayıt + admin panel için zorunlu
- [ ] **Supabase email onayını kapat** (Dashboard → Auth → Settings) → Kolay test için
- [ ] **`/setup` ile super_admin al** → Admin panele giriş için

### 🟠 Önemli (Canlıya çıkmadan)
- [ ] **Stripe test modu** → Checkout akışını test et, webhook çalışıyor mu?
- [ ] **Resend domain doğrulama** → Email gönderimi çalışıyor mu?
- [ ] **Impressum ve Datenschutz** → Gerçek şirket bilgileriyle doldur (Almanya'da yasal zorunluluk)
- [ ] **Supabase EU region seçimi** → Frankfurt (eu-central-1) DSGVO için zorunlu
- [ ] **Cookie consent banner** → DSGVO uyumlu (kod hazır değil)

### 🟡 Geliştirme
- [ ] **Mobile — Company Admin ekranları** → Şu an sadece web'de var
- [ ] **Mobile — Super Admin** → Mobilde yok
- [ ] **Çalışan rapor görüntüleme** → Company admin tüm çalışanların saatlerini görebilmeli
- [ ] **Davet email akışı** → Davet tokenı → `/join/[token]` sayfası → kullanıcı kaydı
- [ ] **Plan yükseltme / düşürme** → Stripe portal entegrasyonu testi
- [ ] **ArbZG uyarıları** → 8 saat/gün, 48 saat/hafta aşımı uyarısı
- [ ] **Mindestlohn kontrolü** → Saatlik ücret Mindestlohn altında uyarı
- [ ] **PDF export** → Çalışan saatlerini PDF olarak indirme
- [ ] **Rate limiting** → Production'da Redis/Upstash (şu an in-memory)

### 🟢 İyileştirme
- [ ] **Dil tutarlılığı** → UI'da Türkçe/Almanca karışıklığı var, tek dile çek
- [ ] **Mobile EAS build** → Production APK/IPA
- [ ] **Domain** → stundly.de veya stundly.de
- [ ] **Super Admin → Gelir grafiği** → Aylık MRR/ARR trend
- [ ] **Kullanıcı aktivite logları** → Admin panelde audit log görüntüleme
- [ ] **Şifre sıfırlama** → "Şifremi unuttum" akışı yok
