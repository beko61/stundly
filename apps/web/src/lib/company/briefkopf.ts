/**
 * Briefkopf (Firmenname, Adresse, Telefon, Logo) für PDFs.
 *
 * Firmen-Mitarbeiter: Der Chef pflegt den Briefkopf im Firmen-Panel (companies, Migration 036);
 * er ersetzt die eigenen Profil-Felder komplett — Mitarbeiter können ihn nicht ändern.
 * Einzelnutzer (ohne Firma): weiter die eigenen Profil-Felder.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface Briefkopf {
  name:    string;
  strasse: string;
  plz:     string;
  ort:     string;
  telefon: string;
  logo:    string | null;
}

/** Spalten in companies (address_line1/postal_code/city gibt es seit Migration 009) */
export const COMPANY_BRIEFKOPF_SELECT = "name, address_line1, postal_code, city, phone, logo_data";

export const MAX_LOGO_CHARS = 600_000;

export function briefkopfFromCompany(c: Record<string, unknown> | null | undefined): Briefkopf | null {
  if (!c) return null;
  const s = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
  return {
    name:    s("name"),
    strasse: s("address_line1") || s("strasse"),
    plz:     s("postal_code") || s("plz"),
    ort:     s("city") || s("ort"),
    telefon: s("phone") || s("telefon"),
    logo:    s("logo_data") || null,
  };
}

/** Profil-Felder (company_name, firma_*, logo_data) durch den Firmen-Briefkopf ersetzen. */
export function applyBriefkopf<T extends object>(profile: T, bk: Briefkopf | null): T {
  if (!bk) return profile;
  return {
    ...profile,
    company_name:  bk.name,
    firma_strasse: bk.strasse,
    firma_plz:     bk.plz,
    firma_ort:     bk.ort,
    firma_telefon: bk.telefon,
    logo_data:     bk.logo,
  };
}

/**
 * Briefkopf der eigenen Firma (RPC my_company_briefkopf, security definer — Mitarbeiter
 * sehen so nur den Briefkopf, nicht die übrigen Firmen-Einstellungen).
 * null = keine Firma oder Migration 036 fehlt → eigene Profil-Felder verwenden.
 */
export async function loadMyBriefkopf(supabase: SupabaseClient): Promise<Briefkopf | null> {
  try {
    const { data, error } = await supabase.rpc("my_company_briefkopf");
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return briefkopfFromCompany(row as Record<string, unknown> | null);
  } catch {
    return null;
  }
}
