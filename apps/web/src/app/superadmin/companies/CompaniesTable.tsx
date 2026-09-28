"use client";

import { useState } from "react";
import type React from "react";

export interface CompanyRow {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  vatId: string | null;
  maxEmployees: number | null;
  createdAt: string;
  plan: string;
  status: string | null;
  paidStripe: boolean;
  ownerEmail: string | null;
  memberCount: number;
  superAdminMembers: number;
}

const planLabels: Record<string, string> = { trial: "Testphase", individual: "Einzelperson", team: "Team", business: "Unternehmen" };
const statusColors: Record<string, string> = { active: "var(--green)", trialing: "var(--yellow)", canceled: "var(--red)", past_due: "var(--orange)" };

const th: React.CSSProperties = { textAlign: "left", padding: "10px 12px", color: "var(--muted)", fontWeight: 600, fontSize: 10, textTransform: "uppercase", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "10px 12px" };

export default function CompaniesTable({ initialRows }: { initialRows: CompanyRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<CompanyRow | null>(null);
  const [typed, setTyped] = useState("");
  const [withUsers, setWithUsers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const q = search.trim().toLowerCase();
  const filtered = rows.filter((r) =>
    !q || r.name.toLowerCase().includes(q) || (r.ownerEmail ?? "").toLowerCase().includes(q) || (r.city ?? "").toLowerCase().includes(q));

  function open(r: CompanyRow) {
    setTarget(r); setTyped(""); setWithUsers(false); setError(null);
  }

  async function doDelete() {
    if (!target) return;
    setBusy(true); setError(null);
    const url = `/api/superadmin/companies/${target.id}?confirm=${encodeURIComponent(typed)}${withUsers ? "&users=1" : ""}`;
    try {
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json() as { error?: string; deleted_users?: number; detached_users?: number; failed?: string[] };
      if (!res.ok) { setError(data.error ?? "Silinemedi"); return; }
      setRows((prev) => prev.filter((r) => r.id !== target.id));
      setNotice(
        `"${target.name}" silindi · ${data.deleted_users ?? 0} hesap silindi · ${data.detached_users ?? 0} hesap bireysel yapıldı` +
        (data.failed?.length ? ` · ${data.failed.length} hesap silinemedi` : ""),
      );
      setTarget(null);
    } catch {
      setError("Ağ hatası — tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  const nameOk = !!target && typed.trim().toLowerCase() === target.name.trim().toLowerCase();

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Firma, sahip e-postası veya şehir ara..."
          className="input"
          style={{ flex: 1, minWidth: 220 }}
        />
        <div style={{ padding: "9px 14px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "var(--muted)" }}>
          {filtered.length} firma
        </div>
      </div>

      {notice && (
        <div role="status" style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, fontSize: 13, color: "var(--green)", background: "color-mix(in srgb, var(--green) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--green) 35%, transparent)" }}>
          ✓ {notice}
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Unternehmen", "Sahip", "Çalışan", "Stadt", "Plan", "Status", "Seit", ""].map((h, i) => <th key={i} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={c.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                <td style={{ ...td, fontWeight: 700 }}>
                  {c.name}
                  {c.vatId && <div style={{ fontFamily: "monospace", fontSize: 10, color: "var(--muted)", fontWeight: 400 }}>{c.vatId}</div>}
                </td>
                <td style={{ ...td, color: "var(--muted)", fontSize: 11 }}>{c.ownerEmail ?? "–"}</td>
                <td style={td}>{c.memberCount}{c.maxEmployees ? <span style={{ color: "var(--muted)" }}> / {c.maxEmployees}</span> : null}</td>
                <td style={{ ...td, color: "var(--muted)" }}>{[c.city, c.country].filter(Boolean).join(", ") || "–"}</td>
                <td style={td}>{planLabels[c.plan] ?? c.plan}</td>
                <td style={td}>
                  <span style={{ color: statusColors[c.status ?? ""] ?? "var(--muted)", fontWeight: 700, fontSize: 11 }}>{c.status ?? "–"}</span>
                </td>
                <td style={{ ...td, color: "var(--muted)", whiteSpace: "nowrap" }}>{new Date(c.createdAt).toLocaleDateString("de-DE")}</td>
                <td style={td}>
                  <button
                    onClick={() => open(c)}
                    style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, background: "color-mix(in srgb, var(--red) 12%, transparent)", color: "var(--red)" }}
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 13 }}>Firma bulunamadı.</div>
        )}
      </div>

      {target && (
        <div role="dialog" aria-modal="true" aria-labelledby="del-company-title" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 16 }}>
          <div className="card" style={{ padding: 28, maxWidth: 440, width: "100%" }}>
            <h3 id="del-company-title" style={{ fontWeight: 800, marginBottom: 10 }}>⚠️ Firmayı sil: {target.name}</h3>

            {target.paidStripe ? (
              <p style={{ color: "var(--red)", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                Bu firmanın aktif, ücretli bir Stripe aboneliği var. Önce Stripe&apos;ta iptal edin — yoksa ödeme alınmaya devam eder.
              </p>
            ) : (
              <>
                <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
                  Firma, aboneliği ve bekleyen davetleri kalıcı olarak silinir. Bu firmada <strong style={{ color: "var(--text)" }}>{target.memberCount} hesap</strong> var.
                </p>

                {target.memberCount > 0 && (
                  <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, marginBottom: 14, cursor: "pointer", lineHeight: 1.5 }}>
                    <input type="checkbox" checked={withUsers} onChange={(e) => setWithUsers(e.target.checked)} style={{ width: 18, height: 18, marginTop: 1, accentColor: "var(--red)" }} />
                    <span>
                      <strong>Çalışan hesaplarını da sil</strong> (saatleri, izinleri, tüm verileriyle).
                      <span style={{ color: "var(--muted)" }}> İşaretlemezsen hesaplar kalır ve bireysel hesaba dönüşür.</span>
                      {target.superAdminMembers > 0 && <span style={{ color: "var(--muted)" }}> Süper admin hesapları hiçbir zaman silinmez.</span>}
                    </span>
                  </label>
                )}

                <label className="label" htmlFor="del-company-name">Onay için firma adını yaz: <strong style={{ color: "var(--text)", textTransform: "none" }}>{target.name}</strong></label>
                <input id="del-company-name" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
              </>
            )}

            {error && <p role="alert" style={{ color: "var(--red)", fontSize: 12, marginTop: 10 }}>⚠️ {error}</p>}

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={() => setTarget(null)} className="btn btn-secondary" style={{ flex: 1 }}>İptal</button>
              {!target.paidStripe && (
                <button
                  onClick={() => void doDelete()}
                  disabled={!nameOk || busy}
                  className="btn"
                  style={{ flex: 1, background: "var(--red)", color: "#fff", opacity: !nameOk || busy ? 0.5 : 1, cursor: !nameOk || busy ? "not-allowed" : "pointer" }}
                >
                  {busy ? "Siliniyor..." : withUsers ? "Firmayı ve hesapları sil" : "Firmayı sil"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
