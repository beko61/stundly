/**
 * Wohin nach der Registrierung (ohne Firmen-Einladung)?
 *
 * - /firma schickt `as=company` mit → direkt zur Firmen-Einrichtung
 * - Empfehlungslink / QR-Code eines Kollegen (`ref`) → direkt zum Bundesland (Einzelperson)
 * - sonst die Auswahl "Einzelperson / Unternehmen"
 *
 * Die Auswahl bleibt über "Zurück" bzw. den Link auf der Einrichtungsseite erreichbar.
 */
export function afterSignupPath({ referred, asCompany }: { referred: boolean; asCompany: boolean }): string {
  if (asCompany) return "/onboarding/setup?type=company";
  if (referred) return "/onboarding/setup?type=individual";
  return "/onboarding/type";
}
