import Link from "next/link";
import { adminClient } from "@/lib/superadmin/auth";

export const dynamic = "force-dynamic";

/** Bekannte Aktionen → Türkisch. Unbekannte werden roh angezeigt. */
const ACTION_LABELS: Record<string, string> = {
  "superadmin.user_deleted":          "Kullanıcı silindi",
  "superadmin.company_deleted":       "Firma silindi",
  "superadmin.user_role_changed":     "Rol değiştirildi",
  "superadmin.user_active_changed":   "Aktif/pasif değiştirildi",
  "superadmin.reset_password":        "Şifre sıfırlama maili",
  "superadmin.resend_confirmation":   "Onay maili tekrar",
};

function describe(payload: Record<string, unknown> | null): string {
  if (!payload) return "";
  const parts: string[] = [];
  if (payload.email) parts.push(String(payload.email));
  if (payload.name) parts.push(String(payload.name));
  if (payload.role) parts.push(`rol → ${String(payload.role)}`);
  if (payload.is_active !== undefined) parts.push(payload.is_active ? "aktif" : "pasif");
  if (payload.members !== undefined) parts.push(`${String(payload.members)} üye, ${String(payload.deleted_users ?? 0)} silindi`);
  return parts.join(" · ");
}

const PAGE = 100;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ only?: string; page?: string }> }) {
  const { only, page } = await searchParams;
  const p = Math.max(0, Number(page) || 0);
  const admin = adminClient();

  let q = admin.from("audit_log")
    .select("id, created_at, actor_user_id, company_id, action, resource_type, resource_id, payload")
    .order("created_at", { ascending: false })
    .range(p * PAGE, p * PAGE + PAGE);
  if (only === "admin") q = q.like("action", "superadmin.%");
  const { data: rows, error } = await q;

  const list = (rows ?? []).slice(0, PAGE);
  const hasMore = (rows ?? []).length > PAGE;

  // Akteur-Namen auflösen
  const actorIds = [...new Set(list.map((r) => r.actor_user_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await admin.from("profiles").select("user_id, full_name, email").in("user_id", actorIds)
    : { data: [] as { user_id: string; full_name: string | null; email: string | null }[] };
  const actorName = new Map((actors ?? []).map((a) => [a.user_id, a.full_name || a.email || a.user_id.slice(0, 8)]));

  const qs = (o: Record<string, string | number | undefined>) =>
    "?" + Object.entries({ only, page: p, ...o }).filter(([, v]) => v !== undefined && v !== "" && v !== 0).map(([k, v]) => `${k}=${v}`).join("&");

  return (
    <div>
      <h1 className="sa-title">İşlem geçmişi</h1>
      <p className="sa-sub">Kim, ne zaman, neyi değiştirdi — en yeni en üstte</p>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <Link href="/superadmin/audit" className="sa-chip" style={{ padding: "6px 12px", textDecoration: "none", background: only !== "admin" ? "var(--accent)" : "var(--surface2)", color: only !== "admin" ? "#fff" : "var(--text)" }}>Tümü</Link>
        <Link href="/superadmin/audit?only=admin" className="sa-chip" style={{ padding: "6px 12px", textDecoration: "none", background: only === "admin" ? "var(--accent)" : "var(--surface2)", color: only === "admin" ? "#fff" : "var(--text)" }}>Sadece süper admin</Link>
      </div>

      {error && <p role="alert" style={{ color: "var(--red)", fontSize: 13 }}>⚠️ {error.message}</p>}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="sa-list">
          <div className="sa-row sa-head" style={{ gridTemplateColumns: "150px minmax(160px,1fr) minmax(140px,1fr) minmax(200px,2fr)" }}>
            <span>Zaman</span><span>Kim</span><span>İşlem</span><span>Detay</span>
          </div>
          {list.map((r) => (
            <div key={r.id} className="sa-row" style={{ gridTemplateColumns: "150px minmax(160px,1fr) minmax(140px,1fr) minmax(200px,2fr)" }}>
              <span className="sa-muted" style={{ fontFamily: "'DM Mono',monospace", fontSize: 12 }}>
                <span className="sa-cell-label">Zaman</span>{new Date(r.created_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
              </span>
              <span><span className="sa-cell-label">Kim</span>{r.actor_user_id ? actorName.get(r.actor_user_id) ?? r.actor_user_id.slice(0, 8) : "sistem"}</span>
              <span className="sa-wide"><span className="sa-cell-label">İşlem</span><strong>{ACTION_LABELS[r.action] ?? r.action}</strong></span>
              <span className="sa-wide sa-muted" style={{ overflowWrap: "anywhere" }}>
                <span className="sa-cell-label">Detay</span>{describe(r.payload as Record<string, unknown> | null) || `${r.resource_type ?? ""} ${r.resource_id?.slice(0, 8) ?? ""}`}
              </span>
            </div>
          ))}
          {list.length === 0 && !error && <div style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>Kayıt yok.</div>}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
        {p > 0 ? <Link href={qs({ page: p - 1 })} className="btn btn-secondary">← Daha yeni</Link> : <span />}
        {hasMore && <Link href={qs({ page: p + 1 })} className="btn btn-secondary">Daha eski →</Link>}
      </div>
    </div>
  );
}
