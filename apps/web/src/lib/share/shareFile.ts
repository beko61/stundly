/**
 * Dateien über das System-Teilen-Menü senden (Mail/WhatsApp/… mit Anhängen) — auf Handys.
 * Mehrere Dateien gehen als einzelne Anhänge raus (z.B. Bericht-PDF + Fotos als JPEG).
 * Wo das nicht geht (meist Desktop), werden die Dateien heruntergeladen.
 *
 * WICHTIG: direkt im Klick-Handler aufrufen, ohne vorheriges `await` — Browser erlauben
 * navigator.share (wie mailto/window.open) nur innerhalb der Nutzer-Geste. Die Dateien müssen
 * also VORHER fertig erzeugt sein (siehe "Bericht erstellen" → "Bericht teilen").
 */
export type ShareResult = "shared" | "cancelled" | "downloaded";

export async function shareOrDownload(
  fileOrFiles: File | File[],
  { title, text }: { title: string; text?: string },
): Promise<ShareResult> {
  const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share === "function" && nav.canShare?.({ files })) {
    try {
      await nav.share({ files, title, ...(text ? { text } : {}) });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // NotAllowedError o.ä. → auf Download zurückfallen
    }
  }
  for (const f of files) downloadFile(f);
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

/** "data:image/jpeg;base64,…" → File (für Foto-Anhänge). */
export function dataUrlToFile(dataUrl: string, name: string): File {
  const [head = "", b64 = ""] = dataUrl.split(",", 2);
  const type = head.match(/^data:([^;]+)/)?.[1] ?? "application/octet-stream";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type });
}
