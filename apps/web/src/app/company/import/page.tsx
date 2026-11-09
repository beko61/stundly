import { redirect } from "next/navigation";
import { getCompanyAdminContext } from "@/lib/company/admin";
import { ImportClient } from "./ImportClient";

/**
 * Firma: Stundenzettel / Schichtplan fotografieren → KI liest Namen + Zeiten → Tabelle prüfen/korrigieren →
 * bei allen Mitarbeitern speichern (als protokollierte Korrektur, der Mitarbeiter sieht sie).
 */
export default async function CompanyImportPage() {
  const ctx = await getCompanyAdminContext();
  if (!ctx) redirect("/onboarding/type");
  const { data } = await ctx.admin.from("profiles")
    .select("user_id, full_name, vorname, nachname")
    .eq("company_id", ctx.companyId).is("deleted_at", null);
  const team = ((data ?? []) as { user_id: string; full_name: string | null; vorname: string | null; nachname: string | null }[])
    .map(m => ({ user_id: m.user_id, name: m.full_name || [m.vorname, m.nachname].filter(Boolean).join(" ") || "—" }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>📷 Stundenzettel-Foto importieren</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
        Foto vom Stundenzettel oder Schichtplan (auch mehrere Personen) → die KI liest Namen und Zeiten in eine Tabelle.
        Du prüfst und korrigierst, dann wird bei jedem Mitarbeiter gespeichert. Jede Änderung ist für den Mitarbeiter
        als Korrektur sichtbar.
      </p>
      <ImportClient team={team} />
    </div>
  );
}
