/**
 * Kullanıcı tarafından özelleştirilebilir Standard-Arbeitszeiten.
 *
 * Mo-Do ve Fr için ayrı start / end / pause değerleri tutulur. Bu ayarlar
 * iki yerde kullanılır:
 *   1. TimeEntryModal → yeni Arbeiten entry default'u
 *   2. AutoFillReports → "Jahr komplett befüllen" butonu
 *
 * Şu an localStorage'da saklanır (cihaz-başına ayar). İleride DB'ye
 * taşınabilir (salary_settings extension veya migration 015).
 */

export interface StandardTimes {
  monThuStart: string;  // "HH:MM"
  monThuEnd:   string;
  monThuPause: number;  // dakika
  friStart:    string;
  friEnd:      string;
  friPause:    number;
}

export const DEFAULT_STANDARD_TIMES: StandardTimes = {
  monThuStart: "07:45",
  monThuEnd:   "17:00",
  monThuPause: 60,
  friStart:    "07:45",
  friEnd:      "14:30",
  friPause:    30,
};

const LS_KEY = "workly_standard_times_v1";

export function getStandardTimes(): StandardTimes {
  if (typeof window === "undefined") return DEFAULT_STANDARD_TIMES;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_STANDARD_TIMES;
    const parsed = JSON.parse(raw) as Partial<StandardTimes>;
    return { ...DEFAULT_STANDARD_TIMES, ...parsed };
  } catch {
    return DEFAULT_STANDARD_TIMES;
  }
}

export function setStandardTimes(t: StandardTimes): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(t));
    // Cross-tab sync için storage event firewall
    window.dispatchEvent(new StorageEvent("storage", {
      key: LS_KEY,
      newValue: JSON.stringify(t),
    }));
  } catch { /* ignore quota errors */ }
}

/**
 * Hafta gününe göre default zaman + pause döner.
 * dow: 0=So ... 6=Sa (JS Date.getDay() ile uyumlu)
 * Sa/So için null döner — çalışma günü değil.
 */
export function getDefaultForDow(
  dow: number,
  t: StandardTimes = DEFAULT_STANDARD_TIMES,
): { start: string; end: string; pause: number } | null {
  if (dow === 5) return { start: t.friStart, end: t.friEnd, pause: t.friPause };
  if (dow >= 1 && dow <= 4) return { start: t.monThuStart, end: t.monThuEnd, pause: t.monThuPause };
  return null; // Sa/So
}

export const STANDARD_TIMES_LS_KEY = LS_KEY;
