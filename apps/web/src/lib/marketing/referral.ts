/**
 * Empfehlungen & Herkunft neuer Nutzer.
 *
 * - Einladungslink: /register?ref=<8 Zeichen der User-ID> — wer darüber kommt, bekommt
 *   `referred_by` in die Auth-Metadaten (raw_user_meta_data).
 * - Registrierung fragt freiwillig "Wie hast du von Stundly erfahren?" → `signup_source`.
 * Auswertung (Supabase SQL Editor):
 *   select raw_user_meta_data->>'signup_source' as quelle, count(*) from auth.users group by 1;
 *   select raw_user_meta_data->>'referred_by' as ref, count(*) from auth.users
 *     where raw_user_meta_data ? 'referred_by' group by 1;
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://stundly.de";

export function referralCode(userId: string): string {
  return userId.replace(/-/g, "").slice(0, 8).toLowerCase();
}

export function isReferralCode(v: string | null | undefined): v is string {
  return !!v && /^[0-9a-f]{8}$/.test(v);
}

export function inviteUrl(userId: string): string {
  return `${APP_URL}/register?ref=${referralCode(userId)}`;
}

export function inviteText(userId: string): string {
  return `Ich erfasse meine Arbeitszeit, Überstunden und Notdienste mit Stundly — ` +
    `in der Beta komplett kostenlos. Probier's aus: ${inviteUrl(userId)}`;
}

export const SIGNUP_SOURCES: { value: string; label: string }[] = [
  { value: "kollege",   label: "Kollege / Freund" },
  { value: "bericht",   label: "Notdienst-Bericht oder PDF von Stundly" },
  { value: "google",    label: "Google-Suche" },
  { value: "instagram", label: "Instagram / TikTok" },
  { value: "facebook",  label: "Facebook" },
  { value: "youtube",   label: "YouTube" },
  { value: "firma",     label: "Über meinen Arbeitgeber" },
  { value: "andere",    label: "Andere" },
];
