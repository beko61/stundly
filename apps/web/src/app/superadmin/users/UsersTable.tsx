"use client";

import { useMemo, useState } from "react";
import type React from "react";
import { inSegment, lastActivity, SOURCE_LABELS, type SaUser, type Segment } from "@/lib/superadmin/metrics";

const ROLES = ["individual", "employee", "company_admin", "super_admin"];
const ROLE_LABELS: Record<string, string> = {
  individual: "Bireysel", employee: "Çalışan", company_admin: "Firma yöneticisi", super_admin: "Süper admin",
};
const ROLE_COLORS: Record<string, string> = {
  super_admin: "var(--red)", company_admin: "var(--accent2)", employee: "var(--blue)", individual: "var(--green)",
};
const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "active7", label: "Aktif (7 gün)" },
  { key: "never", label: "Hiç kullanmamış" },
  { key: "inactive", label: "Pasif 14+ gün" },
  { key: "unconfirmed", label: "E-posta onaysız" },
  { key: "deletion", label: "Silme talebi" },
];

const DAY = 86_400_000;
export function ago(iso: string | number | null, now = Date.now()): string {
  if (!iso) return "hiç";
  const t = typeof iso === "number" ? iso : new Date(iso).getTime();
  if (!t) return "hiç";
  const d = Math.floor((now - t) / DAY);
  if (d <= 0) return "bugün";
  if (d === 1) return "dün";
  if (d < 30) return `${d} gün önce`;
  if (d < 365) return `${Math.floor(d / 30)} ay önce`;
  return `${Math.floor(d / 365)} yıl önce`;
}
const dateTR = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("tr-TR") : "–");

const COLS = "minmax(200px, 2fr) 120px minmax(110px, 1fr) 95px 110px 70px";

function csvCell(v: unknown) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

