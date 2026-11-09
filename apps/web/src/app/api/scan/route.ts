import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rateLimit/check";
import { PAYWALL_ACTIVE, canTier, resolveTier } from "@/lib/plan/entitlements";
import { fetchSubscriptionStatus } from "@/lib/plan/subscriptionStatus";
import { checkImage, extractJson, runVision } from "@/lib/scan/vision";

export const runtime = "nodejs";
export const maxDuration = 60; // ganzer Monat = lange Antwort

// Persistent rate limit (R4 fix): serverless-safe.
// Anthropic API çağrısı $$: dar limitler.
const SCAN_LIMIT_PER_HOUR = 20;
const SCAN_WINDOW_SEC     = 3600;


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

  // Tarif: Foto-Scan ist Plus (KI-Kosten) — serverseitig prüfen, sobald die Bezahlschranke aktiv ist
  if (PAYWALL_ACTIVE) {
    const { data: p } = await supabase.from("profiles").select("plan, created_at, company_id").eq("user_id", user.id).maybeSingle();
    const subs = await fetchSubscriptionStatus(supabase);
    const { tier } = resolveTier({ plan: p?.plan, createdAt: p?.created_at, hasCompany: !!p?.company_id, subs });
    if (!canTier(tier, "ocr")) {
      return NextResponse.json({ error: "Foto-Scan ist in Stundly Plus enthalten." }, { status: 402 });
    }
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
  const img = checkImage(await req.json().catch(() => null));
  if (!img.ok) return NextResponse.json({ error: img.error }, { status: img.status });

  // 5. Call Anthropic
  let text = "";
  try {
    // Ein ganzer Monat (bis 31 Zeilen) braucht ~2–3k Tokens; mit 1024 brach das JSON ab → nichts erkannt
    text = await runVision(apiKey, img, `Du bist ein Arbeitszeiterfassungs-Assistent. Analysiere dieses Bild einer Arbeitszeitaufzeichnung oder eines Stundenzettels.

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

Heute ist ${new Date().toISOString().slice(0, 10)}. Steht im Bild nur Tag und Monat (z. B. "03.11." oder nur "3" in einer Monatstabelle), ergänze Monat/Jahr aus der Überschrift des Zettels, sonst das aktuelle Jahr.
Nimm nur Tage mit Arbeitszeiten auf (keine leeren, Urlaubs- oder Krankheitstage). Pause in Minuten; fehlt sie, schätze sie nicht, sondern setze 0.
Falls gar kein Datum erkennbar ist, schreibe "unbekannt".
Wenn das Bild keine Arbeitszeiten enthält, gib zurück: {"eintraege": [], "hinweis": "Keine Arbeitszeiten erkannt"}`, 4096);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("Anthropic API error:", message);
    return NextResponse.json({ error: `KI-Fehler: ${message}` }, { status: 502 });
  }

  // 6. Extract JSON — handle text before/after the JSON block
  return NextResponse.json({ result: text, parsed: extractJson(text) });
}
