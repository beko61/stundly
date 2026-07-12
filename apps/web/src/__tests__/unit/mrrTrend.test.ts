import { describe, it, expect } from "vitest";
import { computeMrrTrend, type SubscriptionRow } from "@/lib/utils/mrrTrend";

/**
 * Fixed reference date for deterministic tests: 2026-07-15
 * → last 12 months (default) = Aug 2025 → Jul 2026
 */
const REF_DATE = new Date(Date.UTC(2026, 6, 15));  // 2026-07-15

function sub(overrides: Partial<SubscriptionRow>): SubscriptionRow {
  return {
    plan:        "individual",
    status:      "active",
    created_at:  "2026-01-01T00:00:00Z",
    canceled_at: null,
    ...overrides,
  };
}

describe("computeMrrTrend", () => {
  it("boş sub listesi → tüm aylar 0 MRR", () => {
    const trend = computeMrrTrend([], 12, REF_DATE);
    expect(trend).toHaveLength(12);
    expect(trend.every(p => p.mrr === 0)).toBe(true);
    // Son ay Jul 2026 olmalı
    expect(trend[11]?.month).toBe("2026-07");
    expect(trend[11]?.label).toBe("Jul");
    // İlk ay Aug 2025
    expect(trend[0]?.month).toBe("2025-08");
    expect(trend[0]?.label).toBe("Aug");
  });

  it("2026-01-01'de bir individual sub → Ocak'tan itibaren her ay 9.99 MRR", () => {
    const trend = computeMrrTrend([
      sub({ plan: "individual", created_at: "2026-01-01T10:00:00Z" }),
    ], 12, REF_DATE);
    // Ağustos-Aralık 2025: yok → 0
    for (let i = 0; i < 5; i++) expect(trend[i]?.mrr).toBe(0);
    // Ocak-Temmuz 2026: aktif → 9.99
    for (let i = 5; i < 12; i++) expect(trend[i]?.mrr).toBe(9.99);
  });

  it("2026-04-15'te iptal edilen sub → Nisan sonuna kadar aktif, Mayıs'tan itibaren 0", () => {
    // canceled_at = 2026-04-15 → 15 Nisan monthEnd'inden ÖNCEDIR, yani Nisan sonu
    // itibariyle iptal. Bizim tanımımızda canceled_at <= monthEnd → aktif değil.
    // Yani Nisan'da 0 dönmeli, Mart'a kadar 9.99.
    const trend = computeMrrTrend([
      sub({ plan: "individual", created_at: "2026-01-01T10:00:00Z", canceled_at: "2026-04-15T10:00:00Z" }),
    ], 12, REF_DATE);
    // Ocak-Mart aktif (index 5, 6, 7)
    expect(trend[5]?.mrr).toBe(9.99);  // Jan
    expect(trend[6]?.mrr).toBe(9.99);  // Feb
    expect(trend[7]?.mrr).toBe(9.99);  // Mar
    // Nisan-Temmuz iptal edilmiş → 0
    expect(trend[8]?.mrr).toBe(0);   // Apr
    expect(trend[11]?.mrr).toBe(0);  // Jul
  });

  it("trial plan MRR'ye dahil edilmez", () => {
    const trend = computeMrrTrend([
      sub({ plan: "trial",   created_at: "2026-01-01T00:00:00Z" }),
      sub({ plan: "individual", created_at: "2026-01-01T00:00:00Z" }),
    ], 12, REF_DATE);
    // Sadece individual say
    expect(trend[5]?.mrr).toBe(9.99);
    expect(trend[11]?.mrr).toBe(9.99);
  });

  it("3 farklı plan toplanır (team + business + individual)", () => {
    const trend = computeMrrTrend([
      sub({ plan: "individual", created_at: "2026-01-01T00:00:00Z" }),
      sub({ plan: "team",       created_at: "2026-01-01T00:00:00Z" }),
      sub({ plan: "business",   created_at: "2026-01-01T00:00:00Z" }),
    ], 12, REF_DATE);
    // 9.99 + 29.99 + 79.99 = 119.97
    expect(trend[11]?.mrr).toBeCloseTo(119.97, 2);
  });

  it("gelecekte yaratılan sub geçmiş ayların MRR'sine katılmaz", () => {
    // 2026-06-01 yaratılan sub → sadece Haziran + Temmuz'da aktif
    const trend = computeMrrTrend([
      sub({ plan: "individual", created_at: "2026-06-01T00:00:00Z" }),
    ], 12, REF_DATE);
    // Ağustos 2025 - Mayıs 2026 → yok
    for (let i = 0; i < 10; i++) expect(trend[i]?.mrr).toBe(0);
    // Haziran-Temmuz aktif
    expect(trend[10]?.mrr).toBe(9.99);
    expect(trend[11]?.mrr).toBe(9.99);
  });

  it("bilinmeyen plan (unknown) 0 olarak sayılır (crash olmaz)", () => {
    const trend = computeMrrTrend([
      sub({ plan: "premium_gold_xl", created_at: "2026-01-01T00:00:00Z" }),
    ], 12, REF_DATE);
    expect(trend.every(p => p.mrr === 0)).toBe(true);
  });

  it("months=6 sadece son 6 ay döner", () => {
    const trend = computeMrrTrend([], 6, REF_DATE);
    expect(trend).toHaveLength(6);
    expect(trend[0]?.month).toBe("2026-02");   // Feb
    expect(trend[5]?.month).toBe("2026-07");   // Jul
  });
});
