# Workly – Deploy Rehberi

## Web (Vercel)

1. [vercel.com](https://vercel.com) → Import Git Repository
2. Root dizin: `apps/web`
3. Region: **Frankfurt (fra1)** — DSGVO zorunlu
4. Environment Variables ekle (`.env.example` dosyasına bak)
5. Deploy → otomatik

## Supabase

1. [supabase.com](https://supabase.com) → New Project → Region: **Frankfurt (eu-central-1)**
2. SQL Editor'da migration dosyalarını sırayla çalıştır:
   ```
   supabase/migrations/001_initial_schema.sql
   ...
   supabase/migrations/010_saas_plans_and_limits.sql
   ```
3. Authentication → Email ayarları → Confirm email: ON

## Stripe

1. [dashboard.stripe.com](https://dashboard.stripe.com) → Kayıt ol
2. Products → 3 ürün oluştur (Individual/Team/Business)
3. Her ürüne Monthly + Yearly fiyat ekle (EUR)
4. Tax → Stripe Tax aktifleştir (MwSt otomatik)
5. Webhooks → `https://app.workly.app/api/stripe/webhook` ekle
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
6. Price ID'leri `.env` dosyasına ekle

## Resend (Email)

1. [resend.com](https://resend.com) → Kayıt ol
2. Domain → `workly.app` ekle → DNS kayıtlarını ekle
3. API Key oluştur → `.env`'e ekle

## Mobile (EAS Build)

```bash
cd apps/mobile
npm install -g eas-cli
eas login
eas build --platform all --profile production
```

## Checklist (Go-Live)

- [ ] Supabase EU region (Frankfurt)
- [ ] Vercel region: fra1
- [ ] Stripe Webhook aktif
- [ ] Stripe Tax aktif (MwSt)
- [ ] Resend domain doğrulandı
- [ ] Impressum sayfası gerçek verilerle güncellendi
- [ ] Datenschutzerklärung gerçek verilerle güncellendi
- [ ] SSL sertifikası aktif (Vercel otomatik)
- [ ] HSTS header aktif (next.config.mjs'de mevcut)
- [ ] Super Admin rolü atandı (Supabase'den manuel)
