/**
 * Startseite nach Login / beim Öffnen der App (PWA start_url "/") je Rolle.
 * Einzige Quelle — vorher an 4 Stellen dupliziert (Landing, Login, Passwort-Änderung ×2).
 *
 * Super-Admin nutzt Stundly auch selbst zur Zeiterfassung → persönliches Dashboard;
 * das Admin Panel ist über die Sidebar erreichbar. Firmen-Admins starten im Firmen-Panel.
 */
export function homePathForRole(role: string | null | undefined): string {
  return role === "company_admin" ? "/company/dashboard" : "/dashboard";
}
