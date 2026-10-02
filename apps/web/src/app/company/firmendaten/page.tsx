import { redirect } from "next/navigation";
import { getCompanyAdminContext } from "@/lib/company/admin";
import { briefkopfFromCompany, COMPANY_BRIEFKOPF_SELECT } from "@/lib/company/briefkopf";
import { FirmendatenForm } from "./FirmendatenForm";

/**
 * Firmendaten / Briefkopf: Name, Adresse, Telefon, Logo — erscheint in allen PDFs des Teams.
 * Nur der Chef pflegt ihn; Mitarbeiter sehen ihn im Profil nur zur Ansicht.
 */
export default async function FirmendatenPage() {
  const ctx = await getCompanyAdminContext();
  if (!ctx) redirect("/onboarding/type");
  const { admin, companyId } = ctx;

  const full = await admin.from("companies").select(COMPANY_BRIEFKOPF_SELECT).eq("id", companyId).maybeSingle();
  // Vor Migration 036 gibt es phone/logo_data noch nicht
  const supported = !full.error;
  const company = supported
    ? full.data
    : (await admin.from("companies").select("name, address_line1, postal_code, city").eq("id", companyId).maybeSingle()).data;
  const bk = briefkopfFromCompany(company as Record<string, unknown> | null) ?? { name: "", strasse: "", plz: "", ort: "", telefon: "", logo: null };

  // Noch leer? Angaben aus dem eigenen Profil vorschlagen (bisher dort gepflegt)
  let prefilled = false;
  if (!bk.strasse && !bk.plz && !bk.ort && !bk.telefon && !bk.logo) {
    const { data: own } = await admin.from("profiles")
      .select("firma_strasse, firma_plz, firma_ort, firma_telefon, logo_data")
      .eq("user_id", ctx.user.id).maybeSingle();
    const o = (own ?? {}) as Record<string, string | null>;
    if (o["firma_strasse"] || o["firma_plz"] || o["firma_ort"] || o["firma_telefon"] || o["logo_data"]) {
      bk.strasse = o["firma_strasse"] ?? "";
      bk.plz     = o["firma_plz"] ?? "";
      bk.ort     = o["firma_ort"] ?? "";
      bk.telefon = o["firma_telefon"] ?? "";
      bk.logo    = o["logo_data"] ?? null;
      prefilled = true;
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 className="sa-title">Firmendaten</h1>
      <p className="sa-sub">Briefkopf für alle PDFs deines Teams — Monatsberichte, Urlaubsanträge, Notdienst-Berichte.</p>
      <FirmendatenForm initial={bk} supported={supported} prefilled={prefilled} />
    </div>
  );
}
