/**
 * Logo'yu Canvas API ile küçültür + JPEG'e dönüştürür.
 * Max genişlik 400px, kalite 0.85 → genelde 30-80 KB base64.
 * SVG dosyalar Canvas'a çizilebilir ama vektör korunmaz; bu yeterli çünkü PDF/UI küçük gösterir.
 */
export async function resizeLogo(file: File, maxWidth: number, quality: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas-Kontext nicht verfügbar.")); return; }
        // JPEG kennt keine Transparenz → weißer Hintergrund statt schwarz
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        // PNG ile şeffaflık korunur ama JPEG çok daha küçük → JPEG kullan
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
