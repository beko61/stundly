import { NextRequest, NextResponse } from "next/server";
import { getCompanyAdminContext } from "@/lib/company/admin";
import { checkRateLimit } from "@/lib/rateLimit/check";
import { checkImage, extractJson, runVision } from "@/lib/scan/vision";
import { toRows } from "@/lib/company/scanRows";
import type { TeamMember } from "@/lib/company/nameMatch";

export const runtime = "nodejs";
export const maxDuration = 120; // 15 Personen × Monat = lange Antwort

const LIMIT_PER_HOUR = 30;

function prompt(): string {
  return `Du liest einen Stundenzettel / Schichtplan einer Firma mit mehreren Mitarbeitern (Namen + Arbeitszeiten).
Gib NUR dieses kompakte JSON zurück (kein anderer Text):
{"personen":[{"name":"Vorname Nachname wie auf dem Zettel","tage":[["YYYY-MM-DD","HH:MM","HH:MM",PauseMinuten,"A"]]}],"hinweis":"kurz, was erkannt wurde"}
Typ: "A" = gearbeitet, "U" = Urlaub, "K" = krank (bei U/K Zeiten als "" und Pause 0).
Heute ist ${new Date().toISOString().slice(0, 10)}. Fehlt Monat/Jahr bei einem Tag, nimm sie aus der Überschrift des Zettels, sonst den aktuellen Monat/Jahr.
Leere Tage/Zellen weglassen. Pause nur, wenn sie dasteht, sonst 0 (nicht schätzen). Nichts erfinden; unleserliche Zellen weglassen.
Wenn keine Arbeitszeiten erkennbar: {"personen":[],"hinweis":"Keine Arbeitszeiten erkannt"}`;
}

/**
 * POST /api/company/scan  Body: { image, mediaType }
 * Firma: Foto eines Stundenzettels/Schichtplans (mehrere Personen) → Zeilen + Mitarbeiter-Vorschlag.
 * Speichert nichts — der Admin prüft/korrigiert die Tabelle, Speichern über /api/company/import.
 */
export async function POST(req: NextRequest) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { admin, companyId, user } = ctx;

  const rl = await checkRateLimit({ bucket: `company_scan:${user.id}`, limit: LIMIT_PER_HOUR, windowSec: 3600 });
  if (!rl.allowed) {
    return NextResponse.json({ error: `Zu viele Scans. Limit ${LIMIT_PER_HOUR}/Stunde erreicht.` }, { status: 429 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY nicht konfiguriert." }, { status: 500 });

  const img = checkImage(await req.json().catch(() => null));
  if (!img.ok) return NextResponse.json({ error: img.error }, { status: img.status });

  const { data: teamRaw } = await admin.from("profiles")
    .select("user_id, full_name, vorname, nachname")
    .eq("company_id", companyId).is("deleted_at", null).order("full_name");
  const team = (teamRaw ?? []) as TeamMember[];

  let text = "";
  try {
    text = await runVision(apiKey, img, prompt(), 12000);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("Anthropic API error (company scan):", message);
    return NextResponse.json({ error: `KI-Fehler: ${message}` }, { status: 502 });
  }

  const parsed = extractJson(text);
  if (!parsed) {
    return NextResponse.json(
      { error: "Die KI-Antwort war unvollständig. Bitte einen kleineren Teil des Zettels fotografieren." },
      { status: 422 },
    );
  }
  return NextResponse.json({
    rows: toRows(parsed, team),
    hinweis: String((parsed as { hinweis?: unknown }).hinweis ?? ""),
    team: team.map(m => ({ user_id: m.user_id, name: m.full_name || [m.vorname, m.nachname].filter(Boolean).join(" ") || "—" })),
  });
}
