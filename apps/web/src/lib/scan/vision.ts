import Anthropic from "@anthropic-ai/sdk";

/**
 * Gemeinsam für den Foto-Scan (Einzelperson: /api/scan, Firma: /api/company/scan):
 * Bild prüfen → Claude Vision → JSON aus der Antwort ziehen.
 */

export const SCAN_MODEL = "claude-haiku-4-5-20251001";
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type MediaType = (typeof ALLOWED_TYPES)[number];
// Max 4 MB base64 (~3 MB Bild) — der Client verkleinert vorher auf ~0,5 MB
const MAX_IMAGE_B64_LENGTH = 4 * 1024 * 1024;

export type ImageCheck =
  | { ok: true; data: string; mediaType: MediaType }
  | { ok: false; error: string; status: number };

export function checkImage(body: unknown): ImageCheck {
  const b = (body ?? {}) as { image?: unknown; mediaType?: unknown };
  if (typeof b.image !== "string" || typeof b.mediaType !== "string" || !b.image || !b.mediaType) {
    return { ok: false, error: "Bild und Medientyp sind erforderlich.", status: 400 };
  }
  if (!(ALLOWED_TYPES as readonly string[]).includes(b.mediaType)) {
    return { ok: false, error: "Ungültiger Bildtyp.", status: 400 };
  }
  const data = b.image.split(",")[1] ?? b.image;
  if (data.length > MAX_IMAGE_B64_LENGTH) {
    return { ok: false, error: "Bild zu groß. Maximal 3 MB.", status: 413 };
  }
  return { ok: true, data, mediaType: b.mediaType as MediaType };
}

/** Claude Vision aufrufen; wirft bei API-Fehler. */
export async function runVision(
  apiKey: string, img: { data: string; mediaType: MediaType }, prompt: string, maxTokens: number,
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: SCAN_MODEL,
    max_tokens: maxTokens,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } },
        { type: "text", text: prompt },
      ],
    }],
  });
  return message.content[0]?.type === "text" ? message.content[0].text : "";
}

/** Erstes JSON-Objekt aus der Antwort (Text davor/danach erlaubt); null wenn keins/abgeschnitten. */
export function extractJson(text: string): unknown {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as unknown; } catch { return null; }
}
