# Stripe kurulumu — senin yapacakların (17.11.2026)

Kod hazır (v0.99.2). Aşağıdakiler Stripe paneli ve Vercel'de **senin** yapman gereken ayarlar.
Anahtarları sohbete yapıştırma — doğrudan Stripe/Vercel'e veya `.env.local`'a gir.

> Önce her şeyi Stripe'ın **Test modunda** (sağ üstte "Test mode" anahtarı) kur ve dene.
> Canlıya geçiş beta bitince (31.03.2027 → 01.04.2027).

## 1. Ürünler ve fiyatlar
Stripe → **Product catalog** → Add product. Para birimi **EUR**, "Recurring".

| Ürün | Aylık | Yıllık | Vercel değişkeni (aylık / yıllık) |
|---|---|---|---|
| Plus | 5,99 € | 59 € | `STRIPE_PRICE_INDIVIDUAL_MONTHLY` / `STRIPE_PRICE_INDIVIDUAL_YEARLY` |
| Team | 19,99 € | 199 € | `STRIPE_PRICE_TEAM_MONTHLY` / `STRIPE_PRICE_TEAM_YEARLY` |
| Unternehmen | 49,99 € | 499 € | `STRIPE_PRICE_BUSINESS_MONTHLY` / `STRIPE_PRICE_BUSINESS_YEARLY` |

Her fiyatın **Price ID**'sini (`price_…`) ilgili Vercel değişkenine yaz.
Vercel'de bu 6 değişken haziranda eklenmişti — fiyatlar bu tablodakiyle aynı mı, kontrol et.

## 2. Beta-Tester kuponu (kalıcı %50)
Stripe → **Product catalog → Coupons** → New:
- Percentage off: **50 %**, Duration: **Forever**, isim: "Beta-Tester"
- Coupon **ID**'sini Vercel'e: `STRIPE_BETA_COUPON_ID`

Kod, 31.03.2027'ye kadar kayıt olan herkesin satın almasında bu kuponu **otomatik** uygular.

## 3. Webhook
Stripe → **Developers → Webhooks** → Add endpoint:
- URL: `https://stundly.de/api/stripe/webhook`
- Olaylar (4): `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.payment_failed`
- **Signing secret** (`whsec_…`) → Vercel: `STRIPE_WEBHOOK_SECRET`

## 4. Müşteri portalı ve ödeme yöntemleri
- Settings → Billing → **Customer portal**: aç; iptal (cancel) ve ödeme yöntemi değişikliğine izin ver.
- Settings → **Payment methods**: Kart ve **SEPA Direct Debit** açık olsun.
- Vergi: Kleinunternehmer (§ 19 UStG) → Stripe Tax **kapalı** kalsın.

## 5. Benim test edebilmem için (yerel)
`workly/apps/web/.env.local` dosyasına Stripe **test** değerlerini sen yapıştır:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...        # Stripe CLI: stripe listen --forward-to localhost:3100/api/stripe/webhook
STRIPE_PRICE_INDIVIDUAL_MONTHLY=price_...
(diğer 5 fiyat)
STRIPE_BETA_COUPON_ID=...
STRIPE_CHECKOUT_DURING_BETA=1          # sadece yerelde! beta sırasında satın almayı test için açar
```
Sonra bana "Stripe test anahtarlarını girdim" de; test kartı `4242 4242 4242 4242` ile uçtan uca denerim.

## 6. Canlıya geçiş (01.04.2027)
1. Stripe'ta aynı ürün/kupon/webhook'u **Live** modda kur (test ID'leri live'da geçmez).
2. Vercel'deki tüm `STRIPE_*` değerlerini live değerlerle değiştir.
3. Vercel'e `NEXT_PUBLIC_PAYWALL=1` ekle (kilitler açılır) → Redeploy.
4. `STRIPE_CHECKOUT_DURING_BETA` Vercel'de **asla** olmasın.
