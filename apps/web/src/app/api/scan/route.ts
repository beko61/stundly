import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rateLimit/check";

export const runtime = "nodejs";
export const maxDuration = 30;

// Persistent rate limit (R4 fix): serverless-safe.
// Anthropic API çağrısı $$: dar limitler.
const SCAN_LIMIT_PER_HOUR = 20;
const SCAN_WINDOW_SEC     = 3600;

// Max image size: 4 MB base64 string (~3 MB actual image)
const MAX_IMAGE_B64_LENGTH = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  // 1. Authenticate the user via Supabase session cookie
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            (cookieStore as unknown as { set: (n: string, v: string, o?: unknown) => void }).set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  }

  // 2. Rate limit check — persistent (R4)
  const rl = await checkRateLimit({
    bucket:    `scan:${user.id}`,
    limit:     SCAN_LIMIT_PER_HOUR,
    windowSec: SCAN_WINDOW_SEC,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Zu viele Scans. Limit ${SCAN_LIMIT_PER_HOUR}/Stunde erreicht.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  // 3. Validate API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY nicht konfiguriert." }, { status: 500 });
  }

  // 4. Parse and validate body
  let body: { image: string; mediaType: string };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  if (!body.image || !body.mediaType) {
    return NextResponse.json({ error: "Bild und Medientyp sind erforderlich." }, { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!allowedTypes.includes(body.mediaType)) {
    return NextResponse.json({ error: "Ungültiger Bildtyp." }, { status: 400 });
  }

  const imageData = body.image.split(",")[1] ?? body.image;
  if (imageData.length > MAX_IMAGE_B64_LENGTH) {
    return NextResponse.json({ error: "Bild zu groß. Maximal 3 MB." }, { status: 413 });
  }

  // 5. Call Anthropic
  const client = new Anthropic({ apiKey });

  let text = "";
  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: body.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: imageData,
              },
            },
            {
              type: "text",
              text: `Du bist ein Arbeitszeiterfassungs-Assistent. Analysiere dieses Bild einer Arbeitszeitaufzeichnung oder eines Stundenzettels.

Extrahiere alle Arbeitszeiten und gib sie im folgenden JSON-Format zurück (nur JSON, kein anderer Text):

{
  "eintraege": [
    {
      "datum": "YYYY-MM-DD",
      "beginn": "HH:MM",
      "ende": "HH:MM",
      "pause_minuten": 60,
      "notiz": "Optional"
    }
  ],
  "hinweis": "Kurze Erklärung was erkannt wurde"
}

Falls kein gültiges Datum erkennbar ist, verwende die aktuelle Woche. Falls kein Datum im Bild steht, schreibe "unbekannt".
Wenn das Bild keine Arbeitszeiten enthält, gib zurück: {"eintraege": [], "hinweis": "Keine Arbeitszeiten erkannt"}`,
            },
          ],
        },
      ],
    });

    text = message.content[0]?.type === "text" ? message.content[0].text : "";
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("Anthropic API error:", message);
    return NextResponse.json({ error: `KI-Fehler: ${message}` }, { status: 502 });
  }

  // 6. Extract JSON — handle text before/after the JSON block
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ result: text, parsed: null });
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    return NextResponse.json({ result: text, parsed });
  } catch {
    return NextResponse.json({ result: text, parsed: null });
  }
}
