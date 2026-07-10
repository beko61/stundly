/**
 * BUrlG — Bundesurlaubsgesetz
 *
 * L6 §5 BUrlG — Zwölftelung: Wenn das Arbeitsverhältnis nicht das ganze
 * Kalenderjahr besteht, verringert sich der Urlaubsanspruch um ein Zwölftel
 * pro fehlendem Kalendermonat.
 *
 * L7 §7 III BUrlG — Übertragung + Verfall:
 * Urlaub muss im Kalenderjahr genommen werden. Übertragung nur bei
 * dringenden betrieblichen/persönlichen Gründen. Der übertragene Anspruch
 * muss bis zum 31. März des Folgejahres genommen werden — sonst verfällt er.
 *
 * VEREINFACHUNGEN:
 *  - Nur volle Beschäftigungsmonate zählen für den vollen Anspruch.
 *    Ein Monat gilt als "voll", wenn die Beschäftigung den kompletten
 *    Kalendermonat abdeckt (start.day == 1 UND end.day == letzter Tag).
 *  - Angebrochene Anfangs-/Endmonate = keine Zwölftel. Konservativ zugunsten
 *    des Nutzers wird der zeitanteilige Bruchteil NICHT hinzugerechnet.
 *    In der Praxis rechnen manche AG per genauem Tag-Verhältnis — hier
 *    einfach ganze Monate, weil kein Manuelmodus.
 *  - Wartezeit §4 BUrlG (6 Monate für vollen Anspruch) wird bemerkt aber
 *    nicht als Cap angewendet.
 *  - "Dringende Gründe" für Übertragung §7 III S. 2 werden nicht abgefragt —
 *    Übertragung wird schlicht als "Rest vom Vorjahr" gerechnet. Ob AG
 *    zustimmen musste, ist Sache des Nutzers.
 */

export const BURLG_MIN_URLAUB_DAYS       = 20;  // §3 BUrlG: 24 Werktage/5-Tage-Woche = 20 AT
export const BURLG_WARTEZEIT_MONTHS      = 6;   // §4 BUrlG: nach 6 Monaten voller Anspruch
export const BURLG_VERFALL_CUTOFF_MONTH  = 3;   // §7 III: 31.03. des Folgejahres
export const BURLG_VERFALL_CUTOFF_DAY    = 31;

// ═══════════════════════════════════════════════════════════════
// L6 — Zwölftelung
// ═══════════════════════════════════════════════════════════════

export interface EntitlementInput {
  /** Vollständiger Jahresanspruch in Arbeitstagen (aus salary_settings) */
  annualAnspruch: number;
  /** Beschäftigungsbeginn (YYYY-MM-DD) — null = seit Jahresanfang oder früher */
  employmentStart: string | null;
  /** Beschäftigungsende (YYYY-MM-DD) — null = noch aktiv */
  employmentEnd: string | null;
  /** Berechnungsjahr */
  year: number;
}

export interface EntitlementResult {
  /** Gekürzter Anspruch (Zwölftel des Jahresanspruchs) */
  anspruch: number;
  /** Anzahl voller Beschäftigungsmonate im Jahr */
  fullMonths: number;
  /** true → Zwölftelung wurde angewendet (fullMonths < 12) */
  isProrated: boolean;
  /** true → weniger als BURLG_WARTEZEIT_MONTHS: Anspruch noch nicht "verdient" */
  waitingPeriodActive: boolean;
}

function pad2(n: number): string { return String(n).padStart(2, "0"); }

/** Yıl için bir tarihin o yıl içindeki "clamp" edilmiş halini döndürür (yıl dışıysa null). */
function clampToYear(iso: string, year: number): { y: number; m: number; d: number } | null {
  const [yStr, mStr, dStr] = iso.split("-");
  const y = Number(yStr); const m = Number(mStr); const d = Number(dStr);
  if (y > year) return null;   // gelecek: yıl için henüz başlamamış
  if (y < year) return { y: year, m: 1, d: 1 }; // önceki yıl → bu yıl 1 Ocak
  return { y, m, d };
}

/** Ayın son günü. */
function lastDayOfMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

/**
 * O yıl için tam Beschäftigungsmonat sayısı (Kalendermonat).
 * Bir ay "tam" sayılır: start ≤ ayın 1'i ve end ≥ ayın son günü.
 */
