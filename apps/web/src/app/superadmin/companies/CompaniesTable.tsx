"use client";

import { useState } from "react";

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

const planLabels: Record<string, string> = { trial: "Deneme", individual: "Bireysel", team: "Team", business: "Unternehmen" };
const COLS = "minmax(180px, 2fr) minmax(150px, 1.5fr) 80px minmax(110px, 1fr) 130px 90px 70px";
const statusColors: Record<string, string> = { active: "var(--green)", trialing: "var(--yellow)", canceled: "var(--red)", past_due: "var(--orange)" };


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

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="sa-list">
          <div className="sa-row sa-head" style={{ gridTemplateColumns: COLS }}>
            <span>Firma</span><span>Sahip</span><span>Çalışan</span><span>Şehir</span><span>Plan</span><span>Kayıt</span><span />
          </div>
          {filtered.map((c) => (
            <div key={c.id} className="sa-row" style={{ gridTemplateColumns: COLS }}>
              <span className="sa-wide" style={{ minWidth: 0 }}>
                <strong>{c.name}</strong>
                {c.vatId && <span className="sa-muted" style={{ display: "block", fontFamily: "monospace", fontSize: 11 }}>{c.vatId}</span>}
              </span>
              <span className="sa-muted" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}><span className="sa-cell-label">Sahip</span>{c.ownerEmail ?? "—"}</span>
              <span><span className="sa-cell-label">Çalışan</span>{c.memberCount}{c.maxEmployees ? <span className="sa-muted"> / {c.maxEmployees}</span> : null}</span>
              <span className="sa-muted"><span className="sa-cell-label">Şehir</span>{[c.city, c.country].filter(Boolean).join(", ") || "—"}</span>
              <span>
                <span className="sa-cell-label">Plan</span>{planLabels[c.plan] ?? c.plan}{" "}
                <span style={{ color: statusColors[c.status ?? ""] ?? "var(--muted)", fontWeight: 700, fontSize: 11 }}>{c.status ?? ""}</span>
              </span>
              <span className="sa-muted" style={{ whiteSpace: "nowrap" }}><span className="sa-cell-label">Kayıt</span>{new Date(c.createdAt).toLocaleDateString("tr-TR")}</span>
              <span>
                <button
                  onClick={() => open(c)}
                  style={{ padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: "color-mix(in srgb, var(--red) 12%, transparent)", color: "var(--red)" }}
                >
                  Sil
                </button>
              </span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 13 }}>Firma bulunamadı.</div>
          )}
        </div>
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
