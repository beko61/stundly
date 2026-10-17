import Link from "next/link";
import { adminClient } from "@/lib/superadmin/auth";
import { groupErrors, type ErrorRow } from "@/lib/monitoring/errorEvents";

export const dynamic = "force-dynamic";

const RANGES = { "24h": { label: "Son 24 saat", ms: 24 * 3600 * 1000 }, "7d": { label: "Son 7 gün", ms: 7 * 24 * 3600 * 1000 } } as const;
type RangeKey = keyof typeof RANGES;

const fmt = (iso: string) => new Date(iso).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });

export default async function ErrorsPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { r } = await searchParams;
  const range: RangeKey = r === "24h" ? "24h" : "7d";
  const since = new Date(Date.now() - RANGES[range].ms).toISOString();

  const { data, error } = await adminClient().from("error_events")
    .select("id, created_at, source, fingerprint, message, stack, location, path, digest, user_id, app_version")
    .gte("created_at", since).order("created_at", { ascending: false }).limit(2000);
  const rows = (data ?? []) as ErrorRow[];
  const groups = groupErrors(rows);

  return (
    <div>
      <h1 className="sa-title">Hatalar</h1>
      <p className="sa-sub">Uygulamada ve sunucuda oluşan hatalar — aynı hatalar gruplu, en yeni en üstte. 30 gün saklanır.</p>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(Object.keys(RANGES) as RangeKey[]).map((k) => (
          <Link key={k} href={`/superadmin/errors?r=${k}`} className="sa-chip" style={{ padding: "6px 12px", textDecoration: "none", background: range === k ? "var(--accent)" : "var(--surface2)", color: range === k ? "#fff" : "var(--text)" }}>
            {RANGES[k].label}
          </Link>
        ))}
      </div>

      {error && (
        <p role="alert" style={{ color: "var(--red)", fontSize: 13 }}>
          ⚠️ {error.message.includes("error_events") ? "Tablo yok — Migration 037'yi Supabase'de çalıştır." : error.message}
        </p>
      )}

      {!error && (
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
          {rows.length} hata · {groups.length} farklı
        </p>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {groups.map((g) => (
          <div key={g.fingerprint} className="card" style={{ padding: "12px 14px" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: "var(--red)", minWidth: 36 }}>{g.count}×</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, overflowWrap: "anywhere" }}>{g.message}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, display: "flex", flexWrap: "wrap", gap: "2px 10px" }}>
                  <span>{g.source === "server" ? "🖥 Sunucu" : "📱 Tarayıcı"}</span>
                  <span>{g.lastPath ?? "–"}</span>
                  <span>{g.users} kullanıcı</span>
                  <span>son: {fmt(g.lastSeen)}</span>
                  {g.count > 1 && <span>ilk: {fmt(g.firstSeen)}</span>}
                  <span>v{g.lastVersion ?? "?"}</span>
                </div>
                {(g.lastStack || g.location) && (
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ fontSize: 12, cursor: "pointer", color: "var(--accent2)" }}>Ayrıntı</summary>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>{g.location}</div>
                    {g.lastStack && (
                      <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", overflowWrap: "anywhere", background: "var(--surface2)", padding: 10, borderRadius: 8, marginTop: 6, maxHeight: 260, overflow: "auto" }}>
                        {g.lastStack}
                      </pre>
                    )}
                  </details>
                )}
              </div>
            </div>
          </div>
        ))}
        {groups.length === 0 && !error && (
          <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>
            ✅ Bu aralıkta hata yok.
          </div>
        )}
      </div>
    </div>
  );
}
