/**
 * Stundly-Tarife (Entscheidung 25.10.2026):
 *   Basic (kostenlos) · Plus (Einzelperson) · Firma (Team/Unternehmen, Mitarbeiter haben Plus inklusive)
 *
 * Basic: Zeiterfassung, Überstunden, Feiertage, Urlaub; max. 5 Notdienste pro Monat; Senden, Teilen
 * und Herunterladen gesperrt (Vorschau erlaubt); Lohn nur einfach; kein Offline, kein Foto-Scan.
 * Die DSGVO-Datenkopie (Profil → "Meine Daten herunterladen") bleibt IMMER frei (Art. 15/20 DSGVO).
 *
 * Die Sperren greifen erst mit PAYWALL_ACTIVE (Bezahlung muss möglich sein) — bis dahin ist alles frei.
 * Super-Admins können die Basic-Ansicht vorab ansehen (Vorschau, localStorage).
 */
import { BETA_END_DATE, BETA_MODE } from "@/lib/beta";

export type Tier = "basic" | "plus" | "firma";
export type TierReason = "company" | "paid" | "beta" | "trial" | "basic";

/** Gesperrte Funktionen in Basic */
export type Feature = "share" | "download" | "nd_unlimited" | "salary_details" | "offline" | "ocr";

export const ND_BASIC_PER_MONTH = 5;
export const TRIAL_DAYS = 30;

/** Bezahlschranke aktiv? Erst einschalten, wenn Stripe läuft (Vercel-Env NEXT_PUBLIC_PAYWALL=1). */
export const PAYWALL_ACTIVE = process.env.NEXT_PUBLIC_PAYWALL === "1";

/** Super-Admin-Vorschau: so sieht es ein Basic-Nutzer (nur dieses Gerät) */
export const PAYWALL_PREVIEW_KEY = "stundly_paywall_preview";

export interface TierInput {
  /** profiles.plan: trial | individual | team | business */
  plan: string | null | undefined;
  /** profiles.created_at (ISO) */
  createdAt: string | null | undefined;
  /** Mitglied einer Firma (Mitarbeiter oder Chef) */
  hasCompany: boolean;
  now?: Date;
  betaMode?: boolean;
  betaEnd?: string;
}

export interface TierInfo {
  tier: Tier;
  reason: TierReason;
  /** Bis wann Plus kostenlos läuft (Beta/Testzeit), ISO-Datum */
  until?: string;
}

export function resolveTier(i: TierInput): TierInfo {
  const now = i.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const betaMode = i.betaMode ?? BETA_MODE;
  const betaEnd = i.betaEnd ?? BETA_END_DATE;

  if (i.hasCompany || i.plan === "team" || i.plan === "business") return { tier: "firma", reason: "company" };
  if (i.plan === "individual") return { tier: "plus", reason: "paid" };

  const created = i.createdAt ? new Date(i.createdAt) : null;
  // Beta-Versprechen: wer in der Beta kommt, hat Plus bis Beta-Ende
  if (betaMode && today <= betaEnd && (!created || created.toISOString().slice(0, 10) <= betaEnd)) {
    return { tier: "plus", reason: "beta", until: betaEnd };
  }
  if (created) {
    const end = new Date(created.getTime() + TRIAL_DAYS * 86400000);
    if (now < end) return { tier: "plus", reason: "trial", until: end.toISOString().slice(0, 10) };
  }
  return { tier: "basic", reason: "basic" };
}

/** Alle gesperrten Funktionen gehören zu Plus — Firma enthält Plus. */
export function canTier(tier: Tier, _feature: Feature): boolean {
  return tier !== "basic";
}

export function ndLimitFor(tier: Tier): number {
  return tier === "basic" ? ND_BASIC_PER_MONTH : Infinity;
}

export const FEATURE_INFO: Record<Feature, { title: string; text: string }> = {
  share: {
    title: "Berichte senden",
    text: "Notdienst-Berichte und Urlaubsanträge direkt per Outlook, Mail oder WhatsApp senden — das PDF ist schon angehängt.",
  },
  download: {
    title: "PDF & Excel herunterladen",
    text: "Berichte, Anträge und Monatsübersichten als PDF, Excel oder CSV speichern.",
  },
  nd_unlimited: {
    title: "Unbegrenzt Notdienste",
    text: `In Basic sind ${ND_BASIC_PER_MONTH} Notdienste pro Monat enthalten. Mit Plus trägst du so viele ein, wie du brauchst.`,
  },
  salary_details: {
    title: "Lohn im Detail",
    text: "Netto, Steuerklasse, Zuschläge und Lohnerhöhungen genau berechnen.",
  },
  offline: {
    title: "Ohne Internet arbeiten",
    text: "Einträge im Keller oder auf der Baustelle ohne Netz speichern — sie werden später automatisch übertragen.",
  },
  ocr: {
    title: "Foto-Scan",
    text: "Papier-Stundenzettel fotografieren — Stundly liest die Zeiten automatisch aus.",
  },
};

export const PLUS_BENEFITS = [
  "Berichte & Anträge senden (PDF angehängt)",
  "PDF, Excel & CSV herunterladen",
  "Unbegrenzt Notdienste",
  "Ohne Internet arbeiten",
  "Lohn im Detail",
  "Foto-Scan von Stundenzetteln",
];
