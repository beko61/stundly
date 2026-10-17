import fs from "fs";
import path from "path";

/**
 * Liest .env.test.local (Test-Projekt) und bricht ab, wenn es fehlt oder auf dieselbe
 * Datenbank zeigt wie .env.local (Live). Lokal zeigt .env.local auf die Live-Datenbank —
 * E2E-Tests dürfen dort NIE laufen.
 */
function parse(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) out[m[1]!] = m[2]!.trim();
  }
  return out;
}

export function loadE2eEnv() {
  const dir = path.resolve(__dirname, "..");
  const test = parse(path.join(dir, ".env.test.local"));
  const live = parse(path.join(dir, ".env.local"));

  const url = test.E2E_SUPABASE_URL ?? "";
  const anon = test.E2E_SUPABASE_ANON_KEY ?? "";
  const service = test.E2E_SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !anon || !service || url.includes("xxxxxxxx")) {
    throw new Error("E2E: apps/web/.env.test.local fehlt oder ist unvollständig (Vorlage: .env.test.example).");
  }
  const host = (u: string) => { try { return new URL(u).host; } catch { return u; } };
  if (live.NEXT_PUBLIC_SUPABASE_URL && host(url) === host(live.NEXT_PUBLIC_SUPABASE_URL)) {
    throw new Error("E2E ABGEBROCHEN: .env.test.local zeigt auf die LIVE-Datenbank. Nur das Test-Projekt verwenden!");
  }
  return { url, anon, service };
}
