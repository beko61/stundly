import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit/check";
import { mergeStreets, orteOf } from "@/lib/address/streets";

/**
 * GET /api/address/streets?plz=30519
 * Straßen einer PLZ für die Adress-Vorschläge im Notdienst-Dialog.
 *
 * Proxy auf die OpenPLZ API (offene Daten, kein Key): der Browser des Users spricht
 * nicht selbst mit dem Drittanbieter (keine IP-Weitergabe, DSGVO), es wird nur die
 * PLZ übertragen. Alle Seiten werden serverseitig geladen und 24h gecacht, der Client
 * filtert dann ohne weitere Requests beim Tippen.
 */

export const runtime = "nodejs";

const OPENPLZ_STREETS = "https://openplzapi.org/de/Streets";
const PAGE_SIZE = 50;        // OpenPLZ-Maximum
const MAX_PAGES = 20;        // 1000 Straßen — reicht für jede PLZ, begrenzt Upstream-Last
const LIMIT_PER_HOUR = 120;

interface OpenPlzStreet { name: string; locality: string }

async function fetchPage(plz: string, page: number): Promise<Response> {
  const url = `${OPENPLZ_STREETS}?postalCode=${plz}&page=${page}&pageSize=${PAGE_SIZE}`;
  return fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 * 60 * 24 },
  });
}

export async function GET(req: NextRequest) {
  const plz = req.nextUrl.searchParams.get("plz") ?? "";
  if (!/^\d{5}$/.test(plz)) {
    return NextResponse.json({ error: "PLZ muss 5 Ziffern haben." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  }

  const rl = await checkRateLimit({ bucket: `address:${user.id}`, limit: LIMIT_PER_HOUR, windowSec: 3600 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  try {
    const first = await fetchPage(plz, 1);
    if (!first.ok) throw new Error(`OpenPLZ ${first.status}`);
    const totalPages = Math.min(Number(first.headers.get("x-total-pages") ?? "1") || 1, MAX_PAGES);
    const rest = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) => fetchPage(plz, i + 2)),
    );
    const pages: OpenPlzStreet[][] = [await first.json() as OpenPlzStreet[]];
    for (const r of rest) {
      if (!r.ok) throw new Error(`OpenPLZ ${r.status}`);
      pages.push(await r.json() as OpenPlzStreet[]);
    }
    const streets = mergeStreets(pages.flat());
    return NextResponse.json(
      { plz, orte: orteOf(streets), streets },
      { headers: { "Cache-Control": "private, max-age=86400" } },
    );
  } catch (err) {
    console.error("[address/streets]", err);
    return NextResponse.json({ error: "Straßenverzeichnis nicht erreichbar." }, { status: 502 });
  }
}
