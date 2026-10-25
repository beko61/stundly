/**
 * Notdienste eines Tages in Eingabe-Reihenfolge (created_at), nicht nach Uhrzeit:
 * "Nd 1" bleibt der zuerst eingetragene Einsatz, auch wenn ein späterer früher begann.
 * Noch nicht übertragene (offline) Einträge ohne created_at kommen ans Ende.
 */
export function byEntryOrder(a: { created_at?: string | null | undefined }, b: { created_at?: string | null | undefined }): number {
  const ca = a.created_at ?? "\uffff";
  const cb = b.created_at ?? "\uffff";
  return ca.localeCompare(cb);
}