export default function UsersTable({ initialUsers, initialSegment = "all" }: { initialUsers: SaUser[]; initialSegment?: Segment }) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<Segment>(initialSegment);
  const [role, setRole] = useState("all");
  const [sort, setSort] = useState<"created" | "activity">("created");
  const [openId, setOpenId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const counts = useMemo(
    () => Object.fromEntries(SEGMENTS.map((s) => [s.key, users.filter((u) => inSegment(u, s.key, now)).length])),
    [users, now],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = users.filter((u) =>
      inSegment(u, segment, now) &&
      (role === "all" || u.role === role) &&
      (!q || [u.name, u.email, u.companyName].some((v) => (v ?? "").toLowerCase().includes(q))));
    return sort === "activity"
      ? [...list].sort((a, b) => lastActivity(b) - lastActivity(a))
      : list;
  }, [users, search, segment, role, sort, now]);

  const open = users.find((u) => u.id === openId) ?? null;
  const patch = (id: string, p: Partial<SaUser>) => setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...p } : u)));

  function exportCsv() {
    const head = ["E-Mail", "Name", "Rolle", "Firma", "Registriert", "Letzter Login", "Letzter Eintrag", "Tage erfasst", "Notdienste", "Quelle", "Bestätigt", "Aktiv"];
    const rows = filtered.map((u) => [u.email, u.name, u.role, u.companyName, u.createdAt.slice(0, 10), u.lastSignInAt?.slice(0, 10), u.lastDataAt?.slice(0, 10), u.entryDays, u.ndCount, u.source, u.emailConfirmed ? "ja" : "nein", u.isActive ? "ja" : "nein"]);
    const csv = [head, ...rows].map((r) => r.map(csvCell).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `stundly_kullanicilar_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {SEGMENTS.map((s) => (
          <button key={s.key} onClick={() => setSegment(s.key)} className="sa-chip" aria-pressed={segment === s.key}
            style={{ border: "1px solid var(--border)", cursor: "pointer", padding: "6px 12px", fontSize: 12,
              background: segment === s.key ? "var(--accent)" : "var(--surface2)", color: segment === s.key ? "#fff" : "var(--text)" }}>
            {s.label} <span style={{ opacity: 0.7 }}>{counts[s.key]}</span>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="İsim, e-posta veya firma ara..." style={{ flex: "1 1 220px", width: "auto" }} aria-label="Ara" />
        <select className="input" value={role} onChange={(e) => setRole(e.target.value)} style={{ width: "auto" }} aria-label="Rol">
          <option value="all">Tüm roller</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value as "created" | "activity")} style={{ width: "auto" }} aria-label="Sıralama">
          <option value="created">Yeni kayıt önce</option>
          <option value="activity">Son aktivite önce</option>
        </select>
        <button className="btn btn-secondary" onClick={exportCsv}>⬇ CSV ({filtered.length})</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="sa-list">
          <div className="sa-row sa-head" style={{ gridTemplateColumns: COLS }}>
            <span>Kişi</span><span>Rol</span><span>Firma</span><span>Kayıt</span><span>Son aktivite</span><span>Gün</span>
          </div>
          {filtered.map((u) => (
            <button key={u.id} className="sa-row" style={{ gridTemplateColumns: COLS, opacity: u.isActive ? 1 : 0.55 }} onClick={() => setOpenId(u.id)}>
              <span className="sa-wide" style={{ minWidth: 0 }}>
                <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.name || "—"} {!u.emailConfirmed && <span title="E-posta onaysız">✉️</span>} {u.pendingDeletion && <span title="Silme talebi">🗑</span>}
                </strong>
                <span className="sa-muted" style={{ fontSize: 12, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email ?? "—"}</span>
              </span>
              <span><span className="sa-cell-label">Rol</span><span className="sa-chip" style={{ color: ROLE_COLORS[u.role] }}>{ROLE_LABELS[u.role] ?? u.role}</span></span>
              <span className="sa-muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><span className="sa-cell-label">Firma</span>{u.companyName ?? "—"}</span>
              <span className="sa-muted"><span className="sa-cell-label">Kayıt</span>{dateTR(u.createdAt)}</span>
              <span><span className="sa-cell-label">Son aktivite</span>{ago(lastActivity(u) || null, now)}</span>
              <span style={{ fontFamily: "'DM Mono',monospace" }}><span className="sa-cell-label">Gün</span>{u.entryDays}{u.ndCount ? <span className="sa-muted"> +{u.ndCount}N</span> : null}</span>
            </button>
          ))}
          {filtered.length === 0 && <div style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>Kullanıcı bulunamadı.</div>}
        </div>
      </div>

      {open && <UserDrawer user={open} now={now} onClose={() => setOpenId(null)} onPatch={(p) => patch(open.id, p)}
        onDeleted={() => { setUsers((prev) => prev.filter((u) => u.id !== open.id)); setOpenId(null); }} />}
    </div>
  );
}

function UserDrawer({ user: u, now, onClose, onPatch, onDeleted }: {
  user: SaUser; now: number; onClose: () => void; onPatch: (p: Partial<SaUser>) => void; onDeleted: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [typed, setTyped] = useState("");

  async function call(key: string, init: RequestInit, url = `/api/superadmin/users/${u.id}`): Promise<boolean> {
    setBusy(key); setMsg(null);
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setMsg({ ok: false, text: data.error ?? "İşlem başarısız" }); return false; }
      return true;
    } catch {
      setMsg({ ok: false, text: "Ağ hatası" }); return false;
    } finally {
      setBusy(null);
    }
  }

  const act = async (action: string, ok: string) => {
    if (await call(action, { method: "POST", body: JSON.stringify({ action }) })) setMsg({ ok: true, text: ok });
  };

  const row = (dt: string, dd: React.ReactNode) => (<><dt>{dt}</dt><dd>{dd}</dd></>);

  return (
    <>
      <div className="sa-drawer-backdrop" onClick={onClose} />
      <aside className="sa-drawer" role="dialog" aria-modal="true" aria-labelledby="sa-user-title">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 16 }}>
          <div style={{ minWidth: 0 }}>
            <h2 id="sa-user-title" style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{u.name || "İsimsiz"}</h2>
            <div className="sa-muted" style={{ fontSize: 13, overflowWrap: "anywhere" }}>{u.email}</div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Kapat" style={{ padding: "6px 10px" }}>✕</button>
        </div>

        <dl className="sa-dl">
          {row("Kayıt", `${dateTR(u.createdAt)} (${ago(u.createdAt, now)})`)}
          {row("Son giriş", u.lastSignInAt ? `${dateTR(u.lastSignInAt)} (${ago(u.lastSignInAt, now)})` : "hiç")}
          {row("Son kayıt", u.lastDataAt ? `${dateTR(u.lastDataAt)} (${ago(u.lastDataAt, now)})` : "hiç kayıt girmedi")}
          {row("Girilen gün", `${u.entryDays} gün · ${u.ndCount} Notdienst`)}
          {row("Firma", u.companyName ?? "—")}
          {row("Nereden", u.source ? SOURCE_LABELS[u.source] ?? u.source : "belirtilmemiş")}
          {row("Davet kodu", u.referredBy ?? "—")}
          {row("E-posta", u.emailConfirmed ? "✓ onaylı" : "✉️ onaysız")}
          {row("Hatırlatma", u.reminderLastType ? `${u.reminderLastType} · ${ago(u.reminderLastSentAt, now)}` : "gönderilmedi")}
          {u.pendingDeletion && row("DSGVO", <span style={{ color: "var(--red)" }}>Silme talebi bekliyor</span>)}
        </dl>

        <h3 style={{ fontSize: 14, fontWeight: 800, margin: "22px 0 10px" }}>İşlemler</h3>
        <div style={{ display: "grid", gap: 8 }}>
          <label className="label" htmlFor="sa-role" style={{ marginBottom: 0 }}>Rol</label>
          <select id="sa-role" className="input" value={u.role} disabled={busy === "role"}
            onChange={async (e) => {
              const r = e.target.value;
              if (await call("role", { method: "PATCH", body: JSON.stringify({ role: r }) })) { onPatch({ role: r }); setMsg({ ok: true, text: "Rol güncellendi" }); }
            }}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>

          <button className="btn btn-secondary" disabled={busy === "active"}
            onClick={async () => {
              if (await call("active", { method: "PATCH", body: JSON.stringify({ is_active: !u.isActive }) })) {
                onPatch({ isActive: !u.isActive }); setMsg({ ok: true, text: u.isActive ? "Hesap pasif yapıldı" : "Hesap aktif yapıldı" });
              }
            }}>
            {u.isActive ? "⏸ Hesabı pasif yap (giriş engellenir)" : "▶ Hesabı tekrar aktif yap"}
          </button>
          <button className="btn btn-secondary" disabled={busy === "reset_password"} onClick={() => void act("reset_password", "Şifre sıfırlama maili gönderildi")}>
            🔑 Şifre sıfırlama maili gönder
          </button>
          {!u.emailConfirmed && (
            <button className="btn btn-secondary" disabled={busy === "resend_confirmation"} onClick={() => void act("resend_confirmation", "Onay maili tekrar gönderildi")}>
              ✉️ Onay mailini tekrar gönder
            </button>
          )}
          {u.email && (
            <a className="btn btn-ghost" href={`mailto:${u.email}`} style={{ textDecoration: "none" }}>📧 E-posta yaz</a>
          )}

          {!confirmDel ? (
            <button className="btn btn-danger" onClick={() => { setConfirmDel(true); setTyped(""); }}>🗑 Kullanıcıyı sil</button>
          ) : (
            <div style={{ border: "1px solid var(--red)", borderRadius: 10, padding: 12 }}>
              <p style={{ fontSize: 13, color: "var(--red)", marginBottom: 8, lineHeight: 1.5 }}>
                Hesap ve tüm verileri (saatler, Notdienst, izinler) kalıcı olarak silinir. Onay için e-postayı yaz:
              </p>
              <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={u.email ?? ""} aria-label="E-posta onayı" autoComplete="off" />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmDel(false)}>İptal</button>
                <button className="btn" style={{ flex: 1, background: "var(--red)", color: "#fff", opacity: typed.trim().toLowerCase() === (u.email ?? "").toLowerCase() ? 1 : 0.5 }}
                  disabled={typed.trim().toLowerCase() !== (u.email ?? "").toLowerCase() || busy === "delete"}
                  onClick={async () => {
                    if (await call("delete", { method: "DELETE" }, `/api/superadmin/users/${u.id}?confirm=${encodeURIComponent(u.email ?? "")}`)) onDeleted();
                  }}>
                  {busy === "delete" ? "Siliniyor..." : "Kalıcı olarak sil"}
                </button>
              </div>
            </div>
          )}
        </div>

        {msg && (
          <p role={msg.ok ? "status" : "alert"} style={{ marginTop: 14, fontSize: 13, color: msg.ok ? "var(--green)" : "var(--red)" }}>
            {msg.ok ? "✓ " : "⚠️ "}{msg.text}
          </p>
        )}
      </aside>
    </>
  );
}
