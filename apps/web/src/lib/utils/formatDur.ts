/**
 * Einheitliches Dauer-Format für die ganze Oberfläche: "8h 15m", "8h", "30m", "0h".
 * Uhrzeiten (Start/Ende) bleiben HH:MM — nur Dauern (Std, Pause, Summen) nutzen das hier.
 *
 * @param signed  true → immer mit Vorzeichen ("+2h 5m" / "−1h"), für Differenzen
 */
export function formatDur(minutes: number, signed = false): string {
  const total = Math.round(Math.abs(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const body = h === 0 && m > 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
  if (!signed) return minutes < 0 && total > 0 ? `−${body}` : body;
  return `${minutes < 0 && total > 0 ? "−" : "+"}${body}`;
}

/** "2026-09-01" → "01.09." (Tabellen, Listen) */
export function formatDayMonth(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
}
