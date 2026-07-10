"use client";
import { useState } from "react";

type User = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  plan: string;
  is_active: boolean;
  company_id: string | null;
  created_at: string;
  last_seen_at: string | null;
};

const ROLES = ["individual", "employee", "company_admin", "super_admin"];

const roleColors: Record<string, string> = {
  super_admin: "var(--red)",
  company_admin: "var(--accent2)",
  employee: "var(--blue)",
  individual: "var(--green)",
};

export default function UsersTable({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [loading, setLoading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; name: string; email: string } | null>(null);

  const filtered = users.filter(u => {
    const matchSearch =
      (u.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email ?? "").toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "all" || u.role === filterRole;
    return matchSearch && matchRole;
  });

  async function changeRole(userId: string, role: string) {
    setLoading(userId + "_role");
    const res = await fetch(`/api/superadmin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role } : u));
    }
    setLoading(null);
  }

  async function toggleActive(userId: string, current: boolean) {
    setLoading(userId + "_active");
    const res = await fetch(`/api/superadmin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !current }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_active: !current } : u));
    }
    setLoading(null);
  }

  async function deleteUser(userId: string, email: string) {
    setLoading(userId + "_delete");
    // GÜVENLİK: ?confirm=<email> zorunlu (server-side double-check).
    // Yanlış kullanıcıyı silmeyi imkansızlaştırır.
    const url = `/api/superadmin/users/${userId}?confirm=${encodeURIComponent(email)}`;
    const res = await fetch(url, { method: "DELETE" });
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.user_id !== userId));
    }
    setConfirm(null);
    setLoading(null);
  }

  return (
    <div>
      {/* Arama & Filtre */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="İsim veya e-posta ara..."
          style={{
            flex: 1, minWidth: 200, padding: "9px 14px",
            background: "var(--surface2)", border: "1px solid var(--border)",
            borderRadius: 10, color: "var(--text)", fontSize: 13,
            outline: "none",
          }}
        />
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          style={{
            padding: "9px 14px", background: "var(--surface2)",
            border: "1px solid var(--border)", borderRadius: 10,
            color: "var(--text)", fontSize: 13, cursor: "pointer",
          }}
        >
          <option value="all">Tüm Roller</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <div style={{ padding: "9px 14px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "var(--muted)" }}>
          {filtered.length} kullanıcı
        </div>
      </div>

      {/* Tablo */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Ad Soyad", "E-Posta", "Rol", "Plan", "Durum", "Son Giriş", "Kayıt", "İşlemler"].map(h => (
                <th key={h} style={{
                  textAlign: "left", padding: "10px 12px",
                  color: "var(--muted)", fontWeight: 600, fontSize: 10,
                  textTransform: "uppercase", whiteSpace: "nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr key={u.user_id} style={{
                borderBottom: "1px solid var(--border)",
                background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                opacity: loading?.startsWith(u.user_id) ? 0.5 : 1,
                transition: "opacity 0.2s",
              }}>
                <td style={{ padding: "10px 12px", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {u.full_name ?? "–"}
                </td>
                <td style={{ padding: "10px 12px", color: "var(--muted)", fontSize: 11 }}>
                  {u.email ?? "–"}
                </td>
                {/* Rol dropdown */}
                <td style={{ padding: "10px 12px" }}>
                  <select
                    value={u.role}
                    onChange={e => changeRole(u.user_id, e.target.value)}
                    disabled={loading === u.user_id + "_role"}
                    style={{
                      background: "var(--surface2)", border: "1px solid var(--border)",
                      borderRadius: 6, color: roleColors[u.role] ?? "var(--text)",
                      fontSize: 11, fontWeight: 700, padding: "3px 6px", cursor: "pointer",
                    }}
                  >
                    {ROLES.map(r => <option key={r} value={r} style={{ color: roleColors[r] }}>{r}</option>)}
                  </select>
                </td>
                <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{u.plan}</td>
                {/* Aktif toggle */}
                <td style={{ padding: "10px 12px" }}>
                  <button
                    onClick={() => toggleActive(u.user_id, u.is_active)}
                    disabled={loading === u.user_id + "_active"}
                    style={{
                      padding: "3px 10px", borderRadius: 6, border: "none",
                      cursor: "pointer", fontSize: 11, fontWeight: 700,
                      background: u.is_active
                        ? "color-mix(in srgb, var(--green) 15%, transparent)"
                        : "color-mix(in srgb, var(--red) 15%, transparent)",
                      color: u.is_active ? "var(--green)" : "var(--red)",
                    }}
                  >
                    {u.is_active ? "Aktif" : "Pasif"}
                  </button>
                </td>
                <td style={{ padding: "10px 12px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                  {u.last_seen_at ? new Date(u.last_seen_at).toLocaleDateString("tr-TR") : "–"}
                </td>
                <td style={{ padding: "10px 12px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                  {new Date(u.created_at).toLocaleDateString("tr-TR")}
                </td>
                {/* Sil butonu */}
                <td style={{ padding: "10px 12px" }}>
                  <button
                    onClick={() => setConfirm({ id: u.user_id, name: u.full_name ?? u.email ?? u.user_id, email: u.email ?? "" })}
                    disabled={loading === u.user_id + "_delete"}
                    style={{
                      padding: "3px 10px", borderRadius: 6, border: "none",
                      cursor: "pointer", fontSize: 11, fontWeight: 700,
                      background: "color-mix(in srgb, var(--red) 12%, transparent)",
                      color: "var(--red)",
                    }}
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 13 }}>
            Kullanıcı bulunamadı.
          </div>
        )}
      </div>

      {/* Silme Onay Modalı */}
      {confirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
        }}>
          <div className="card" style={{ padding: 32, maxWidth: 380, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ fontWeight: 800, marginBottom: 10 }}>Kullanıcıyı Sil</h3>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
              <strong style={{ color: "var(--text)" }}>{confirm.name}</strong> kalıcı olarak silinecek.
              Bu işlem geri alınamaz.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setConfirm(null)}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 10,
                  background: "var(--surface2)", border: "1px solid var(--border)",
                  color: "var(--text)", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                İptal
              </button>
              <button
                onClick={() => deleteUser(confirm.id, confirm.email)}
                disabled={loading === confirm.id + "_delete"}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 10,
                  background: "var(--red)", border: "none",
                  color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}
              >
                {loading === confirm.id + "_delete" ? "Siliniyor..." : "Evet, Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
