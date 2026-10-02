import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyBriefkopf, briefkopfFromCompany, loadMyBriefkopf } from "@/lib/company/briefkopf";

const COMPANY = { name: "Wa GmbH", address_line1: "Hauptstr. 1", postal_code: "30159", city: "Hannover", phone: "0511 1", logo_data: "data:image/jpeg;base64,AAA" };
const rpc = (result: { data: unknown; error: unknown }) => ({ rpc: async () => result }) as unknown as SupabaseClient;

describe("Firmen-Briefkopf", () => {
  it("ersetzt die eigenen Profil-Felder komplett — auch mit leeren Firmenwerten", () => {
    const profil = { vorname: "Ali", company_name: "Meine Firma", firma_strasse: "Privatweg 9", firma_telefon: "0170", logo_data: "data:eigen" };
    const out = applyBriefkopf(profil, briefkopfFromCompany({ name: "Wa GmbH" }));
    expect(out).toMatchObject({ vorname: "Ali", company_name: "Wa GmbH", firma_strasse: "", firma_telefon: "", logo_data: null });
  });

  it("ohne Firma bleibt das Profil unverändert", () => {
    const profil = { company_name: "Meine Firma" };
    expect(applyBriefkopf(profil, null)).toBe(profil);
  });

  it("loadMyBriefkopf: Firmenzeile → Briefkopf; Fehler (Migration fehlt) oder keine Firma → null", async () => {
    expect(await loadMyBriefkopf(rpc({ data: [COMPANY], error: null }))).toEqual({
      name: "Wa GmbH", strasse: "Hauptstr. 1", plz: "30159", ort: "Hannover", telefon: "0511 1", logo: "data:image/jpeg;base64,AAA",
    });
    expect(await loadMyBriefkopf(rpc({ data: [], error: null }))).toBeNull();
    expect(await loadMyBriefkopf(rpc({ data: null, error: { message: "function my_company_briefkopf does not exist" } }))).toBeNull();
  });
});
