/**
 * Datei über das System-Teilen-Menü senden (Mail/WhatsApp/… mit Anhang) — auf Handys.
 * Wo das nicht geht (meist Desktop), wird die Datei heruntergeladen.
 *
 * WICHTIG: direkt im Klick-Handler aufrufen, ohne vorheriges `await` — Browser erlauben
 * navigator.share (wie mailto/window.open) nur innerhalb der Nutzer-Geste. Die Datei muss
 * also VORHER fertig erzeugt sein (siehe "Bericht erstellen" → "Bericht teilen").
 */
export type ShareResult = "shared" | "cancelled" | "downloaded";

export async function shareOrDownload(
  file: File,
  { title, text }: { title: string; text?: string },
): Promise<ShareResult> {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title, ...(text ? { text } : {}) });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // NotAllowedError o.ä. → auf Download zurückfallen
    }
  }
  downloadFile(file);
  return "downloaded";
}

export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
