/**
 * Vor- und Nachname für PDFs/Mails. Bei der Registrierung wird nur `full_name` gespeichert —
 * Vorname/Nachname bleiben leer, bis der Nutzer sie im Profil einträgt. Dann aus `full_name`
 * ableiten (letztes Wort = Nachname), statt "Mitarbeiter" zu drucken.
 */
export function nameParts(p: {
  vorname?: string | null | undefined;
  nachname?: string | null | undefined;
  full_name?: string | null | undefined;
} | null | undefined): { vorname: string; nachname: string } {
  const vorname = p?.vorname?.trim() ?? "";
  const nachname = p?.nachname?.trim() ?? "";
  if (vorname || nachname) return { vorname, nachname };
  const words = (p?.full_name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { vorname: "", nachname: "" };
  if (words.length === 1) return { vorname: words[0]!, nachname: "" };
  return { vorname: words.slice(0, -1).join(" "), nachname: words[words.length - 1]! };
}
