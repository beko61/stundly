/**
 * Handyfoto (oft 3–8 MB) → JPEG-Data-URL für notdienst_anhaenge.data.
 * Längste Seite max. `maxSide` px; Qualität wird gesenkt, bis das Ergebnis unter
 * `maxChars` liegt (DB-Check in Migration 029: 1 600 000 Zeichen).
 */
export async function compressImage(
  file: Blob,
  { maxSide = 1280, quality = 0.72, maxChars = 1_500_000 } = {},
): Promise<string> {
  const img = await decode(file);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar");
  ctx.fillStyle = "#fff"; // transparente PNGs nicht schwarz werden lassen
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img.source, 0, 0, w, h);
  img.close?.();

  let q = quality;
  let out = canvas.toDataURL("image/jpeg", q);
  while (out.length > maxChars && q > 0.3) {
    q -= 0.1;
    out = canvas.toDataURL("image/jpeg", q);
  }
  if (out.length > maxChars) throw new Error("Foto ist zu groß");
  return out;
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
}

async function decode(file: Blob): Promise<Decoded> {
  // createImageBitmap berücksichtigt die EXIF-Ausrichtung (Hochformat-Fotos nicht gedreht)
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch { /* z.B. HEIC in manchen Browsern → <img>-Fallback */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const el = new Image();
    el.src = url;
    await el.decode();
    return { source: el, width: el.naturalWidth, height: el.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}