export function countFullMonthsInYear(
  employmentStart: string | null,
  employmentEnd: string | null,
  year: number,
): number {
  const start = employmentStart
    ? clampToYear(employmentStart, year)
    : { y: year, m: 1, d: 1 };
  if (start === null) return 0; // Beschäftigung fängt erst im Folgejahr an

  const endObj = employmentEnd
    ? clampToYear(employmentEnd, year)
    : { y: year, m: 12, d: 31 };
  if (endObj === null) return 0; // employmentEnd < yılın başında değil ama > yılın sonu için clampToYear zaten +yılın başlangıcı
  const end = endObj;

  // employmentEnd yıl dışında ileriyse clampToYear yıl 1 Ocak döner — bu hatalı olur end için.
  // Daha temiz: end.y > year ise 31.12
  let effEndY = end.y, effEndM = end.m, effEndD = end.d;
  if (employmentEnd) {
    const [eyStr, emStr, edStr] = employmentEnd.split("-");
    const ey = Number(eyStr); const em = Number(emStr); const ed = Number(edStr);
    if (ey > year) { effEndY = year; effEndM = 12; effEndD = 31; }
    else if (ey < year) return 0;
    else { effEndY = ey; effEndM = em; effEndD = ed; }
  } else {
    effEndY = year; effEndM = 12; effEndD = 31;
  }

  let count = 0;
  for (let m = 1; m <= 12; m++) {
    const startsBeforeOrOnMonth = (start.y < year) || (start.y === year && (start.m < m || (start.m === m && start.d === 1)));
    const endsAfterOrOnMonth    = (effEndY > year) ||
      (effEndY === year && (effEndM > m ||
        (effEndM === m && effEndD >= lastDayOfMonth(year, m))));
    if (startsBeforeOrOnMonth && endsAfterOrOnMonth) count++;
  }
  return count;
}

export function calcAnnualEntitlement(input: EntitlementInput): EntitlementResult {
  const { annualAnspruch, employmentStart, employmentEnd, year } = input;
  const fullMonths = countFullMonthsInYear(employmentStart, employmentEnd, year);
  const isProrated = fullMonths < 12;
  // Zwölftel: pro voll gearbeiteten Monat 1/12 des Jahresanspruchs
  const anspruch = Math.round(annualAnspruch * (fullMonths / 12));
  return {
    anspruch,
    fullMonths,
    isProrated,
    waitingPeriodActive: fullMonths < BURLG_WARTEZEIT_MONTHS,
  };
}

// ═══════════════════════════════════════════════════════════════
// L7 — Übertragung + Verfall 31.03
// ═══════════════════════════════════════════════════════════════

export interface UrlaubskontoInput {
  /** Aktueller Jahresanspruch (nach L6 Zwölftelung, in Tagen) */
  thisYearEntitlement: number;
  /** Bereits genommene Urlaubstage in diesem Jahr */
  thisYearUsed: number;
  /** Übertrag aus dem Vorjahr (verbleibende Tage) */
  previousYearRemaining: number;
  /** Referenzdatum für Verfall-Check (YYYY-MM-DD), i.d.R. "heute" */
  refDate: string;
  /** Aktuelles Berechnungsjahr */
  year: number;
}

export interface UrlaubskontoResult {
  /** Übertrag noch nutzbar? (bis 31.03 des laufenden Jahres) */
  carryOverAvailable: number;
  /** Verfall wirksam (Übertrag ist bereits verfallen) */
  carryOverExpired: boolean;
  /** Verfall-Frist wird angezeigt (YYYY-MM-DD) */
  verfallDate: string;
  /** Tage bis zum Verfall (0 wenn expired, negativ = überfällig aber not applied) */
  daysUntilVerfall: number;
  /** Gesamt-Anspruch = thisYearEntitlement + carryOverAvailable */
  totalEntitlement: number;
  /** Restlicher Anspruch = totalEntitlement − thisYearUsed */
  remaining: number;
  /** Warnung: Übertrag verfällt binnen 30 Tagen und remaining > 0 */
  verfallWarning: boolean;
}

export function calcUrlaubskonto(input: UrlaubskontoInput): UrlaubskontoResult {
  const { thisYearEntitlement, thisYearUsed, previousYearRemaining, refDate, year } = input;
  const verfallDate = `${year}-${pad2(BURLG_VERFALL_CUTOFF_MONTH)}-${pad2(BURLG_VERFALL_CUTOFF_DAY)}`;

  // Übertrag ist "verfallen" nur wenn: (a) einer existierte, UND (b) refDate > verfallDate
  const cutoffPassed = refDate > verfallDate;
  const carryOverExpired = cutoffPassed && previousYearRemaining > 0;
  const carryOverAvailable = cutoffPassed ? 0 : Math.max(0, previousYearRemaining);

  // Tage bis Verfall (rough): iki ISO tarihi arasındaki gün farkı
  const [yR, mR, dR] = refDate.split("-").map(Number) as [number, number, number];
  const refMs    = new Date(yR, mR - 1, dR).getTime();
  const verfMs   = new Date(year, BURLG_VERFALL_CUTOFF_MONTH - 1, BURLG_VERFALL_CUTOFF_DAY).getTime();
  const daysUntilVerfall = Math.round((verfMs - refMs) / (24 * 60 * 60 * 1000));

  const totalEntitlement = thisYearEntitlement + carryOverAvailable;
  const remaining = totalEntitlement - thisYearUsed;

  const verfallWarning =
    !carryOverExpired &&
    carryOverAvailable > 0 &&
    daysUntilVerfall <= 30 &&
    remaining > 0;

  return {
    carryOverAvailable,
    carryOverExpired,
    verfallDate,
    daysUntilVerfall,
    totalEntitlement,
    remaining,
    verfallWarning,
  };
}
