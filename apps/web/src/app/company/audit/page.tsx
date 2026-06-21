import Link from "next/link";
import { redirect } from "next/navigation";
import { getCompanyAdminContext } from "@/lib/company/admin";

const ACTION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  "vacation.approved":     { label: "Urlaub genehmigt",   color: "var(--green)",  icon: "✓" },
  "vacation.rejected":     { label: "Urlaub abgelehnt",   color: "var(--red)",    icon: "✕" },
  "employee.activated":    { label: "Mitarbeiter aktiviert",   color: "var(--green)", icon: "+" },
  "employee.deactivated":  { label: "Mitarbeiter deaktiviert", color: "var(--red)",   icon: "−" },
  "employee.soft_deleted": { label: "Mitarbeiter gelöscht",    color: "var(--red)",   icon: "🗑" },
  "employee.restored":     { label: "Mitarbeiter wiederhergestellt", color: "var(--green)", icon: "↺" },
};

interface AuditRow {
  id:            string;
  created_at:    string;
  actor_user_id: string | null;
  action:        string;
  resource_type: string | null;
  resource_id:   string | null;
  payload:       Record<string, unknown> | null;
}

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000)     return "gerade eben";
  if (ms < 3_600_000)  return `vor ${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `vor ${Math.floor(ms / 3_600_000)}h`;
  return `vor ${Math.floor(ms / 86_400_000)}T`;
}

function fmtAbsolute(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function AuditPage({ searchParams }: Props) {
  const ctx = await getCompanyAdminContext();
  if (!ctx) redirect("/tracker");
  const { admin, companyId } = ctx;

  const sp = await searchParams;
  const PAGE_SIZE = 50;
  const rawPage = parseInt(sp.page ?? "1", 10);
  const pageNo  = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const from = (pageNo - 1) * PAGE_SIZE;
  const to   = from + PAGE_SIZE - 1;

  const { data: rows, count } = await admin
    .from("audit_log")
    .select("id, created_at, actor_user_id, action, resource_type, resource_id, payload", { count: "exact" })
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .range(from, to);

  // Actor name lookup
  const actorIds = Array.from(new Set((rows ?? []).map(r => r.actor_user_id).filter(Boolean) as string[]));
  const { data: actors } = actorIds.length > 0
    ? await admin.from("profiles").select("user_id, full_name, email").in("user_id", actorIds)
    : { data: [] };
  const actorMap = new Map((actors ?? []).map(a => [a.user_id, a.full_name ?? a.email ?? "—"]));

  // Resource (vacation/profile) name lookup
  const profileIds = Array.from(new Set((rows ?? []).filter(r => r.resource_type === "profile").map(r => r.resource_id).filter(Boolean) as string[]));
  const { data: profiles } = profileIds.length > 0
    ? await admin.from("profiles").select("user_id, full_name, email").in("user_id", profileIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p.full_name ?? p.email ?? "—"]));

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, letterSpacing: "0.08em" }}>
          AUDIT-LOG
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>Aktivitätsprotokoll</h1>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, lineHeight: 1.6 }}>
          Alle administrativen Aktionen werden hier gemäß DSGVO + GoBD protokolliert.
          Einträge sind unveränderlich.
        </p>
      </div>

      {(rows?.length ?? 0) === 0 ? (
        <div className="card" style={{ padding: 28, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
          Noch keine Aktivität protokolliert.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(rows as AuditRow[]).map(r => {
              const meta = ACTION_LABELS[r.action] ?? { label: r.action, color: "var(--muted)", icon: "•" };
              const actorName = r.actor_user_id ? actorMap.get(r.actor_user_id) ?? "Unbekannt" : "System";
              const targetName = r.resource_type === "profile" && r.resource_id
                ? profileMap.get(r.resource_id) ?? "—"
                : null;
              const payload = r.payload ?? {};

              return (
                <div key={r.id} style={{
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderLeft: `3px solid ${meta.color}`,
                  borderRadius: 10, padding: "12px 14px",
                  display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: `color-mix(in srgb, ${meta.color} 15%, transparent)`,
                    color: meta.color, fontWeight: 800, fontSize: 13,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>{meta.icon}</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{meta.label}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      <strong style={{ color: "var(--text)" }}>{actorName}</strong>
                      {targetName && <> · {targetName}</>}
                      {r.action.startsWith("vacation.") && payload["start_date"] && (
                        <> · {String(payload["start_date"])} – {String(payload["end_date"] ?? "")}</>
                      )}
                      {payload["rejection_reason"] && (
                        <> · „{String(payload["rejection_reason"]).slice(0, 60)}&ldquo;</>
                      )}
                    </div>
                  </div>

                  <div style={{
                    fontSize: 11, color: "var(--muted)", fontFamily: "'DM Mono',monospace",
                    textAlign: "right", flexShrink: 0,
                  }} title={fmtAbsolute(r.created_at)}>
                    {fmtRelative(r.created_at)}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 18 }}>
              <Link href={`/company/audit?page=${Math.max(1, pageNo - 1)}`}
                className="btn" style={{ padding: "6px 10px", fontSize: 12, opacity: pageNo === 1 ? 0.4 : 1, pointerEvents: pageNo === 1 ? "none" : "auto" }}>
                ‹
              </Link>
              <div style={{ fontSize: 12, color: "var(--muted)", minWidth: 80, textAlign: "center" }}>
                Seite {pageNo} / {totalPages} · {total} insgesamt
              </div>
              <Link href={`/company/audit?page=${Math.min(totalPages, pageNo + 1)}`}
                className="btn" style={{ padding: "6px 10px", fontSize: 12, opacity: pageNo === totalPages ? 0.4 : 1, pointerEvents: pageNo === totalPages ? "none" : "auto" }}>
                ›
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
