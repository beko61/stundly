/**
 * Foto vor dem Senden verkleinern (längste Seite 2000 px, JPEG 0,85 → meist 300–800 KB).
 * Handyfotos (4–10 MB) lagen sonst über dem Server-Limit (3 MB / Vercel 4,5 MB) → "Netzwerkfehler";
 * iPhone-HEIC wird dabei zu JPEG (vorher "Ungültiger Bildtyp").
 */
const MAX_SIDE = 2000;
export async function shrinkImage(file: File): Promise<{ data: string; type: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Bild konnte nicht gelesen werden."));
      i.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL("image/jpeg", 0.85), type: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}
