/**
 * MRR (Monthly Recurring Revenue) trendi — subscriptions kayıtlarından
 * son N ayın MRR array'ini hesaplar.
 *
 * Yaklaşım: her ay için, o ayın SON GÜNÜ itibariyle "aktif" olan
 * abonelikleri say. Plan fiyatını EUR net olarak topla.
 *
 * Aktif tanımı: `created_at <= monthEnd` AND
 *               `canceled_at IS NULL OR canceled_at > monthEnd`
 * Trial (plan='trial') MRR'ye dahil DEĞİL — sadece paid plans.
 *
 * Not: Bu basitleştirilmiş model. Gerçek MRR:
 *   - Pro-rated upgrade/downgrade
 *   - Discount (Stripe coupon) uygulaması
 *   - Yıllık planların 1/12'si (şu an tek plan tipi/aylık varsayılıyor)
 * Bunlar için "MRR snapshot" tablosu + Stripe webhook history parse
 * gerekir — beta ölçekte basit model yeterli.
 */

export interface SubscriptionRow {
  plan:         string;
  status:       string;
  created_at:   string;
  canceled_at:  string | null;
}

export interface MrrPoint {
  /** ISO month "YYYY-MM" */
  month: string;
  /** Kısa Almanca label ("Jan", "Feb", ...) */
  label: string;
  /** EUR net */
  mrr:   number;
}

const PLAN_PRICES: Record<string, number> = {
  individual: 9.99,
  team:       29.99,
  business:   79.99,
};

const MONTH_LABELS_DE = [
  "Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez",
];

/**
 * Verilen `refDate` (default: bugün) itibariyle geriye dönük son N ayın
 * MRR'sini array olarak döner. En eskiden en yeniye sıralı.
 */
export function computeMrrTrend(
  subs: SubscriptionRow[],
  months: number = 12,
  refDate: Date = new Date(),
): MrrPoint[] {
  const result: MrrPoint[] = [];

  // Ayın son günü (UTC) — timezone drift'ini önlemek için UTC kullan
  for (let i = months - 1; i >= 0; i--) {
    const monthDate = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() - i, 1));
    // Bir sonraki ayın 1'inden 1ms önce → bu ayın son anı
    const monthEnd = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 1) - 1);

    let mrr = 0;
    for (const s of subs) {
      // Trial paid MRR değil
      if (s.plan === "trial") continue;

      const createdAt  = new Date(s.created_at);
      const canceledAt = s.canceled_at ? new Date(s.canceled_at) : null;

      // Aktif kriterleri: monthEnd'den önce yaratılmış VE (iptal yok VEYA iptal monthEnd'den sonra)
      if (createdAt > monthEnd) continue;
      if (canceledAt && canceledAt <= monthEnd) continue;

      mrr += PLAN_PRICES[s.plan] ?? 0;
    }

    const monthStr = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, "0")}`;
    result.push({
      month: monthStr,
      label: MONTH_LABELS_DE[monthDate.getUTCMonth()]!,
      mrr:   Math.round(mrr * 100) / 100,
    });
  }

  return result;
}
